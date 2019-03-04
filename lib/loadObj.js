'use strict';
const Cesium = require('cesium');
const path = require('path');
const Promise = require('bluebird');

const ArrayStorage = require('./ArrayStorage');
const loadMtl = require('./loadMtl');
const outsideDirectory = require('./outsideDirectory');
const readLines = require('./readLines');

const Cartesian3 = Cesium.Cartesian3;
const ComponentDatatype = Cesium.ComponentDatatype;
const CoplanarPolygonGeometryLibrary = Cesium.CoplanarPolygonGeometryLibrary;
const defaultValue = Cesium.defaultValue;
const defined = Cesium.defined;
const PolygonPipeline = Cesium.PolygonPipeline;
const RuntimeError = Cesium.RuntimeError;
const WindingOrder = Cesium.WindingOrder;

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
}

function Primitive() {
    this.material = undefined;
    this.indices = new ArrayStorage(ComponentDatatype.UNSIGNED_INT);
    this.positions = new ArrayStorage(ComponentDatatype.FLOAT);
    this.normals = new ArrayStorage(ComponentDatatype.FLOAT);
    this.uvs = new ArrayStorage(ComponentDatatype.FLOAT);
}

// OBJ regex patterns are modified from ThreeJS (https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/OBJLoader.js)
const vertexPattern = /v( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;     // v float float float
const normalPattern = /vn( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;    // vn float float float
const uvPattern = /vt( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;                              // vt float float
const facePattern = /(-?\d+)\/?(-?\d*)\/?(-?\d*)/g;                                              // for any face format "f v", "f v/v", "f v//v", "f v/v/v"

/**
 * Parse an obj file.
 *
 * @param {String} objPath Path to the obj file.
 * @param {Object} options The options object passed along from lib/obj2gltf.js
 * @returns {Promise} A promise resolving to the obj data, which includes an array of nodes containing geometry information and an array of materials.
 *
 * @private
 */
function loadObj(objPath, options) {
    // Global store of vertex attributes listed in the obj file
    let positions = new ArrayStorage(ComponentDatatype.FLOAT);
    let normals = new ArrayStorage(ComponentDatatype.FLOAT);
    let uvs = new ArrayStorage(ComponentDatatype.FLOAT);

    // The current node, mesh, and primitive
    let node;
    let mesh;
    let primitive;
    let activeMaterial;

    // All nodes seen in the obj
    const nodes = [];

    // Used to build the indices. The vertex cache is unique to each primitive.
    let vertexCache = {};
    const vertexCacheLimit = 1000000;
    let vertexCacheCount = 0;
    let vertexCount = 0;

    // All mtl paths seen in the obj
    let mtlPaths = [];

    // Buffers for face data that spans multiple lines
    let lineBuffer = '';

    // Used for parsing face data
    const faceVertices = [];
    const facePositions = [];
    const faceUvs = [];
    const faceNormals = [];

    function clearVertexCache() {
        vertexCache = {};
        vertexCacheCount = 0;
    }

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
    }

    function addPrimitive() {
        primitive = new Primitive();
        primitive.material = activeMaterial;
        mesh.primitives.push(primitive);

        // Clear the vertex cache for each new primitive
        clearVertexCache();
        vertexCount = 0;
    }

    function reusePrimitive(callback) {
        const primitives = mesh.primitives;
        const primitivesLength = primitives.length;
        for (let i = 0; i < primitivesLength; ++i) {
            if (primitives[i].material === activeMaterial) {
                if (!defined(callback) || callback(primitives[i])) {
                    primitive = primitives[i];
                    clearVertexCache();
                    vertexCount = primitive.positions.length / 3;
                    return;
                }
            }
        }
        addPrimitive();
    }

    function useMaterial(name) {
        activeMaterial = getName(name);
        reusePrimitive();
    }

    function faceAndPrimitiveMatch(uvs, normals, primitive) {
        const faceHasUvs = uvs[0].length > 0;
        const faceHasNormals = normals[0].length > 0;
        const primitiveHasUvs = primitive.uvs.length > 0;
        const primitiveHasNormals = primitive.normals.length > 0;
        return primitiveHasUvs === faceHasUvs && primitiveHasNormals === faceHasNormals;
    }

    function checkPrimitive(uvs, normals) {
        const firstFace = primitive.indices.length === 0;
        if (!firstFace && !faceAndPrimitiveMatch(uvs, normals, primitive)) {
            reusePrimitive(function(primitive) {
                return faceAndPrimitiveMatch(uvs, normals, primitive);
            });
        }
    }

    function getOffset(a, attributeData, components) {
        const i = parseInt(a);
        if (i < 0) {
            // Negative vertex indexes reference the vertices immediately above it
            return (attributeData.length / components + i) * components;
        }
        return (i - 1) * components;
    }

    function createVertex(p, u, n) {
        // Positions
        if (p.length > 0) {
            const pi = getOffset(p, positions, 3);
            const px = positions.get(pi + 0);
            const py = positions.get(pi + 1);
            const pz = positions.get(pi + 2);
            primitive.positions.push(px);
            primitive.positions.push(py);
            primitive.positions.push(pz);
        }

        // Normals
        if (n.length > 0) {
            const ni = getOffset(n, normals, 3);
            const nx = normals.get(ni + 0);
            const ny = normals.get(ni + 1);
            const nz = normals.get(ni + 2);
            primitive.normals.push(nx);
            primitive.normals.push(ny);
            primitive.normals.push(nz);
        }

        // UVs
        if (u.length > 0) {
            const ui = getOffset(u, uvs, 2);
            const ux = uvs.get(ui + 0);
            const uy = uvs.get(ui + 1);
            primitive.uvs.push(ux);
            primitive.uvs.push(uy);
        }
    }

    function addVertex(v, p, u, n) {
        let index = vertexCache[v];
        if (!defined(index)) {
            index = vertexCount++;
            vertexCache[v] = index;
            createVertex(p, u, n);

            // Prevent the vertex cache from growing too large. As a result of clearing the cache there
            // may be some duplicate vertices.
            vertexCacheCount++;
            if (vertexCacheCount > vertexCacheLimit) {
                clearVertexCache();
            }
        }
        return index;
    }

    function getPosition(index, result) {
        const pi = getOffset(index, positions, 3);
        const px = positions.get(pi + 0);
        const py = positions.get(pi + 1);
        const pz = positions.get(pi + 2);
        return Cartesian3.fromElements(px, py, pz, result);
    }

    function getNormal(index, result) {
        const ni = getOffset(index, normals, 3);
        const nx = normals.get(ni + 0);
        const ny = normals.get(ni + 1);
        const nz = normals.get(ni + 2);
        return Cartesian3.fromElements(nx, ny, nz, result);
    }

    const scratch1 = new Cartesian3();
    const scratch2 = new Cartesian3();
    const scratch3 = new Cartesian3();
    const scratch4 = new Cartesian3();
    const scratch5 = new Cartesian3();
    const scratchCenter = new Cartesian3();
    const scratchAxis1 = new Cartesian3();
    const scratchAxis2 = new Cartesian3();
    const scratchNormal = new Cartesian3();
    const scratchPositions = [new Cartesian3(), new Cartesian3(), new Cartesian3(), new Cartesian3()];
    const scratchVertexIndices = [];
    const scratchPoints = [];

    function checkWindingCorrect(positionIndex1, positionIndex2, positionIndex3, normalIndex) {
        if (normalIndex.length === 0) {
            // If no face normal, we have to assume the winding is correct.
            return true;
        }
        const normal = getNormal(normalIndex, scratchNormal);
        const A = getPosition(positionIndex1, scratch1);
        const B = getPosition(positionIndex2, scratch2);
        const C = getPosition(positionIndex3, scratch3);

        const BA = Cartesian3.subtract(B, A, scratch4);
        const CA = Cartesian3.subtract(C, A, scratch5);
        const cross = Cartesian3.cross(BA, CA, scratch3);

        return (Cartesian3.dot(normal, cross) >= 0);
    }

    function addTriangle(index1, index2, index3, correctWinding) {
        if (correctWinding) {
            primitive.indices.push(index1);
            primitive.indices.push(index2);
            primitive.indices.push(index3);
        } else {
            primitive.indices.push(index1);
            primitive.indices.push(index3);
            primitive.indices.push(index2);
        }
    }

    function addFace(vertices, positions, uvs, normals) {
        checkPrimitive(uvs, normals);

        if (vertices.length === 3) {
            const isWindingCorrect = checkWindingCorrect(positions[0], positions[1], positions[2], normals[0]);
            const index1 = addVertex(vertices[0], positions[0], uvs[0], normals[0]);
            const index2 = addVertex(vertices[1], positions[1], uvs[1], normals[1]);
            const index3 = addVertex(vertices[2], positions[2], uvs[2], normals[2]);
            addTriangle(index1, index2, index3, isWindingCorrect);
        } else { // Triangulate if the face is not a triangle
            const points = scratchPoints;
            const vertexIndices = scratchVertexIndices;

            points.length = 0;
            vertexIndices.length = 0;

            for (let i = 0; i < vertices.length; ++i) {
                const index = addVertex(vertices[i], positions[i], uvs[i], normals[i]);
                vertexIndices.push(index);
                if (i === scratchPositions.length) {
                    scratchPositions.push(new Cartesian3());
                }
                points.push(getPosition(positions[i], scratchPositions[i]));
            }

            const validGeometry = CoplanarPolygonGeometryLibrary.computeProjectTo2DArguments(points, scratchCenter, scratchAxis1, scratchAxis2);
            if (!validGeometry) {
                return;
            }
            const projectPoints = CoplanarPolygonGeometryLibrary.createProjectPointsTo2DFunction(scratchCenter, scratchAxis1, scratchAxis2);
            const points2D = projectPoints(points);
            const indices = PolygonPipeline.triangulate(points2D);
            const isWindingCorrect = PolygonPipeline.computeWindingOrder2D(points2D) !== WindingOrder.CLOCKWISE;

            for (let i = 0; i < indices.length - 2; i += 3) {
                addTriangle(vertexIndices[indices[i]], vertexIndices[indices[i+1]], vertexIndices[indices[i+2]], isWindingCorrect);
            }
        }
    }

    function parseLine(line) {
        line = line.trim();
        let result;

        if ((line.length === 0) || (line.charAt(0) === '#')) {
            // Don't process empty lines or comments
        } else if (/^o\s/i.test(line)) {
            const objectName = line.substring(2).trim();
            addNode(objectName);
        } else if (/^g\s/i.test(line)) {
            const groupName = line.substring(2).trim();
            addMesh(groupName);
        } else if (/^usemtl/i.test(line)) {
            const materialName = line.substring(7).trim();
            useMaterial(materialName);
        } else if (/^mtllib/i.test(line)) {
            const mtllibLine = line.substring(7).trim();
            mtlPaths = mtlPaths.concat(getMtlPaths(mtllibLine));
        } else if ((result = vertexPattern.exec(line)) !== null) {
            positions.push(parseFloat(result[1]));
            positions.push(parseFloat(result[2]));
            positions.push(parseFloat(result[3]));
        } else if ((result = normalPattern.exec(line) ) !== null) {
            const normal = Cartesian3.fromElements(parseFloat(result[1]), parseFloat(result[2]), parseFloat(result[3]), scratchNormal);
            if (Cartesian3.equals(normal, Cartesian3.ZERO)) {
                Cartesian3.clone(Cartesian3.UNIT_Z, normal);
            } else {
                Cartesian3.normalize(normal, normal);
            }
            normals.push(normal.x);
            normals.push(normal.y);
            normals.push(normal.z);
        } else if ((result = uvPattern.exec(line)) !== null) {
            uvs.push(parseFloat(result[1]));
            uvs.push(1.0 - parseFloat(result[2])); // Flip y so 0.0 is the bottom of the image
        } else { // face line or invalid line
            // Because face lines can contain n vertices, we use a line buffer in case the face data spans multiple lines.
            // If there's a line continuation don't create face yet
            if (line.slice(-1) === '\\') {
                lineBuffer += line.substring(0, line.length-1);
                return;
            }
            lineBuffer += line;
            if (lineBuffer.substring(0, 2) === 'f ') {
                while ((result = facePattern.exec(lineBuffer)) !== null) {
                    faceVertices.push(result[0]);
                    facePositions.push(result[1]);
                    faceUvs.push(result[2]);
                    faceNormals.push(result[3]);
                }
                if (faceVertices.length > 2) {
                    addFace(faceVertices, facePositions, faceUvs, faceNormals);
                }

                faceVertices.length = 0;
                facePositions.length = 0;
                faceNormals.length = 0;
                faceUvs.length = 0;
            }
            lineBuffer = '';
        }
    }

    // Create a default node in case there are no o/g/usemtl lines in the obj
    addNode();

    // Parse the obj file
    return readLines(objPath, parseLine)
        .then(function() {
            // Add hasNormals to options object for loadMtl
            options.hasNormals = normals.length > 0;

            // Unload resources
            positions = undefined;
            normals = undefined;
            uvs = undefined;

            // Load materials and textures
            return finishLoading(nodes, mtlPaths, objPath, defined(activeMaterial), options);
        });
}

function getMtlPaths(mtllibLine) {
    // Handle paths with spaces. E.g. mtllib my material file.mtl
    const mtlPaths = [];
    const splits = mtllibLine.split(' ');
    const length = splits.length;
    let startIndex = 0;
    for (let i = 0; i < length; ++i) {
        if (path.extname(splits[i]) !== '.mtl') {
            continue;
        }
        const mtlPath = splits.slice(startIndex, i + 1).join(' ');
        mtlPaths.push(mtlPath);
        startIndex = i + 1;
    }
    return mtlPaths;
}

function finishLoading(nodes, mtlPaths, objPath, usesMaterials, options) {
    nodes = cleanNodes(nodes);
    if (nodes.length === 0) {
        throw new RuntimeError(objPath + ' does not have any geometry data');
    }
    const name = path.basename(objPath, path.extname(objPath));
    return loadMtls(mtlPaths, objPath, options)
        .then(function(materials) {
            if (materials.length > 0 && !usesMaterials) {
                assignDefaultMaterial(nodes, materials, usesMaterials);
            }
            assignUnnamedMaterial(nodes, materials);
            return {
                nodes : nodes,
                materials : materials,
                name : name
            };
        });
}

function normalizeMtlPath(mtlPath, objDirectory) {
    mtlPath = mtlPath.replace(/\\/g, '/');
    return path.normalize(path.join(objDirectory, mtlPath));
}

function loadMtls(mtlPaths, objPath, options) {
    const objDirectory = path.dirname(objPath);
    let materials = [];

    // Remove duplicates
    mtlPaths = mtlPaths.filter(function(value, index, self) {
        return self.indexOf(value) === index;
    });

    return Promise.map(mtlPaths, function(mtlPath) {
        mtlPath = normalizeMtlPath(mtlPath, objDirectory);
        const shallowPath = path.join(objDirectory, path.basename(mtlPath));
        if (options.secure && outsideDirectory(mtlPath, objDirectory)) {
            // Try looking for the .mtl in the same directory as the obj
            options.logger('The material file is outside of the obj directory and the secure flag is true. Attempting to read the material file from within the obj directory instead.');
            return loadMtl(shallowPath, options)
                .then(function(materialsInMtl) {
                    materials = materials.concat(materialsInMtl);
                })
                .catch(function(error) {
                    options.logger(error.message);
                    options.logger('Could not read material file at ' + shallowPath + '. Using default material instead.');
                });
        }

        return loadMtl(mtlPath, options)
            .catch(function(error) {
                // Try looking for the .mtl in the same directory as the obj
                options.logger(error.message);
                options.logger('Could not read material file at ' + mtlPath + '. Attempting to read the material file from within the obj directory instead.');
                return loadMtl(shallowPath, options);
            })
            .then(function(materialsInMtl) {
                materials = materials.concat(materialsInMtl);
            })
            .catch(function(error) {
                options.logger(error.message);
                options.logger('Could not read material file at ' + shallowPath + '. Using default material instead.');
            });
    }, {concurrency : 10})
        .then(function() {
            return materials;
        });
}

function assignDefaultMaterial(nodes, materials) {
    const defaultMaterial = materials[0].name;
    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        const meshes = nodes[i].meshes;
        const meshesLength = meshes.length;
        for (let j = 0; j < meshesLength; ++j) {
            const primitives = meshes[j].primitives;
            const primitivesLength = primitives.length;
            for (let k = 0; k < primitivesLength; ++k) {
                const primitive = primitives[k];
                primitive.material = defaultValue(primitive.material, defaultMaterial);
            }
        }
    }
}

function assignUnnamedMaterial(nodes, materials) {
    // If there is a material that doesn't have a name, assign that
    // material to any primitives whose material is undefined.
    const unnamedMaterial = materials.find(function(material) {
        return material.name.length === 0;
    });

    if (!defined(unnamedMaterial)) {
        return;
    }

    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        const meshes = nodes[i].meshes;
        const meshesLength = meshes.length;
        for (let j = 0; j < meshesLength; ++j) {
            const primitives = meshes[j].primitives;
            const primitivesLength = primitives.length;
            for (let k = 0; k < primitivesLength; ++k) {
                const primitive = primitives[k];
                if (!defined(primitive.material)) {
                    primitive.material = unnamedMaterial.name;
                }
            }
        }
    }
}

