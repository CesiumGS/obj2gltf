'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var path = require('path');
var Promise = require('bluebird');
var clone = require('../../lib/clone.js');
var createGltf = require('../../lib/gltf.js');
var loadImage = require('../../lib/image.js');
var loadObj = require('../../lib/obj.js');
var writeUris = require('../../lib/writeUris.js');

var WebGLConstants = Cesium.WebGLConstants;

var fsExtraReadJson = Promise.promisify(fsExtra.readJson);

var boxObjUrl = 'specs/data/box/box.obj';
var groupObjUrl = 'specs/data/box-objects-groups-materials/box-objects-groups-materials.obj';
var boxGltfUrl = 'specs/data/box/box.gltf';
var groupGltfUrl = 'specs/data/box-objects-groups-materials/box-objects-groups-materials.gltf';
var diffuseTextureUrl = 'specs/data/box-textured/cesium.png';
var transparentDiffuseTextureUrl = 'specs/data/box-complex-material/diffuse.png';

describe('gltf', function() {
    var boxObjData;
    var groupObjData;
    var boxGltf;
    var groupGltf;
    var diffuseTexture;
    var transparentDiffuseTexture;

    beforeAll(function(done) {
        return Promise.all([
            loadObj(boxObjUrl)
                .then(function(data) {
                    boxObjData = data;
                }),
            loadObj(groupObjUrl)
                .then(function(data) {
                    groupObjData = data;
                }),
            fsExtraReadJson(boxGltfUrl)
                .then(function(gltf) {
                    boxGltf = gltf;
                }),
            fsExtraReadJson(groupGltfUrl)
                .then(function(gltf) {
                    groupGltf = gltf;
                }),
            loadImage(diffuseTextureUrl)
                .then(function(image) {
                    diffuseTexture = image;
                }),
            loadImage(transparentDiffuseTextureUrl)
                .then(function(image) {
                   transparentDiffuseTexture = image;
                })
        ]).then(done);
    });

    it('simple gltf', function() {
        var objData = clone(boxObjData, true);
        var gltf = createGltf(objData);
        writeUris(gltf, boxGltfUrl, false, false);
        expect(gltf).toEqual(boxGltf);
    });

    it('multiple nodes, meshes, and primitives', function() {
        var objData = clone(groupObjData, true);
        var gltf = createGltf(objData);
        writeUris(gltf, groupGltfUrl, false, false);
        expect(gltf).toEqual(groupGltf);

        expect(Object.keys(gltf.materials).length).toBe(3);
        expect(Object.keys(gltf.nodes).length).toBe(1);
        expect(Object.keys(gltf.meshes).length).toBe(3);

        // Check for two primitives in each mesh
        for (var id in gltf.meshes) {
            if (gltf.meshes.hasOwnProperty(id)) {
                var mesh = gltf.meshes[id];
                expect(mesh.primitives.length).toBe(2);
            }
        }
    });

    it('sets default material values', function() {
        var objData = clone(boxObjData, true);
        objData.materials.Material = {};

        var gltf = createGltf(objData);
        var material = gltf.materials.Material;
        var kmc = material.extensions.KHR_materials_common;
        var values = kmc.values;

        expect(kmc.technique).toBe('LAMBERT');
        expect(values.ambient).toEqual([0.0, 0.0, 0.0, 1]);
        expect(values.diffuse).toEqual([0.5, 0.5, 0.5, 1]);
        expect(values.emission).toEqual([0.0, 0.0, 0.0, 1]);
        expect(values.specular).toEqual([0.0, 0.0, 0.0, 1]);
        expect(values.shininess).toEqual(0.0);
    });

    it('sets material for diffuse texture', function() {
        var objData = clone(boxObjData, true);
        objData.materials.Material = {
            diffuseColorMap : diffuseTextureUrl
        };
        objData.images[diffuseTextureUrl] = diffuseTexture;

        var gltf = createGltf(objData);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;
        var texture = gltf.textures.texture_cesium;
        var image = gltf.images.cesium;

        expect(kmc.technique).toBe('LAMBERT');
        expect(kmc.values.diffuse).toEqual('texture_cesium');
        expect(kmc.values.transparency).toBe(1.0);
        expect(kmc.values.transparent).toBe(false);
        expect(kmc.values.doubleSided).toBe(false);

        expect(texture).toEqual({
            format : WebGLConstants.RGB,
            internalFormat : WebGLConstants.RGB,
            sampler : 'sampler',
            source : 'cesium',
            target : WebGLConstants.TEXTURE_2D,
            type : WebGLConstants.UNSIGNED_BYTE
        });

        expect(image).toBeDefined();
        expect(image.name).toBe('cesium');
        expect(image.extras._obj2gltf.source).toBeDefined();
        expect(image.extras._obj2gltf.extension).toBe('.png');

        expect(gltf.samplers.sampler).toEqual({
            magFilter : WebGLConstants.LINEAR,
            minFilter : WebGLConstants.LINEAR,
            wrapS : WebGLConstants.REPEAT,
            wrapT : WebGLConstants.REPEAT
        });
    });

    it('sets material for alpha less than 1', function() {
        var objData = clone(boxObjData, true);
        objData.materials.Material = {
            alpha : 0.4
        };

        var gltf = createGltf(objData);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 0.4]);
        expect(kmc.values.transparency).toBe(1.0);
        expect(kmc.values.transparent).toBe(true);
        expect(kmc.values.doubleSided).toBe(true);
    });

    it('sets material for diffuse texture and alpha less than 1', function() {
        var objData = clone(boxObjData, true);
        objData.materials.Material = {
            diffuseColorMap : diffuseTextureUrl,
            alpha : 0.4
        };
        objData.images[diffuseTextureUrl] = diffuseTexture;

        var gltf = createGltf(objData);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual('texture_cesium');
        expect(kmc.values.transparency).toBe(0.4);
        expect(kmc.values.transparent).toBe(true);
        expect(kmc.values.doubleSided).toBe(true);
    });

    it('sets material for transparent diffuse texture', function() {
        var objData = clone(boxObjData, true);
        objData.materials.Material = {
            diffuseColorMap : transparentDiffuseTextureUrl
        };
        objData.images[transparentDiffuseTextureUrl] = transparentDiffuseTexture;

        var gltf = createGltf(objData);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toBe('texture_diffuse');
        expect(kmc.values.transparency).toBe(1.0);
        expect(kmc.values.transparent).toBe(true);
        expect(kmc.values.doubleSided).toBe(true);
    });

    it('sets material for specular', function() {
        var objData = clone(boxObjData, true);
        objData.materials.Material = {
            specularColor : [0.1, 0.1, 0.2, 1],
            specularShininess : 0.1
        };

        var gltf = createGltf(objData);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.technique).toBe('PHONG');
        expect(kmc.values.specular).toEqual([0.1, 0.1, 0.2, 1]);
        expect(kmc.values.shininess).toEqual(0.1);
    });

    it('sets constant material when there are no normals', function() {
        var objData = clone(boxObjData, true);
        objData.nodes[0].meshes[0].normals.length = 0;
        objData.materials.Material = {
            diffuseColorMap : diffuseTextureUrl
        };
        objData.images[diffuseTextureUrl] = diffuseTexture;

        var gltf = createGltf(objData);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.technique).toBe('CONSTANT');
        expect(kmc.values.emission).toEqual('texture_cesium');
    });

    it('sets default material when texture is missing', function() {
        var objData = clone(boxObjData, true);
        objData.materials.Material = {
            diffuseColorMap : diffuseTextureUrl
        };

        var gltf = createGltf(objData);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('uses default material (1)', function() {
        var objData = clone(boxObjData, true);
        objData.nodes[0].meshes[0].primitives[0].material = undefined;

        // Creates a material called "default"
        var gltf = createGltf(objData);
        expect(gltf.materials.default).toBeDefined();
        var kmc = gltf.materials.default.extensions.KHR_materials_common;
        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('uses default material (2)', function() {
        var objData = clone(boxObjData, true);
        objData.materials = {};

        // Uses the original name of the material
        var gltf = createGltf(objData);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('handles material used with and without normals', function() {
        // Two meshes - one with normals, and one without
        var objData = clone(boxObjData, true);
        objData.nodes.push(clone(objData.nodes[0], true));
        objData.nodes[1].meshes[0].normals.length = 0;

        var gltf = createGltf(objData);
        var kmc1 = gltf.materials.Material.extensions.KHR_materials_common;
        var kmc2 = gltf.materials.Material_constant.extensions.KHR_materials_common;

        expect(kmc1.technique).toBe('PHONG');
        expect(kmc2.technique).toBe('CONSTANT');

        // Now test in a different order
        objData = clone(boxObjData, true);
        objData.nodes.push(clone(objData.nodes[0], true));
        objData.nodes[0].meshes[0].normals.length = 0;

        gltf = createGltf(objData);
        kmc1 = gltf.materials.Material.extensions.KHR_materials_common;
        kmc2 = gltf.materials.Material_shaded.extensions.KHR_materials_common;

        expect(kmc1.technique).toBe('CONSTANT');
        expect(kmc2.technique).toBe('PHONG');
    });

    it('runs without normals', function() {
        var objData = clone(boxObjData, true);
        objData.nodes[0].meshes[0].normals.length = 0;

        var gltf = createGltf(objData);
        var attributes = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeUndefined();
        expect(attributes.TEXCOORD_0).toBeDefined();
    });

    it('runs without uvs', function() {
        var objData = clone(boxObjData, true);
        objData.nodes[0].meshes[0].uvs.length = 0;

        var gltf = createGltf(objData);
        var attributes = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeDefined();
        expect(attributes.TEXCOORD_0).toBeUndefined();
    });

    it('runs without uvs and normals', function() {
        var objData = clone(boxObjData, true);
        objData.nodes[0].meshes[0].normals.length = 0;
        objData.nodes[0].meshes[0].uvs.length = 0;

        var gltf = createGltf(objData);
        var attributes = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeUndefined();
        expect(attributes.TEXCOORD_0).toBeUndefined();
    });

    function expandObjData(objData, duplicatesLength) {
        var mesh = objData.nodes[0].meshes[0];
        var indices = mesh.primitives[0].indices;
        var positions = mesh.positions;
        var normals = mesh.normals;
        var uvs = mesh.uvs;

        var indicesLength = indices.length;
        var vertexCount = positions.length / 3;

        for (var i = 1; i < duplicatesLength; ++i) {
            for (var j = 0; j < vertexCount; ++j) {
                positions.push(0.0);
                positions.push(0.0);
                positions.push(0.0);
                normals.push(0.0);
                normals.push(0.0);
                normals.push(0.0);
                uvs.push(0.0);
                uvs.push(0.0);
            }
            for (var k = 0; k < indicesLength; ++k) {
                indices.push(indices.get(k) + vertexCount * i);
            }
        }
    }

    it('detects need to use uint32 indices', function() {
        var objData = clone(boxObjData, true);
        expandObjData(objData, 2731); // Right above 65536 limit
        var mesh = objData.nodes[0].meshes[0];
        var indicesLength = mesh.primitives[0].indices.length;
        var vertexCount = mesh.positions.length / 3;

        var gltf = createGltf(objData);
        var primitive = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0];
        var indicesAccessor = gltf.accessors[primitive.indices];
        expect(indicesAccessor.count).toBe(indicesLength);
        expect(indicesAccessor.max[0]).toBe(vertexCount - 1);
        expect(indicesAccessor.componentType).toBe(WebGLConstants.UNSIGNED_INT);

        var positionAccessor = gltf.accessors[primitive.attributes.POSITION];
        expect(positionAccessor.count).toBe(vertexCount);
    });
});
