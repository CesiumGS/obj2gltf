'use strict';
var Cesium = require('cesium');
var path = require('path');
var Promise = require('bluebird');
var loadObj = require('../../lib/loadObj');
var obj2gltf = require('../../lib/obj2gltf');

var Cartesian3 = Cesium.Cartesian3;
var clone = Cesium.clone;
var CesiumMath = Cesium.Math;
var RuntimeError = Cesium.RuntimeError;

var objUrl = 'specs/data/box/box.obj';
var objRotatedUrl = 'specs/data/box-rotated/box-rotated.obj';
var objNormalsUrl = 'specs/data/box-normals/box-normals.obj';
var objUvsUrl = 'specs/data/box-uvs/box-uvs.obj';
var objPositionsOnlyUrl = 'specs/data/box-positions-only/box-positions-only.obj';
var objNegativeIndicesUrl = 'specs/data/box-negative-indices/box-negative-indices.obj';
var objTrianglesUrl = 'specs/data/box-triangles/box-triangles.obj';
var objObjectsUrl = 'specs/data/box-objects/box-objects.obj';
var objGroupsUrl = 'specs/data/box-groups/box-groups.obj';
var objObjectsGroupsUrl = 'specs/data/box-objects-groups/box-objects-groups.obj';
var objConcaveUrl = 'specs/data/concave/concave.obj';
var objUnnormalizedUrl = 'specs/data/box-unnormalized/box-unnormalized.obj';
var objUsemtlUrl = 'specs/data/box-usemtl/box-usemtl.obj';
var objNoMaterialsUrl = 'specs/data/box-no-materials/box-no-materials.obj';
var objMultipleMaterialsUrl = 'specs/data/box-multiple-materials/box-multiple-materials.obj';
var objUncleanedUrl = 'specs/data/box-uncleaned/box-uncleaned.obj';
var objMtllibUrl = 'specs/data/box-mtllib/box-mtllib.obj';
var objMissingMtllibUrl = 'specs/data/box-missing-mtllib/box-missing-mtllib.obj';
var objMissingUsemtlUrl = 'specs/data/box-missing-usemtl/box-missing-usemtl.obj';
var objExternalResourcesUrl = 'specs/data/box-external-resources/box-external-resources.obj';
var objTexturedUrl = 'specs/data/box-textured/box-textured.obj';
var objMissingTextureUrl = 'specs/data/box-missing-texture/box-missing-texture.obj';
var objSubdirectoriesUrl = 'specs/data/box-subdirectories/box-textured.obj';
var objWindowsPathsUrl = 'specs/data/box-windows-paths/box-windows-paths.obj';
var objComplexMaterialUrl = 'specs/data/box-complex-material/box-complex-material.obj';
var objMixedAttributesUrl = 'specs/data/box-mixed-attributes/box-mixed-attributes.obj';
var objInvalidContentsUrl = 'specs/data/box/box.mtl';
var objInvalidUrl = 'invalid.obj';

function getMeshes(data) {
    var meshes = [];
    var nodes = data.nodes;
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        meshes = meshes.concat(nodes[i].meshes);
    }
    return meshes;
}

function getPrimitives(data) {
    var primitives = [];
    var nodes = data.nodes;
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        var meshes = nodes[i].meshes;
        var meshesLength = meshes.length;
        for (var j = 0; j < meshesLength; ++j) {
            primitives = primitives.concat(meshes[j].primitives);
        }
    }
    return primitives;
}

function getImagePath(objPath, relativePath) {
    return path.normalize(path.join(path.dirname(objPath), relativePath));
}

var defaultOptions = obj2gltf.defaults;

