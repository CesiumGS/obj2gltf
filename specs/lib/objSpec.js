'use strict';
var Cesium = require('cesium');
var path = require('path');
var Promise = require('bluebird');
var loadObj = require('../../lib/obj.js');

var RuntimeError = Cesium.RuntimeError;

var objUrl = 'specs/data/box/box.obj';
var objNormalsUrl = 'specs/data/box-normals/box-normals.obj';
var objUvsUrl = 'specs/data/box-uvs/box-uvs.obj';
var objPositionsOnlyUrl = 'specs/data/box-positions-only/box-positions-only.obj';
var objNegativeIndicesUrl = 'specs/data/box-negative-indices/box-negative-indices.obj';
var objTrianglesUrl = 'specs/data/box-triangles/box-triangles.obj';
var objObjectsUrl = 'specs/data/box-objects/box-objects.obj';
var objGroupsUrl = 'specs/data/box-groups/box-groups.obj';
var objObjectsGroupsUrl = 'specs/data/box-objects-groups/box-objects-groups.obj';
var objUsemtlUrl = 'specs/data/box-usemtl/box-usemtl.obj';
var objNoMaterialsUrl = 'specs/data/box-no-materials/box-no-materials.obj';
var objMultipleMaterialsUrl = 'specs/data/box-multiple-materials/box-multiple-materials.obj';
var objUncleanedUrl = 'specs/data/box-uncleaned/box-uncleaned.obj';
var objMtllibUrl = 'specs/data/box-mtllib/box-mtllib.obj';
var objMissingMtllibUrl = 'specs/data/box-missing-mtllib/box-missing-mtllib.obj';
var objExternalResourcesUrl = 'specs/data/box-external-resources/box-external-resources.obj';
var objTexturedUrl = 'specs/data/box-textured/box-textured.obj';
var objMissingTextureUrl = 'specs/data/box-missing-texture/box-missing-texture.obj';
var objSubdirectoriesUrl = 'specs/data/box-subdirectories/box-textured.obj';
var objComplexMaterialUrl = 'specs/data/box-complex-material/box-complex-material.obj';
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

