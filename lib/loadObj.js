'use strict';
var Cesium = require('cesium');
var path = require('path');
var Promise = require('bluebird');

var ArrayStorage = require('./ArrayStorage');
var loadImage = require('./loadImage');
var loadMtl = require('./loadMtl');
var readLines = require('./readLines');

var Axis = Cesium.Axis;
var Cartesian2 = Cesium.Cartesian2;
var Cartesian3 = Cesium.Cartesian3;
var ComponentDatatype = Cesium.ComponentDatatype;
var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;
var IntersectionTests = Cesium.IntersectionTests;
var Matrix3 = Cesium.Matrix3;
var Matrix4 = Cesium.Matrix4;
var OrientedBoundingBox = Cesium.OrientedBoundingBox;
var Plane = Cesium.Plane;
var PolygonPipeline = Cesium.PolygonPipeline;
var Ray = Cesium.Ray;
var RuntimeError = Cesium.RuntimeError;
var WindingOrder = Cesium.WindingOrder;

module.exports = loadObj;

// Object name (o) -> node
// Group name (g) -> mesh
// Material name (usemtl) -> primitive

function Node() {
    this.name = undefined;
    this.meshes = [];
}

function Mesh() {
    this.name = undefined;
    this.primitives = [];
    this.positions = new ArrayStorage(ComponentDatatype.FLOAT);
    this.normals = new ArrayStorage(ComponentDatatype.FLOAT);
    this.uvs = new ArrayStorage(ComponentDatatype.FLOAT);
}

function Primitive() {
    this.material = undefined;
    this.indices = new ArrayStorage(ComponentDatatype.UNSIGNED_INT);
}

