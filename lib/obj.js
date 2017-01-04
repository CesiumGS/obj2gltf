'use strict';
var Cesium = require('cesium');
var path = require('path');
var Promise = require('bluebird');
var readline = require('linebyline');
var loadImage = require('./image');
var loadMtl = require('./mtl');

var Cartesian3 = Cesium.Cartesian3;
var combine = Cesium.combine;
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
    this.positions = [];
    this.normals = [];
    this.uvs = [];
}

function Primitive() {
    this.material = undefined;
    this.indices = [];
}

// OBJ regex patterns are modified from ThreeJS (https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/OBJLoader.js)
var vertexPattern = /v( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;                                                      // v float float float
var normalPattern = /vn( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;                                                     // vn float float float
var uvPattern = /vt( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;                                                                               // vt float float
var facePattern1 = /f( +-?\d+)\/?( +-?\d+)\/?( +-?\d+)\/?( +-?\d+)?\/?/;                                                                        // f vertex vertex vertex ...
var facePattern2 = /f( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)?/;                            // f vertex/uv vertex/uv vertex/uv ...
var facePattern3 = /f( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))?/;    // f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...
var facePattern4 = /f( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))?/;                                // f vertex//normal vertex//normal vertex//normal ...

var scratchCartesian = new Cartesian3();

function loadObj(objPath) {
    return new Promise(function(resolve, reject) {
        // Global store of vertex attributes listed in the obj file
        var positions = [];
        var normals = [];
        var uvs = [];

        // The current node, mesh, and primitive
        var node;
        var mesh;
        var primitive;

        var nodes = [];

        // Used to build the indices. The vertex cache is unique to each mesh.
        var vertexCache = {};
        var vertexCount = 0;

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
                primitive = primitives[i];
                if (primitive.material === material) {
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
                var px = positions[pi + 0];
                var py = positions[pi + 1];
                var pz = positions[pi + 2];
                mesh.positions.push(px, py, pz);
            }

            // Normals
            if (defined(n)) {
                var ni = getOffset(n, normals, 3);
                var nx = normals[ni + 0];
                var ny = normals[ni + 1];
                var nz = normals[ni + 2];
                mesh.normals.push(nx, ny, nz);
            }

            // UVs
            if (defined(u)) {
                var ui = getOffset(u, uvs, 2);
                var ux = uvs[ui + 0];
                var uy = uvs[ui + 1];
                mesh.uvs.push(ux, uy);
            }
        }

        function addVertex(v, p, u, n) {
            var index = vertexCache[v];
            if (!defined(index)) {
                index = vertexCount++;
                vertexCache[v] = index;
                createVertex(p, u, n);
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

        // Create a default node in case there are no o/g/usemtl lines in the obj
        addNode();

        var stream = readline(objPath);
        stream.on('line', function (line) {
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
                var px = parseFloat(result[1]);
                var py = parseFloat(result[2]);
                var pz = parseFloat(result[3]);
                positions.push(px, py, pz);
            } else if ((result = normalPattern.exec(line) ) !== null) {
                var nx = parseFloat(result[1]);
                var ny = parseFloat(result[2]);
                var nz = parseFloat(result[3]);
                var normal = Cartesian3.fromElements(nx, ny, nz, scratchCartesian);
                normals.push(normal.x, normal.y, normal.z);
            } else if ((result = uvPattern.exec(line)) !== null) {
                var u = parseFloat(result[1]);
                var v = parseFloat(result[2]);
                v = 1.0 - v; // Flip y so 0.0 is the bottom of the image
                uvs.push(u, v);
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
        });

        stream.on('end', function () {
            finishLoading(nodes, mtlPaths, objPath).then(resolve).catch(reject);
        });

        stream.on('error', reject);
    });
}

function finishLoading(nodes, mtlPaths, objPath) {
    nodes = cleanNodes(nodes);
    if (nodes.length === 0) {
        throw new RuntimeError(objPath + ' does not have any geometry data');
    }
    return loadMaterials(mtlPaths, objPath)
        .then(function(materials) {
            var imagePaths = getImagePaths(materials);
            return loadImages(imagePaths, objPath)
                .then(function(images) {
                    return {
                        nodes : nodes,
                        materials : materials,
                        images : images
                    };
                });
        });
}

function loadMaterials(mtlPaths, objPath) {
    return loadResources(objPath, mtlPaths, loadMtl)
        .then(function(materialsByPath) {
            var materials = {};
            for (var path in materialsByPath) {
                if (materialsByPath.hasOwnProperty(path)) {
                    materials = combine(materials, materialsByPath[path]);
                }
            }
            return materials;
        });
}

function loadImages(imagePaths, objPath) {
    return loadResources(objPath, imagePaths, loadImage);
}

function getImagePaths(materials) {
    var imagePaths = [];
    for (var name in materials) {
        if (materials.hasOwnProperty(name)) {
            var material = materials[name];
            if (defined(material.ambientColorMap) && imagePaths.indexOf(material.ambientColorMap) === -1) {
                imagePaths.push(material.ambientColorMap);
            }
            if (defined(material.diffuseColorMap) && imagePaths.indexOf(material.diffuseColorMap) === -1) {
                imagePaths.push(material.diffuseColorMap);
            }
            if (defined(material.emissionColorMap) && imagePaths.indexOf(material.emissionColorMap) === -1) {
                imagePaths.push(material.emissionColorMap);
            }
            if (defined(material.specularColorMap) && imagePaths.indexOf(material.specularColorMap) === -1) {
                imagePaths.push(material.specularColorMap);
            }
        }
    }
    return imagePaths;
}

function loadResources(objPath, resourcePaths, loadFunction) {
    var resources = {};
    return Promise.map(resourcePaths, function(resourcePath) {
        var absolutePath = resourcePath;
        if (!path.isAbsolute(absolutePath)) {
            absolutePath = path.join(path.dirname(objPath), resourcePath);
        }
        return loadFunction(absolutePath)
            .then(function(resource) {
                resources[resourcePath] = resource;
            });
    }).then(function() {
        return resources;
    });
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
    setDefaultNames(nodes, 'node', usedNames);
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        setDefaultNames(nodes[i].meshes, 'mesh', usedNames);
    }
}

function cleanNodes(nodes) {
    nodes = removeEmptyNodes(nodes);
    setDefaults(nodes);
    return nodes;
}
