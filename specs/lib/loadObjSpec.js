'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var loadObj = require('../../lib/loadObj');
var obj2gltf = require('../../lib/obj2gltf');

var clone = Cesium.clone;
var RuntimeError = Cesium.RuntimeError;

var objPath = 'specs/data/box/box.obj';
var objNormalsPath = 'specs/data/box-normals/box-normals.obj';
var objUvsPath = 'specs/data/box-uvs/box-uvs.obj';
var objPositionsOnlyPath = 'specs/data/box-positions-only/box-positions-only.obj';
var objNegativeIndicesPath = 'specs/data/box-negative-indices/box-negative-indices.obj';
var objTrianglesPath = 'specs/data/box-triangles/box-triangles.obj';
var objObjectsPath = 'specs/data/box-objects/box-objects.obj';
var objGroupsPath = 'specs/data/box-groups/box-groups.obj';
var objObjectsGroupsPath = 'specs/data/box-objects-groups/box-objects-groups.obj';
var objUsemtlPath = 'specs/data/box-usemtl/box-usemtl.obj';
var objNoMaterialsPath = 'specs/data/box-no-materials/box-no-materials.obj';
var objMultipleMaterialsPath = 'specs/data/box-multiple-materials/box-multiple-materials.obj';
var objUncleanedPath = 'specs/data/box-uncleaned/box-uncleaned.obj';
var objMtllibPath = 'specs/data/box-mtllib/box-mtllib.obj';
var objMissingMtllibPath = 'specs/data/box-missing-mtllib/box-missing-mtllib.obj';
var objExternalResourcesPath = 'specs/data/box-external-resources/box-external-resources.obj';
var objTexturedPath = 'specs/data/box-textured/box-textured.obj';
var objMissingTexturePath = 'specs/data/box-missing-texture/box-missing-texture.obj';
var objSubdirectoriesPath = 'specs/data/box-subdirectories/box-textured.obj';
var objInvalidContentsPath = 'specs/data/box/box.mtl';
var objConcavePath = 'specs/data/concave/concave.obj';
var objInvalidPath = 'invalid.obj';

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

var options;