describe('loadObj', function() {
    beforeEach(function() {
        spyOn(console, 'log');
    });

    it('loads obj with positions, normals, and uvs', function(done) {
        expect(loadObj(objUrl, defaultOptions)
            .then(function(data) {
                var images = data.images;
                var materials = data.materials;
                var nodes = data.nodes;
                var meshes = getMeshes(data);
                var primitives = getPrimitives(data);

                expect(Object.keys(images).length).toBe(0);
                expect(materials.Material).toBeDefined();
                expect(nodes.length).toBe(1);
                expect(meshes.length).toBe(1);
                expect(primitives.length).toBe(1);

                var node = nodes[0];
                var mesh = meshes[0];
                var primitive = primitives[0];

                expect(node.name).toBe('Cube');
                expect(mesh.name).toBe('Cube-Mesh');
                expect(primitive.positions.length / 3).toBe(24);
                expect(primitive.normals.length / 3).toBe(24);
                expect(primitive.uvs.length / 2).toBe(24);
                expect(primitive.indices.length).toBe(36);
                expect(primitive.material).toBe('Material');
            }), done).toResolve();
    });

    it('loads obj with normals', function(done) {
        expect(loadObj(objNormalsUrl, defaultOptions)
            .then(function(data) {
                var primitive = getPrimitives(data)[0];
                expect(primitive.positions.length / 3).toBe(24);
                expect(primitive.normals.length / 3).toBe(24);
                expect(primitive.uvs.length / 2).toBe(0);
            }), done).toResolve();
    });

    it('normalizes normals', function(done) {
        expect(loadObj(objUnnormalizedUrl, defaultOptions)
            .then(function(data) {
                var scratchNormal = new Cesium.Cartesian3();
                var mesh = getMeshes(data)[0];
                var normals = mesh.normals;
                var normalsLength = normals.length / 3;
                for (var i = 0; i < normalsLength; ++i) {
                    var normalX = normals.get(i * 3);
                    var normalY = normals.get(i * 3 + 1);
                    var normalZ = normals.get(i * 3 + 2);
                    var normal = Cartesian3.fromElements(normalX, normalY, normalZ, scratchNormal);
                    expect(Cartesian3.magnitude(normal)).toEqualEpsilon(1.0, CesiumMath.EPSILON5);
                }
            }), done).toResolve();
    });

    it('loads obj with uvs', function(done) {
        expect(loadObj(objUvsUrl, defaultOptions)
            .then(function(data) {
                var primitive = getPrimitives(data)[0];
                expect(primitive.positions.length / 3).toBe(20);
                expect(primitive.normals.length / 3).toBe(0);
                expect(primitive.uvs.length / 2).toBe(20);
            }), done).toResolve();
    });

    it('loads obj with negative indices', function(done) {
        expect(Promise.all([
            loadObj(objPositionsOnlyUrl, defaultOptions),
            loadObj(objNegativeIndicesUrl, defaultOptions)
        ])
            .then(function(results) {
                var positionsReference = getPrimitives(results[0])[0].positions.toFloatBuffer();
                var positions = getPrimitives(results[1])[0].positions.toFloatBuffer();
                expect(positions).toEqual(positionsReference);
            }), done).toResolve();
    });

    it('loads obj with triangle faces', function(done) {
        expect(loadObj(objTrianglesUrl, defaultOptions)
            .then(function(data) {
                var primitive = getPrimitives(data)[0];
                expect(primitive.positions.length / 3).toBe(24);
                expect(primitive.indices.length).toBe(36);
            }), done).toResolve();
    });

    it('loads obj with objects', function(done) {
        expect(loadObj(objObjectsUrl, defaultOptions)
            .then(function(data) {
                var nodes = data.nodes;
                expect(nodes.length).toBe(3);
                expect(nodes[0].name).toBe('CubeBlue');
                expect(nodes[1].name).toBe('CubeGreen');
                expect(nodes[2].name).toBe('CubeRed');

                var primitives = getPrimitives(data);
                expect(primitives.length).toBe(3);
                expect(primitives[0].material).toBe('Blue');
                expect(primitives[1].material).toBe('Green');
                expect(primitives[2].material).toBe('Red');
            }), done).toResolve();
    });

    it('loads obj with groups', function(done) {
        expect(loadObj(objGroupsUrl, defaultOptions)
            .then(function(data) {
                var nodes = data.nodes;
                expect(nodes.length).toBe(3);
                expect(nodes[0].name).toBe('CubeBlue');
                expect(nodes[1].name).toBe('CubeGreen');
                expect(nodes[2].name).toBe('CubeRed');

                var primitives = getPrimitives(data);
                expect(primitives.length).toBe(3);
                expect(primitives[0].material).toBe('Blue');
                expect(primitives[1].material).toBe('Green');
                expect(primitives[2].material).toBe('Red');
            }), done).toResolve();
    });

    it('loads obj with objects and groups', function(done) {
        expect(loadObj(objObjectsGroupsUrl, defaultOptions)
            .then(function(data) {
                var nodes = data.nodes;
                expect(nodes.length).toBe(3);
                expect(nodes[0].name).toBe('CubeBlue');
                expect(nodes[1].name).toBe('CubeGreen');
                expect(nodes[2].name).toBe('CubeRed');

                var meshes = getMeshes(data);
                expect(meshes.length).toBe(3);
                expect(meshes[0].name).toBe('CubeBlue_CubeBlue_Blue');
                expect(meshes[1].name).toBe('CubeGreen_CubeGreen_Green');
                expect(meshes[2].name).toBe('CubeRed_CubeRed_Red');

                var primitives = getPrimitives(data);
                expect(primitives.length).toBe(3);
                expect(primitives[0].material).toBe('Blue');
                expect(primitives[1].material).toBe('Green');
                expect(primitives[2].material).toBe('Red');
            }), done).toResolve();
    });

    it('loads obj with concave face containing 5 vertices', function(done) {
        expect(loadObj(objConcaveUrl, defaultOptions)
            .then(function(data) {
                var primitive = getPrimitives(data)[0];
                expect(primitive.positions.length / 3).toBe(30);
                expect(primitive.indices.length).toBe(48);
            }), done).toResolve();
    });

    it('loads obj with usemtl only', function(done) {
        expect(loadObj(objUsemtlUrl, defaultOptions)
            .then(function(data) {
                var nodes = data.nodes;
                expect(nodes.length).toBe(1);
                expect(nodes[0].name).toBe('Node'); // default name

                var meshes = getMeshes(data);
                expect(meshes.length).toBe(1);
                expect(meshes[0].name).toBe('Node-Mesh');

                var primitives = getPrimitives(data);
                expect(primitives.length).toBe(3);
                expect(primitives[0].material).toBe('Blue');
                expect(primitives[1].material).toBe('Green');
                expect(primitives[2].material).toBe('Red');
            }), done).toResolve();
    });

    it('loads obj with no materials', function(done) {
        expect(loadObj(objNoMaterialsUrl, defaultOptions)
            .then(function(data) {
                var nodes = data.nodes;
                expect(nodes.length).toBe(1);
                expect(nodes[0].name).toBe('Node'); // default name

                var primitives = getPrimitives(data);
                expect(primitives.length).toBe(1);
            }), done).toResolve();
    });

    it('loads obj with multiple materials', function(done) {
        // The usemtl markers are interleaved, but should condense to just three primitives
        expect(loadObj(objMultipleMaterialsUrl, defaultOptions)
            .then(function(data) {
                var nodes = data.nodes;
                expect(nodes.length).toBe(1);

                var primitives = getPrimitives(data);
                expect(primitives.length).toBe(3);

                expect(primitives[0].indices.length).toBe(12);
                expect(primitives[1].indices.length).toBe(12);
                expect(primitives[2].indices.length).toBe(12);
                expect(primitives[0].material).toBe('Red');
                expect(primitives[1].material).toBe('Green');
                expect(primitives[2].material).toBe('Blue');

                for (var i = 0; i < 3; ++i) {
                    var indices = primitives[i].indices;
                    for (var j = 0; j < indices.length; ++j) {
                        expect(indices.get(j)).toBeLessThan(8);
                    }
                }
            }), done).toResolve();
    });

    it('loads obj uncleaned', function(done) {
        // Obj with extraneous o, g, and usemtl lines
        // Also tests handling of o and g lines with the same names
        expect(loadObj(objUncleanedUrl, defaultOptions)
            .then(function(data) {
                var nodes = data.nodes;
                var meshes = getMeshes(data);
                var primitives = getPrimitives(data);

                expect(nodes.length).toBe(1);
                expect(meshes.length).toBe(1);
                expect(primitives.length).toBe(1);

                expect(nodes[0].name).toBe('Cube');
                expect(meshes[0].name).toBe('Cube_1');
            }), done).toResolve();
    });

    it('loads obj with multiple mtllibs', function(done) {
        expect(loadObj(objMtllibUrl, defaultOptions)
            .then(function(data) {
                var materials = data.materials;
                expect(Object.keys(materials).length).toBe(3);
                expect(materials.Red.diffuseColor).toEqual([0.64, 0.0, 0.0, 1.0]);
                expect(materials.Green.diffuseColor).toEqual([0.0, 0.64, 0.0, 1.0]);
                expect(materials.Blue.diffuseColor).toEqual([0.0, 0.0, 0.64, 1.0]);
            }), done).toResolve();
    });

    it('loads obj with missing mtllib', function(done) {
        expect(loadObj(objMissingMtllibUrl, defaultOptions)
            .then(function(data) {
                expect(data.materials).toEqual({});
                expect(console.log.calls.argsFor(0)[0].indexOf('Could not read mtl file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads obj with missing usemtl', function(done) {
        expect(loadObj(objMissingUsemtlUrl, defaultOptions)
            .then(function(data) {
                expect(data.materials.length).toBe(1);
                expect(data.nodes[0].meshes[0].primitives[0].material).toBe('Material');
            }), done).toResolve();
    });

    it('loads resources outside of the obj directory', function(done) {
        expect(loadObj(objExternalResourcesUrl, defaultOptions)
            .then(function(data) {
                var imagePath = getImagePath(objTexturedUrl, 'cesium.png');
                expect(data.images[imagePath]).toBeDefined();
                expect(data.materials.MaterialTextured.diffuseTexture).toEqual(imagePath);
            }), done).toResolve();
    });

    it('does not load resources outside of the obj directory when secure is true', function(done) {
        var options = clone(defaultOptions);
        options.secure = true;

        expect(loadObj(objExternalResourcesUrl, options)
            .then(function(data) {
                var imagePath = getImagePath(objMissingTextureUrl, 'cesium.png');
                expect(data.images[imagePath]).toBeUndefined();
                expect(data.materials.MaterialTextured).toBeDefined();
                expect(data.materials.Material).toBeUndefined(); // Not in directory, so not included
                expect(console.log.calls.argsFor(0)[0].indexOf('Could not read mtl file') >= 0).toBe(true);
                expect(console.log.calls.argsFor(1)[0].indexOf('Could not read image file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads obj with texture', function(done) {
        expect(loadObj(objTexturedUrl, defaultOptions)
            .then(function(data) {
                var imagePath = getImagePath(objTexturedUrl, 'cesium.png');
                expect(data.images[imagePath]).toBeDefined();
                expect(data.materials.Material.diffuseTexture).toEqual(imagePath);
            }), done).toResolve();
    });

    it('loads obj with missing texture', function(done) {
        expect(loadObj(objMissingTextureUrl, defaultOptions)
            .then(function(data) {
                var imagePath = getImagePath(objMissingTextureUrl, 'cesium.png');
                expect(data.images[imagePath]).toBeUndefined();
                expect(data.materials.Material.diffuseTexture).toEqual(imagePath);
                expect(console.log.calls.argsFor(0)[0].indexOf('Could not read image file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads obj with subdirectories', function(done) {
        expect(loadObj(objSubdirectoriesUrl, defaultOptions)
            .then(function(data) {
                var imagePath = getImagePath(objSubdirectoriesUrl, path.join('materials', 'images', 'cesium.png'));
                expect(data.images[imagePath]).toBeDefined();
                expect(data.materials.Material.diffuseTexture).toEqual(imagePath);
            }), done).toResolve();
    });

    it('loads obj with windows paths', function(done) {
        expect(loadObj(objWindowsPathsUrl, defaultOptions)
            .then(function(data) {
                var imagePath = getImagePath(objWindowsPathsUrl, path.join('materials', 'images', 'cesium.png'));
                expect(data.images[imagePath]).toBeDefined();
                expect(data.materials.Material.diffuseTexture).toEqual(imagePath);
            }), done).toResolve();
    });

    it('loads obj with complex material', function(done) {
        expect(loadObj(objComplexMaterialUrl, defaultOptions)
            .then(function(data) {
                var images = data.images;
                expect(Object.keys(images).length).toBe(4); // Only ambient, diffuse, emission, and specular maps are supported by the converter
            }), done).toResolve();
    });

    function getFirstPosition(data) {
        var positions = data.nodes[0].meshes[0].primitives[0].positions;
        return new Cartesian3(positions.get(0), positions.get(1), positions.get(2));
    }

    function getFirstNormal(data) {
        var normals = data.nodes[0].meshes[0].primitives[0].normals;
        return new Cartesian3(normals.get(0), normals.get(1), normals.get(2));
    }

    function checkAxisConversion(inputUpAxis, outputUpAxis, position, normal) {
        var sameAxis = (inputUpAxis === outputUpAxis);
        var options = clone(defaultOptions);
        options.inputUpAxis = inputUpAxis;
        options.outputUpAxis = outputUpAxis;
        return loadObj(objRotatedUrl, options)
            .then(function(data) {
                var rotatedPosition = getFirstPosition(data);
                var rotatedNormal = getFirstNormal(data);
                if (sameAxis) {
                    expect(rotatedPosition).toEqual(position);
                    expect(rotatedNormal).toEqual(normal);
                } else {
                    expect(rotatedPosition).not.toEqual(position);
                    expect(rotatedNormal).not.toEqual(normal);
                }
            });
    }

    it('performs up axis conversion', function(done) {
        expect(loadObj(objRotatedUrl, defaultOptions)
            .then(function(data) {
                var position = getFirstPosition(data);
                var normal = getFirstNormal(data);

                var axes = ['X', 'Y', 'Z'];
                var axesLength = axes.length;
                var promises = [];
                for (var i = 0; i < axesLength; ++i) {
                    for (var j = 0; j < axesLength; ++j) {
                        promises.push(checkAxisConversion(axes[i], axes[j], position, normal));
                    }
                }
                return Promise.all(promises);
            }), done).toResolve();
    });

    it('separates faces that don\'t use the same attributes as other faces in the primitive', function(done) {
        expect(loadObj(objMixedAttributesUrl, defaultOptions)
            .then(function(data) {
                var primitives = getPrimitives(data);
                expect(primitives.length).toBe(4);
                expect(primitives[0].indices.length).toBe(18); // 6 faces
                expect(primitives[1].indices.length).toBe(6); // 2 faces
                expect(primitives[2].indices.length).toBe(6); // 2 faces
                expect(primitives[3].indices.length).toBe(6); // 2 faces
            }), done).toResolve();
    });

    it('throws when file has invalid contents', function(done) {
        expect(loadObj(objInvalidContentsUrl, defaultOptions), done).toRejectWith(RuntimeError);
    });

    it('throw when reading invalid file', function(done) {
        expect(loadObj(objInvalidUrl, defaultOptions), done).toRejectWith(Error);
    });
});