function removeEmptyMeshes(meshes) {
    return meshes.filter(function(mesh) {
        // Remove empty primitives
        mesh.primitives = mesh.primitives.filter(function(primitive) {
            return primitive.indices.length > 0 && primitive.positions.length > 0;
        });
        // Valid meshes must have at least one primitive
        return (mesh.primitives.length > 0);
    });
}

function meshesHaveNames(meshes) {
    const meshesLength = meshes.length;
    for (let i = 0; i < meshesLength; ++i) {
        if (defined(meshes[i].name)) {
            return true;
        }
    }
    return false;
}

function removeEmptyNodes(nodes) {
    const final = [];
    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        const node = nodes[i];
        const meshes = removeEmptyMeshes(node.meshes);
        if (meshes.length === 0) {
            continue;
        }
        node.meshes = meshes;
        if (!defined(node.name) && meshesHaveNames(meshes)) {
            // If the obj has groups (g) but not object groups (o) then convert meshes to nodes
            const meshesLength = meshes.length;
            for (let j = 0; j < meshesLength; ++j) {
                const mesh = meshes[j];
                const convertedNode = new Node();
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
    const itemsLength = items.length;
    for (let i = 0; i < itemsLength; ++i) {
        const item = items[i];
        let name = defaultValue(item.name, defaultName);
        const occurrences = usedNames[name];
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
    const usedNames = {};
    setDefaultNames(nodes, 'Node', usedNames);
    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        const node = nodes[i];
        setDefaultNames(node.meshes, node.name + '-Mesh', usedNames);
    }
}

function cleanNodes(nodes) {
    nodes = removeEmptyNodes(nodes);
    setDefaults(nodes);
    return nodes;
}
