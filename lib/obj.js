'use strict';
var Cesium = require('cesium');
var path = require('path');
var Promise = require('bluebird');

var ArrayStorage = require('./ArrayStorage');
var loadImage = require('./image');
var loadMtl = require('./mtl');
var readLines = require('./readLines');

var combine = Cesium.combine;
var ComponentDatatype = Cesium.ComponentDatatype;
var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;
var RuntimeError = Cesium.RuntimeError;

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
var facePattern1 = /f( +-?\d+)\/?( +-?\d+)\/?( +-?\d+)\/?( +-?\d+)?\/?/;                                                                        // f vertex vertex vertex ...
var facePattern2 = /f( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)?/;                            // f vertex/uv vertex/uv vertex/uv ...
var facePattern3 = /f( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))?/;    // f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...
var facePattern4 = /f( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))?/;                                // f vertex//normal vertex//normal vertex//normal ...

/**
 * Parse an obj file.
 *
 * @param {String} objPath Path to the obj file.
 * @param {Object} [options] An object with the following properties:
 * @param {Boolean} [options.hasTransparency=false] Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @param {Boolean} [options.secure=false] Prevent the converter from reading image or mtl files outside of the input obj directory.
 * @returns {Promise} A promise resolving to the obj data.
 * @exception {RuntimeError} The file does not have any geometry information in it.
 *
 * @private
 */
function loadObj(objPath, options) {
    options = combine(options, {
        hasTransparency : false,
        secure : false
    });

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

    function addFace(v1, p1, u1, n1, v2, p2, u2, n2, v3, p3, u3, n3, v4, p4, u4, n4) {
        var index1 = addVertex(v1, p1, u1, n1);
        var index2 = addVertex(v2, p2, u2, n2);
        var index3 = addVertex(v3, p3, u3, n3);

        primitive.indices.push(index1);
        primitive.indices.push(index2);
        primitive.indices.push(index3);

        // Triangulate if the face is a quad
        if (defined(v4)) {
            var index4 = addVertex(v4, p4, u4, n4);
            primitive.indices.push(index1);
            primitive.indices.push(index3);
            primitive.indices.push(index4);
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
            positions.push(parseFloat(result[1]));
            positions.push(parseFloat(result[2]));
            positions.push(parseFloat(result[3]));
        } else if ((result = normalPattern.exec(line) ) !== null) {
            normals.push(parseFloat(result[1]));
            normals.push(parseFloat(result[2]));
            normals.push(parseFloat(result[3]));
        } else if ((result = uvPattern.exec(line)) !== null) {
            uvs.push(parseFloat(result[1]));
            uvs.push(1.0 - parseFloat(result[2])); // Flip y so 0.0 is the bottom of the image
        } else if ((result = facePattern1.exec(line)) !== null) {
            addFace(
                result[1], result[1], undefined, undefined,
                result[2], result[2], undefined, undefined,
                result[3], result[3], undefined, undefined,
                result[4], result[4], undefined, undefined
            );
        } else if ((result = facePattern2.exec(line)) !== null) {
            addFace(
                result[1], result[2], result[3], undefined,
                result[4], result[5], result[6], undefined,
                result[7], result[8], result[9], undefined,
                result[10], result[11], result[12], undefined
            );
        } else if ((result = facePattern3.exec(line)) !== null) {
            addFace(
                result[1], result[2], result[3], result[4],
                result[5], result[6], result[7], result[8],
                result[9], result[10], result[11], result[12],
                result[13], result[14], result[15], result[16]
            );
        } else if ((result = facePattern4.exec(line)) !== null) {
            addFace(
                result[1], result[2], undefined, result[3],
                result[4], result[5], undefined, result[6],
                result[7], result[8], undefined, result[9],
                result[10], result[11], undefined, result[12]
            );
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
        throw new RuntimeError(objPath + ' does not have any geometry data');
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

function getAbsolutePath(mtlPath, objPath) {
    if (!path.isAbsolute(mtlPath)) {
        mtlPath = path.join(path.dirname(objPath), mtlPath);
    }
    return mtlPath;
}

function outsideDirectory(filePath, objPath) {
    return (path.relative(path.dirname(objPath), filePath).indexOf('..') === 0);
}

function loadMaterials(mtlPaths, objPath, options) {
    var materials = {};
    return Promise.map(mtlPaths, function(mtlPath) {
        mtlPath = getAbsolutePath(mtlPath, objPath);
        if (options.secure && outsideDirectory(mtlPath, objPath)) {
            console.log('Could not read mtl file at ' + mtlPath + ' because it is outside of the obj directory and the secure flag is true. Using default material instead.');
            return;
        }
        return loadMtl(mtlPath)
            .then(function(materialsInMtl) {
                materials = combine(materials, materialsInMtl);
            })
            .catch(function() {
                console.log('Could not read mtl file at ' + mtlPath + '. Using default material instead.');
            });
    }).then(function() {
        return materials;
    });
}

function loadImages(imagePaths, objPath, options) {
    var images = {};
    return Promise.map(imagePaths, function(imagePath) {
        if (options.secure && outsideDirectory(imagePath, objPath)) {
            console.log('Could not read image file at ' + imagePath + ' because it is outside of the obj directory and the secure flag is true. Material will ignore this image.');
            return;
        }
        return loadImage(imagePath, options)
            .then(function(image) {
                if (defined(image)) {
                    images[imagePath] = image;
                }
            })
            .catch(function() {
                console.log('Could not read image file at ' + imagePath + '. Material will ignore this image.');
                return undefined;
            });
    }).then(function() {
        return images;
    });
}

function getImagePaths(materials) {
    var imagePaths = {};
    for (var name in materials) {
        if (materials.hasOwnProperty(name)) {
            var material = materials[name];
            if (defined(material.ambientColorMap)) {
                imagePaths[material.ambientColorMap] = true;
            }
            if (defined(material.diffuseColorMap)) {
                imagePaths[material.diffuseColorMap] = true;
            }
            if (defined(material.emissionColorMap)) {
                imagePaths[material.emissionColorMap] = true;
            }
            if (defined(material.specularColorMap)) {
                imagePaths[material.specularColorMap] = true;
            }
        }
    }
    return Object.keys(imagePaths);
}

function removeEmptyPrimitives(primitives) {
    var final = [];
    var primitivesLength = primitives.length;
    for (var i = 0; i < primitivesLength; ++i) {
        var primitive = primitives[i];
        if (primitive.indices.length > 0) {
            final.push(primitive);
        }
    }
    return final;
}

function removeEmptyMeshes(meshes) {
    var final = [];
    var meshesLength = meshes.length;
    for (var i = 0; i < meshesLength; ++i) {
        var mesh = meshes[i];
        mesh.primitives = removeEmptyPrimitives(mesh.primitives);
        if ((mesh.primitives.length > 0) && (mesh.positions.length > 0)) {
            final.push(mesh);
        }
    }
    return final;
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