// OBJ regex patterns are modified from ThreeJS (https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/OBJLoader.js)
var vertexPattern = /v( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;                                                      // v float float float
var normalPattern = /vn( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;                                                     // vn float float float
var uvPattern = /vt( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;                                                                               // vt float float
var facePattern1 = /f(\s+-?\d+\/?\/?){3,}/;                       // f vertex vertex vertex ...
var facePattern2 = /f(\s+-?\d+\/-?\d+){3,}/;                      // f vertex/uv vertex/uv vertex/uv ...
var facePattern3 = /f(\s+-?\d+\/-?\d+\/-?\d+){3,}/;               // f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...
var facePattern4 = /f(\s+-?\d+\/\/-?\d+){3,}/;                    // f vertex//normal vertex//normal vertex//normal ...

var faceSpacePattern = /f?\s+/;
var faceSpaceOrSlashPattern = /(f?\s+)|(\/+\s*)/g;
var scratchCartesian = new Cartesian3();

/**
 * Parse an obj file.
 *
 * @param {String} objPath Path to the obj file.
 * @param {Object} options An object with the following properties:
 * @param {Boolean} options.checkTransparency Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @param {Boolean} options.secure Prevent the converter from reading image or mtl files outside of the input obj directory.
 * @param {String} options.inputUpAxis Up axis of the obj.
 * @param {String} options.outputUpAxis Up axis of the converted glTF.
 * @param {Boolean} options.logger A callback function for handling logged messages. Defaults to console.log.
 * @returns {Promise} A promise resolving to the obj data.
 * @exception {RuntimeError} The file does not have any geometry information in it.
 *
 * @private
 */
function loadObj(objPath, options) {
    var axisTransform = getAxisTransform(options.inputUpAxis, options.outputUpAxis);

    // Global store of vertex attributes listed in the obj file
    var positions = new ArrayStorage(ComponentDatatype.FLOAT);
    var normals = new ArrayStorage(ComponentDatatype.FLOAT);
    var uvs = new ArrayStorage(ComponentDatatype.FLOAT);

    // The current node, mesh, and primitive
    var node;
    var mesh;
    var primitive;

    // All nodes seen in the obj
    var nodes = [];

    // Used to build the indices. The vertex cache is unique to each mesh.
    var vertexCache = {};
    var vertexCacheLimit = 1000000;
    var vertexCacheCount = 0;
    var vertexCount = 0;

    // All mtl paths seen in the obj
    var mtlPaths = [];

    function getName(name) {
        return (name === '' ? undefined : name);
    }

    function addNode(name) {
        node = new Node();
        node.name = getName(name);
        nodes.push(node);
        addMesh();
    }

    function addMesh(name) {
        mesh = new Mesh();
        mesh.name = getName(name);
        node.meshes.push(mesh);
        addPrimitive();

        // Clear the vertex cache for each new mesh
        vertexCache = {};
        vertexCacheCount = 0;
        vertexCount = 0;
    }

    function addPrimitive() {
        primitive = new Primitive();
        mesh.primitives.push(primitive);
    }

    function useMaterial(name) {
        // Look to see if this material has already been used by a primitive in the mesh
        var material = getName(name);
        var primitives = mesh.primitives;
        var primitivesLength = primitives.length;
        for (var i = 0; i < primitivesLength; ++i) {
            if (primitives[i].material === material) {
                primitive = primitives[i];
                return;
            }
        }
        // Add a new primitive with this material
        addPrimitive();
        primitive.material = getName(name);
    }

    var intPoint = new Cartesian3();
    var xAxis = Cesium.Cartesian3.UNIT_X.clone();
    var yAxis = Cesium.Cartesian3.UNIT_Y.clone();
    var zAxis = Cesium.Cartesian3.UNIT_Z.clone();
    var origin = new Cartesian3();
    var normal = new Cartesian3();
    var ray = new Ray();
    var plane = new Plane(Cesium.Cartesian3.UNIT_X, 0);
    function projectTo2D(positions) {
        var positions2D = new Array(positions.length);
        var obb = OrientedBoundingBox.fromPoints(positions);
        var halfAxes = obb.halfAxes;
        Matrix3.getColumn(halfAxes, 0, xAxis);
        Matrix3.getColumn(halfAxes, 1, yAxis);
        Matrix3.getColumn(halfAxes, 2, zAxis);

        var xMag = Cartesian3.magnitude(xAxis);
        var yMag = Cartesian3.magnitude(yAxis);
        var zMag = Cartesian3.magnitude(zAxis);
        var min = Math.min(xMag, yMag, zMag);

        var center = obb.center;
        var planeXAxis;
        var planeYAxis;
        if (min === xMag) {
            if (!xAxis.equals(Cartesian3.ZERO)) {
                Cartesian3.add(center, xAxis, origin);
                Cartesian3.normalize(xAxis, normal);
            }
            planeXAxis = Cartesian3.normalize(yAxis, yAxis);
            planeYAxis = Cartesian3.normalize(zAxis, zAxis);
        } else if (min === yMag) {
            if (!yAxis.equals(Cartesian3.ZERO)) {
                Cartesian3.add(center, yAxis, origin);
                Cartesian3.normalize(yAxis, normal);
            }
            planeXAxis = Cartesian3.normalize(xAxis, xAxis);
            planeYAxis = Cartesian3.normalize(zAxis, zAxis);
        } else {
            if (!zAxis.equals(Cartesian3.ZERO)) {
                Cartesian3.add(center, zAxis, origin);
                Cartesian3.normalize(zAxis, normal);
            }
            planeXAxis = Cartesian3.normalize(xAxis, xAxis);
            planeYAxis = Cartesian3.normalize(yAxis, yAxis);
        }

        if (min === 0) {
            normal = Cartesian3.cross(planeXAxis, planeYAxis, normal);
            normal = Cartesian3.normalize(normal, normal);
        }

        Plane.fromPointNormal(origin, normal, plane);
        ray.direction = normal;

        for (var i = 0; i < positions.length; i++) {
            ray.origin = positions[i];

            var intersectionPoint = IntersectionTests.rayPlane(ray, plane, intPoint);

            if (!defined(intersectionPoint)) {
                Cartesian3.negate(ray.direction, ray.direction);
                intersectionPoint = IntersectionTests.rayPlane(ray, plane, intPoint);
            }
            var v = Cartesian3.subtract(intersectionPoint, origin, intersectionPoint);
            var x = Cartesian3.dot(planeXAxis, v);
            var y = Cartesian3.dot(planeYAxis, v);

            positions2D[i] = new Cartesian2(x, y);
        }

        return positions2D;
    }

    function getOffset(a, attributeData, components) {
        var i = parseInt(a);
        if (i < 0) {
            // Negative vertex indexes reference the vertices immediately above it
            return (attributeData.length / components + i) * components;
        }
        return (i - 1) * components;
    }

    function createVertex(p, u, n) {
        // Positions
        if (defined(p)) {
            var pi = getOffset(p, positions, 3);
            var px = positions.get(pi + 0);
            var py = positions.get(pi + 1);
            var pz = positions.get(pi + 2);
            mesh.positions.push(px);
            mesh.positions.push(py);
            mesh.positions.push(pz);
        }

        // Normals
        if (defined(n)) {
            var ni = getOffset(n, normals, 3);
            var nx = normals.get(ni + 0);
            var ny = normals.get(ni + 1);
            var nz = normals.get(ni + 2);
            mesh.normals.push(nx);
            mesh.normals.push(ny);
            mesh.normals.push(nz);
        }

        // UVs
        if (defined(u)) {
            var ui = getOffset(u, uvs, 2);
            var ux = uvs.get(ui + 0);
            var uy = uvs.get(ui + 1);
            mesh.uvs.push(ux);
            mesh.uvs.push(uy);
        }
    }

    function addVertex(v, p, u, n) {
        var index = vertexCache[v];
        if (!defined(index)) {
            index = vertexCount++;
            vertexCache[v] = index;
            createVertex(p, u, n);

            // Prevent the vertex cache from growing too large. As a result of clearing the cache there
            // may be some duplicate vertices.
            vertexCacheCount++;
            if (vertexCacheCount > vertexCacheLimit) {
                vertexCacheCount = 0;
                vertexCache = {};
            }
        }
        return index;
    }

    function addFace(vertices, positions, uvs, normals) {

        var u1, u2, u3, n1, n2, n3;

        if (vertices.length === 3) {

            if (uvs) {
                u1 = uvs[0];
                u2 = uvs[1];
                u3 = uvs[2];
            }

            if (normals) {
                n1 = normals[0];
                n2 = normals[1];
                n3 = normals[2];
            }

            var index1 = addVertex(vertices[0], positions[0], u1, n1);
            var index2 = addVertex(vertices[1], positions[1], u2, n2);
            var index3 = addVertex(vertices[2], positions[2], u3, n3);

            primitive.indices.push(index1);
            primitive.indices.push(index2);
            primitive.indices.push(index3);
        } else { // Triangulate if the face is not a triangle
            var positions3D = [];
            var vertexIndices = [];

            var i;
            for (i=0; i < vertices.length; ++i) {
                var u = (defined(uvs)) ? uvs[i] : undefined;
                var n = (defined(normals)) ? normals[i] : undefined;

                var index = addVertex(vertices[i], positions[i], u, n);
                vertexIndices.push(index);

                var pi = getOffset(index+1, positions, 3);
                var px = mesh.positions.get(pi + 0);
                var py = mesh.positions.get(pi + 1);
                var pz = mesh.positions.get(pi + 2);

                positions3D.push(new Cartesian3(px, py, pz));
            }
            var positions2D = projectTo2D(positions3D);

            var windingOrder = PolygonPipeline.computeWindingOrder2D(positions2D);

            // Since the projection doesn't respect winding order, reverse the order of
            // the vertices before triangulating to enforce counter clockwise.
            if (windingOrder === WindingOrder.CLOCKWISE) {
                positions2D.reverse();
            }

            var positionIndices = PolygonPipeline.triangulate(positions2D);

            for (i=0; i < positionIndices.length; ++i) {
                primitive.indices.push(vertexIndices[positionIndices[i]]);
            }
        }

    }

    function parseLine(line) {
        line = line.trim();
        var result;

        if ((line.length === 0) || (line.charAt(0) === '#')) {
            // Don't process empty lines or comments
        } else if (/^o\s/i.test(line)) {
            var objectName = line.substring(2).trim();
            addNode(objectName);
        } else if (/^g\s/i.test(line)) {
            var groupName = line.substring(2).trim();
            addMesh(groupName);
        } else if (/^usemtl\s/i.test(line)) {
            var materialName = line.substring(7).trim();
            useMaterial(materialName);
        } else if (/^mtllib/i.test(line)) {
            var paths = line.substring(7).trim().split(' ');
            mtlPaths = mtlPaths.concat(paths);
        } else if ((result = vertexPattern.exec(line)) !== null) {
            var position = scratchCartesian;
            position.x = parseFloat(result[1]);
            position.y = parseFloat(result[2]);
            position.z = parseFloat(result[3]);
            if (defined(axisTransform)) {
                Matrix4.multiplyByPoint(axisTransform, position, position);
            }
            positions.push(position.x);
            positions.push(position.y);
            positions.push(position.z);
        } else if ((result = normalPattern.exec(line) ) !== null) {
            var normal = scratchCartesian;
            normal.x = parseFloat(result[1]);
            normal.y = parseFloat(result[2]);
            normal.z = parseFloat(result[3]);
            if (defined(axisTransform)) {
                Matrix4.multiplyByPointAsVector(axisTransform, normal, normal);
            }
            normals.push(normal.x);
            normals.push(normal.y);
            normals.push(normal.z);
        } else if ((result = uvPattern.exec(line)) !== null) {
            uvs.push(parseFloat(result[1]));
            uvs.push(1.0 - parseFloat(result[2])); // Flip y so 0.0 is the bottom of the image
        } else {
            var faceVertices = line.replace(faceSpacePattern, ' ').substring(1).split(' '); // get vertex data (attributes '/' separated)
            var faceAttributes = line.replace(faceSpaceOrSlashPattern, ' ').substring(1).split(' '); // get vertex attributes
            var facePositions = [];
            var faceUvs = [];
            var faceNormals = [];

            if (facePattern1.test(line)) { // format "f v v v ..."
                addFace(faceVertices, faceAttributes, undefined, undefined);
            } else if (facePattern2.test(line)) { // format "f v/uv v/uv v/uv ..."
                var i;
                for (i=0; i <= faceAttributes.length - 2; i += 2)
                {
                    facePositions.push(faceAttributes[i]);
                    faceUvs.push(faceAttributes[i+1]);
                }
                addFace(faceVertices, facePositions, faceUvs, undefined);
            } else if (facePattern3.test(line)) { // format "v/uv/n v/uv/n v/uv/n ..."
                for (i=0; i <= faceAttributes.length - 3; i += 3)
                {
                    facePositions.push(faceAttributes[i]);
                    faceUvs.push(faceAttributes[i+1]);
                    faceNormals.push(faceAttributes[i+2]);
                }
                addFace(faceVertices, facePositions, faceUvs, faceNormals);
            } else if (facePattern4.test(line)) { // format "v//n v//n v//n ..."
                for (i=0; i <= faceAttributes.length - 2; i += 2)
                {
                    facePositions.push(faceAttributes[i]);
                    faceNormals.push(faceAttributes[i+1]);
                }
                addFace(faceVertices, facePositions, undefined, faceNormals);
            }
        }
    }

    // Create a default node in case there are no o/g/usemtl lines in the obj
    addNode();

    // Parse the obj file
    return readLines(objPath, parseLine)
        .then(function() {
            // Unload resources
            positions = undefined;
            normals = undefined;
            uvs = undefined;

            // Load materials and images
            return finishLoading(nodes, mtlPaths, objPath, options);
        });
}

function finishLoading(nodes, mtlPaths, objPath, options) {
    nodes = cleanNodes(nodes);
    if (nodes.length === 0) {
        return Promise.reject(new RuntimeError(objPath + ' does not have any geometry data'));
    }
    return loadMaterials(mtlPaths, objPath, options)
        .then(function(materials) {
            var imagePaths = getImagePaths(materials);
            return loadImages(imagePaths, objPath, options)
                .then(function(images) {
                    return {
                        nodes : nodes,
                        materials : materials,
                        images : images
                    };
                });
        });
}

function outsideDirectory(filePath, objPath) {
    return (path.relative(path.dirname(objPath), filePath).indexOf('..') === 0);
}

function loadMaterials(mtlPaths, objPath, options) {
    var secure = options.secure;
    var logger = options.logger;
    var objDirectory = path.dirname(objPath);
    var materials = {};
    return Promise.map(mtlPaths, function(mtlPath) {
        mtlPath = path.resolve(objDirectory, mtlPath);
        if (secure && outsideDirectory(mtlPath, objPath)) {
            logger('Could not read mtl file at ' + mtlPath + ' because it is outside of the obj directory and the secure flag is true. Using default material instead.');
            return;
        }
        return loadMtl(mtlPath)
            .then(function(materialsInMtl) {
                materials = Object.assign(materials, materialsInMtl);
            })
            .catch(function() {
                logger('Could not read mtl file at ' + mtlPath + '. Using default material instead.');
            });
    }, {concurrency : 10})
        .thenReturn(materials);
}

function loadImages(imagePaths, objPath, options) {
    var secure = options.secure;
    var logger = options.logger;
    var images = {};
    return Promise.map(imagePaths, function(imagePath) {
        if (secure && outsideDirectory(imagePath, objPath)) {
            logger('Could not read image file at ' + imagePath + ' because it is outside of the obj directory and the secure flag is true. Material will ignore this image.');
            return;
        }
        return loadImage(imagePath, options)
            .then(function(image) {
                images[imagePath] = image;
            })
            .catch(function() {
                logger('Could not read image file at ' + imagePath + '. Material will ignore this image.');
            });
    }, {concurrency : 10})
        .thenReturn(images);
}

function getImagePaths(materials) {
    var imagePaths = {};
    for (var name in materials) {
        if (materials.hasOwnProperty(name)) {
            var material = materials[name];
            if (defined(material.ambientTexture)) {
                imagePaths[material.ambientTexture] = true;
            }
            if (defined(material.diffuseTexture)) {
                imagePaths[material.diffuseTexture] = true;
            }
            if (defined(material.emissionTexture)) {
                imagePaths[material.emissionTexture] = true;
            }
            if (defined(material.specularTexture)) {
                imagePaths[material.specularTexture] = true;
            }
        }
    }
    return Object.keys(imagePaths);
}

function removeEmptyMeshes(meshes) {
    return meshes.filter(function(mesh) {
        // Remove empty primitives
        mesh.primitives = mesh.primitives.filter(function(primitive) {
            return primitive.indices.length > 0;
        });
        // Valid meshes must have at least one primitive and contain positions
        return (mesh.primitives.length > 0) && (mesh.positions.length > 0);
    });
}

function meshesHaveNames(meshes) {
    var meshesLength = meshes.length;
    for (var i = 0; i < meshesLength; ++i) {
        if (defined(meshes[i].name)) {
            return true;
        }
    }
    return false;
}

function removeEmptyNodes(nodes) {
    var final = [];
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        var node = nodes[i];
        var meshes = removeEmptyMeshes(node.meshes);
        if (meshes.length === 0) {
            continue;
        }
        node.meshes = meshes;
        if (!defined(node.name) && meshesHaveNames(meshes)) {
            // If the obj has groups (g) but not object groups (o) then convert meshes to nodes
            var meshesLength = meshes.length;
            for (var j = 0; j < meshesLength; ++j) {
                var mesh = meshes[j];
                var convertedNode = new Node();
                convertedNode.name = mesh.name;
                convertedNode.meshes = [mesh];
                final.push(convertedNode);
            }
        } else {
            final.push(node);
        }
    }
    return final;
}

function setDefaultNames(items, defaultName, usedNames) {
    var itemsLength = items.length;
    for (var i = 0; i < itemsLength; ++i) {
        var item = items[i];
        var name = defaultValue(item.name, defaultName);
        var occurrences = usedNames[name];
        if (defined(occurrences)) {
            usedNames[name]++;
            name = name + '_' + occurrences;
        } else {
            usedNames[name] = 1;
        }
        item.name = name;
    }
}

function setDefaults(nodes) {
    var usedNames = {};
    setDefaultNames(nodes, 'Node', usedNames);
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        var node = nodes[i];
        setDefaultNames(node.meshes, node.name + '-Mesh', usedNames);
    }
}

function cleanNodes(nodes) {
    nodes = removeEmptyNodes(nodes);
    setDefaults(nodes);
    return nodes;
}

function getAxisTransform(inputUpAxis, outputUpAxis) {
    if (inputUpAxis === 'X' && outputUpAxis === 'Y') {
        return Axis.X_UP_TO_Y_UP;
    } else if (inputUpAxis === 'X' && outputUpAxis === 'Z') {
        return Axis.X_UP_TO_Z_UP;
    } else if (inputUpAxis === 'Y' && outputUpAxis === 'X') {
        return Axis.Y_UP_TO_X_UP;
    } else if (inputUpAxis === 'Y' && outputUpAxis === 'Z') {
        return Axis.Y_UP_TO_Z_UP;
    } else if (inputUpAxis === 'Z' && outputUpAxis === 'X') {
        return Axis.Z_UP_TO_X_UP;
    } else if (inputUpAxis === 'Z' && outputUpAxis === 'Y') {
        return Axis.Z_UP_TO_Y_UP;
    }
}