describe('loadObj', function() {
    beforeEach(function() {
        options = clone(obj2gltf.defaults);
        options.overridingTextures = {};
        options.logger = function() {};
    });

    it('loads obj with positions, normals, and uvs', function(done) {
        expect(loadObj(objPath, options)
            .then(function(data) {
                var materials = data.materials;
                var nodes = data.nodes;
                var name = data.name;
                var meshes = getMeshes(data);
                var primitives = getPrimitives(data);

                expect(name).toBe('box');
                expect(materials.length).toBe(1);
                expect(nodes.length).toBe(1);
                expect(meshes.length).toBe(1);
                expect(primitives.length).toBe(1);

                var node = nodes[0];
                var mesh = meshes[0];
                var primitive = primitives[0];

                expect(node.name).toBe('Cube');
                expect(mesh.name).toBe('Cube-Mesh');
                expect(mesh.positions.length / 3).toBe(24);
                expect(mesh.normals.length / 3).toBe(24);
                expect(mesh.uvs.length / 2).toBe(24);
                expect(primitive.indices.length).toBe(36);
                expect(primitive.material).toBe('Material');
            }), done).toResolve();
    });

    it('loads obj with normals', function(done) {
        expect(loadObj(objNormalsPath, options)
            .then(function(data) {
                var mesh = getMeshes(data)[0];
                expect(mesh.positions.length / 3).toBe(24);
                expect(mesh.normals.length / 3).toBe(24);
                expect(mesh.uvs.length / 2).toBe(0);
            }), done).toResolve();
    });

    it('loads obj with uvs', function(done) {
        expect(loadObj(objUvsPath, options)
            .then(function(data) {
                var mesh = getMeshes(data)[0];
                expect(mesh.positions.length / 3).toBe(20);
                expect(mesh.normals.length / 3).toBe(0);
                expect(mesh.uvs.length / 2).toBe(20);
            }), done).toResolve();
    });

    it('loads obj with negative indices', function(done) {
        expect(Promise.all([
            loadObj(objPositionsOnlyPath, options),
            loadObj(objNegativeIndicesPath, options)
        ])
            .then(function(results) {
                var positionsReference = getMeshes(results[0])[0].positions.toFloatBuffer();
                var positions = getMeshes(results[1])[0].positions.toFloatBuffer();
                expect(positions).toEqual(positionsReference);
            }), done).toResolve();
    });

    it('loads obj with triangle faces', function(done) {
        expect(loadObj(objTrianglesPath, options)
            .then(function(data) {
                var mesh = getMeshes(data)[0];
                var primitive = getPrimitives(data)[0];
                expect(mesh.positions.length / 3).toBe(24);
                expect(primitive.indices.length).toBe(36);
            }), done).toResolve();
    });

    it('loads obj with objects', function(done) {
        expect(loadObj(objObjectsPath, options)
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
        expect(loadObj(objGroupsPath, options)
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
        expect(loadObj(objObjectsGroupsPath, options)
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
        expect(loadObj(objConcavePath, options)
            .then(function(data) {
                var mesh = getMeshes(data)[0];
                var primitive = getPrimitives(data)[0];
                expect(mesh.positions.length / 3).toBe(30);
                expect(primitive.indices.length).toBe(48);
            }), done).toResolve();
    });

    it('loads obj with usemtl only', function(done) {
        expect(loadObj(objUsemtlPath, options)
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
        expect(loadObj(objNoMaterialsPath, options)
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
        expect(loadObj(objMultipleMaterialsPath, options)
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
            }), done).toResolve();
    });

    it('loads obj uncleaned', function(done) {
        // Obj with extraneous o, g, and usemtl lines
        // Also tests handling of o and g lines with the same names
        expect(loadObj(objUncleanedPath, options)
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
        expect(loadObj(objMtllibPath, options)
            .then(function(data) {
                var materials = data.materials;
                expect(materials.length).toBe(3);

                // .mtl files are loaded in an arbitrary order, so sort for testing purposes
                materials.sort(function(a, b){
                    return a.name.localeCompare(b.name);
                });

                expect(materials[0].name).toBe('Blue');
                expect(materials[0].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.0, 0.64, 1.0]);
                expect(materials[1].name).toBe('Green');
                expect(materials[1].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.64, 0.0, 1.0]);
                expect(materials[2].name).toBe('Red');
                expect(materials[2].pbrMetallicRoughness.baseColorFactor).toEqual([0.64, 0.0, 0.0, 1.0]);
            }), done).toResolve();
    });

    it('loads obj with missing mtllib', function(done) {
        var spy = jasmine.createSpy('logger');
        options.logger = spy;

        expect(loadObj(objMissingMtllibPath, options)
            .then(function(data) {
                expect(data.materials.length).toBe(0);
                expect(spy.calls.argsFor(0)[0].indexOf('Could not read mtl file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads .mtl outside of the obj directory', function(done) {
        expect(loadObj(objExternalResourcesPath, options)
            .then(function(data) {
                var materials = data.materials;
                expect(materials.length).toBe(2);

                // .mtl files are loaded in an arbitrary order, so find the "MaterialTextured" material
                var materialTextured = materials[0].name === 'MaterialTextured' ? materials[0] : materials[1];
                var baseColorTexture = materialTextured.pbrMetallicRoughness.baseColorTexture;
                expect(baseColorTexture.source).toBeDefined();
                expect(baseColorTexture.name).toEqual('cesium');
            }), done).toResolve();
    });

    it('does not load .mtl outside of the obj directory when secure is true', function(done) {
        var spy = jasmine.createSpy('logger');
        options.logger = spy;
        options.secure = true;

        expect(loadObj(objExternalResourcesPath, options)
            .then(function(data) {
                expect(data.materials.length).toBe(1); // obj references 2 materials, one of which is outside the input directory
                expect(spy.calls.argsFor(0)[0].indexOf('Could not read mtl file') >= 0).toBe(true);
                expect(spy.calls.argsFor(1)[0].indexOf('Could not read texture file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads obj with texture', function(done) {
        expect(loadObj(objTexturedPath, options)
            .then(function(data) {
                var baseColorTexture = data.materials[0].pbrMetallicRoughness.baseColorTexture;
                expect(baseColorTexture.name).toBe('cesium');
                expect(baseColorTexture.source).toBeDefined();
            }), done).toResolve();
    });

    it('loads obj with missing texture', function(done) {
        var spy = jasmine.createSpy('logger');
        options.logger = spy;

        expect(loadObj(objMissingTexturePath, options)
            .then(function(data) {
                var baseColorTexture = data.materials[0].pbrMetallicRoughness.baseColorTexture;
                expect(baseColorTexture).toBeUndefined();
                expect(spy.calls.argsFor(0)[0].indexOf('Could not read texture file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads obj with subdirectories', function(done) {
        expect(loadObj(objSubdirectoriesPath, options)
            .then(function(data) {
                var baseColorTexture = data.materials[0].pbrMetallicRoughness.baseColorTexture;
                expect(baseColorTexture.name).toBe('cesium');
                expect(baseColorTexture.source).toBeDefined();
            }), done).toResolve();
    });

    it('throws when file has invalid contents', function(done) {
        expect(loadObj(objInvalidContentsPath, options), done).toRejectWith(RuntimeError);
    });

    it('throw when reading invalid file', function(done) {
        expect(loadObj(objInvalidPath, options), done).toRejectWith(Error);
    });
});