describe('obj', function() {
    it('loads obj with positions, normals, and uvs', function(done) {
        expect(loadObj(objUrl)
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
                expect(mesh.positions.length / 3).toBe(24);
                expect(mesh.normals.length / 3).toBe(24);
                expect(mesh.uvs.length / 2).toBe(24);
                expect(primitive.indices.length).toBe(36);
                expect(primitive.material).toBe('Material');
            }), done).toResolve();
    });

    it('loads obj with normals', function(done) {
        expect(loadObj(objNormalsUrl)
            .then(function(data) {
                var mesh = getMeshes(data)[0];
                expect(mesh.positions.length / 3).toBe(24);
                expect(mesh.normals.length / 3).toBe(24);
                expect(mesh.uvs.length / 2).toBe(0);
            }), done).toResolve();
    });

    it('loads obj with uvs', function(done) {
        expect(loadObj(objUvsUrl)
            .then(function(data) {
                var mesh = getMeshes(data)[0];
                expect(mesh.positions.length / 3).toBe(20);
                expect(mesh.normals.length / 3).toBe(0);
                expect(mesh.uvs.length / 2).toBe(20);
            }), done).toResolve();
    });

    it('loads obj with negative indices', function(done) {
        expect(Promise.all([
            loadObj(objPositionsOnlyUrl),
            loadObj(objNegativeIndicesUrl)
        ])
            .then(function(results) {
                var positionsReference = getMeshes(results[0])[0].positions.toFloatBuffer();
                var positions = getMeshes(results[1])[0].positions.toFloatBuffer();
                expect(positions).toEqual(positionsReference);
            }), done).toResolve();
    });

    it('loads obj with triangle faces', function(done) {
        expect(loadObj(objTrianglesUrl)
            .then(function(data) {
                var mesh = getMeshes(data)[0];
                var primitive = getPrimitives(data)[0];
                expect(mesh.positions.length / 3).toBe(24);
                expect(primitive.indices.length).toBe(36);
            }), done).toResolve();
    });

    it('loads obj with objects', function(done) {
        expect(loadObj(objObjectsUrl)
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
        expect(loadObj(objGroupsUrl)
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
        expect(loadObj(objObjectsGroupsUrl)
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

    it('loads obj with usemtl only', function(done) {
        expect(loadObj(objUsemtlUrl)
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
        expect(loadObj(objNoMaterialsUrl)
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
        expect(loadObj(objMultipleMaterialsUrl)
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
        expect(loadObj(objUncleanedUrl)
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
        expect(loadObj(objMtllibUrl)
            .then(function(data) {
                var materials = data.materials;
                expect(Object.keys(materials).length).toBe(3);
                expect(materials.Red.diffuseColor).toEqual([0.64, 0.0, 0.0, 1.0]);
                expect(materials.Green.diffuseColor).toEqual([0.0, 0.64, 0.0, 1.0]);
                expect(materials.Blue.diffuseColor).toEqual([0.0, 0.0, 0.64, 1.0]);
            }), done).toResolve();
    });

    it('loads obj with missing mtllib', function(done) {
        spyOn(console, 'log');
        expect(loadObj(objMissingMtllibUrl)
            .then(function(data) {
                expect(data.materials).toEqual({});
                expect(console.log.calls.argsFor(0)[0].indexOf('Could not read mtl file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads resources outside of the obj directory', function(done) {
        expect(loadObj(objExternalResourcesUrl)
            .then(function(data) {
                var imagePath = getImagePath(objTexturedUrl, 'cesium.png');
                expect(data.images[imagePath]).toBeDefined();
                expect(data.materials.MaterialTextured.diffuseColorMap).toEqual(imagePath);
            }), done).toResolve();
    });

    it('does not load resources outside of the obj directory when secure is true', function(done) {
        spyOn(console, 'log');
        var options = {
            secure : true
        };
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
        expect(loadObj(objTexturedUrl)
            .then(function(data) {
                var imagePath = getImagePath(objTexturedUrl, 'cesium.png');
                expect(data.images[imagePath]).toBeDefined();
                expect(data.materials.Material.diffuseColorMap).toEqual(imagePath);
            }), done).toResolve();
    });

    it('loads obj with missing texture', function(done) {
        spyOn(console, 'log');
        expect(loadObj(objMissingTextureUrl)
            .then(function(data) {
                var imagePath = getImagePath(objMissingTextureUrl, 'cesium.png');
                expect(data.images[imagePath]).toBeUndefined();
                expect(data.materials.Material.diffuseColorMap).toEqual(imagePath);
                expect(console.log.calls.argsFor(0)[0].indexOf('Could not read image file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads obj with subdirectories', function(done) {
        expect(loadObj(objSubdirectoriesUrl)
            .then(function(data) {
                var imagePath = getImagePath(objSubdirectoriesUrl, path.join('materials', 'images', 'cesium.png'));
                expect(data.images[imagePath]).toBeDefined();
                expect(data.materials.Material.diffuseColorMap).toEqual(imagePath);
            }), done).toResolve();
    });

    it('loads obj with complex material', function(done) {
        expect(loadObj(objComplexMaterialUrl)
            .then(function(data) {
                var images = data.images;
                expect(Object.keys(images).length).toBe(4); // Only ambient, diffuse, emission, and specular maps are supported by the converter
            }), done).toResolve();
    });

    it('does not process file with invalid contents', function(done) {
        expect(loadObj(objInvalidContentsUrl), done).toRejectWith(RuntimeError);
    });

    it('throw when reading invalid file', function(done) {
        expect(loadObj(objInvalidUrl), done).toRejectWith(Error);
    });
});
