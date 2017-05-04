'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var path = require('path');
var Promise = require('bluebird');
var obj2gltf = require('../../lib/obj2gltf');
var createGltf = require('../../lib/createGltf');
var loadImage = require('../../lib/loadImage');
var loadObj = require('../../lib/loadObj');
var Material = require('../../lib/Material');
var writeUris = require('../../lib/writeUris');

var clone = Cesium.clone;
var WebGLConstants = Cesium.WebGLConstants;

var fsExtraReadJson = Promise.promisify(fsExtra.readJson);

var boxObjUrl = 'specs/data/box/box.obj';
var groupObjUrl = 'specs/data/box-objects-groups-materials/box-objects-groups-materials.obj';
var boxGltfUrl = 'specs/data/box/box.gltf';
var groupGltfUrl = 'specs/data/box-objects-groups-materials/box-objects-groups-materials.gltf';
var diffuseTextureUrl = 'specs/data/box-textured/cesium.png';
var transparentDiffuseTextureUrl = 'specs/data/box-complex-material/diffuse.png';

var defaultOptions = obj2gltf.defaults;
var checkTransparencyOptions = clone(defaultOptions);
checkTransparencyOptions.checkTransparency = true;

function setDefaultMaterial(objData) {
    var originalMaterial = objData.materials[0];
    var defaultMaterial = new Material();
    defaultMaterial.name = originalMaterial.name;
    objData.materials[0] = defaultMaterial;
    return defaultMaterial;
}

describe('createGltf', function() {
    var boxObjData;
    var groupObjData;
    var boxGltf;
    var groupGltf;
    var diffuseTexture;
    var transparentDiffuseTexture;

    beforeEach(function(done) {
        return Promise.all([
            loadObj(boxObjUrl, defaultOptions)
                .then(function(data) {
                    boxObjData = data;
                }),
            loadObj(groupObjUrl, defaultOptions)
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
            loadImage(diffuseTextureUrl, defaultOptions)
                .then(function(image) {
                    diffuseTexture = image;
                }),
            loadImage(transparentDiffuseTextureUrl, checkTransparencyOptions)
                .then(function(image) {
                   transparentDiffuseTexture = image;
                })
        ]).then(done);
    });

    it('simple gltf', function(done) {
        var gltf = createGltf(boxObjData, defaultOptions);
        expect(writeUris(gltf, boxGltfUrl, path.dirname(boxGltfUrl), defaultOptions)
            .then(function() {
                expect(gltf).toEqual(boxGltf);
            }), done).toResolve();
    });

    it('multiple nodes, meshes, and primitives', function(done) {
        var gltf = createGltf(groupObjData, defaultOptions);

        expect(writeUris(gltf, groupGltfUrl, path.dirname(groupGltfUrl), defaultOptions)
            .then(function() {
                expect(gltf).toEqual(groupGltf);
                expect(gltf.materials.length).toBe(3);
                expect(gltf.nodes.length).toBe(4);
                expect(gltf.nodes[0].mesh).toBeUndefined();
                expect(gltf.nodes[0].children.length).toBe(3);
                expect(gltf.meshes.length).toBe(3);

                // Check for two primitives in each mesh
                var length = gltf.meshes.length;
                for (var i = 0; i < length; ++i) {
                    var mesh = gltf.meshes[i];
                    expect(mesh.primitives.length).toBe(2);
                }
            }), done).toResolve();
    });

    it('sets default material values', function() {
        // Will convert traditional material to metallic-roughness
        setDefaultMaterial(boxObjData);

        var gltf = createGltf(boxObjData, defaultOptions);
        var material = gltf.materials[0];
        var pbr = material.pbrMetallicRoughness;
        expect(pbr.baseColorTexture).toBeUndefined();
        expect(pbr.metallicRoughnessTexture).toBeUndefined();
        expect(pbr.baseColorFactor).toEqual([0.5, 0.5, 0.5, 1.0]);
        expect(pbr.metallicFactor).toBe(0.0); // No metallic
        expect(pbr.roughnessFactor).toBe(1.0); // Fully rough
        expect(material.emissiveTexture).toBe(undefined);
        expect(material.normalTexture).toBe(undefined);
        expect(material.occlusionTexture).toBe(undefined);
        expect(material.emissiveFactor).toEqual([0.0, 0.0, 0.0]);
    });

    it('sets default material values for metallicRoughness', function() {
        // No conversion applied when metallicRoughness flag is set
        var options = clone(defaultOptions);
        options.metallicRoughness = true;

        var defaultMaterial = setDefaultMaterial(boxObjData);
        defaultMaterial.specularShininess = 1.0; // This is the default set in loadMtl

        var gltf = createGltf(boxObjData, options);
        var material = gltf.materials[0];
        var pbr = material.pbrMetallicRoughness;
        expect(pbr.baseColorTexture).toBeUndefined();
        expect(pbr.metallicRoughnessTexture).toBeUndefined();
        expect(pbr.baseColorFactor).toEqual([0.5, 0.5, 0.5, 1.0]);
        expect(pbr.metallicFactor).toBe(0.0); // No metallic
        expect(pbr.roughnessFactor).toBe(1.0); // Fully rough
        expect(material.emissiveTexture).toBe(undefined);
        expect(material.normalTexture).toBe(undefined);
        expect(material.occlusionTexture).toBe(undefined);
        expect(material.emissiveFactor).toEqual([0.0, 0.0, 0.0]);
    });

    it('sets default material values for materialsCommon', function() {
        var options = clone(defaultOptions);
        options.materialsCommon = true;

        setDefaultMaterial(boxObjData);

        var gltf = createGltf(boxObjData, options);
        var material = gltf.materials[0];
        var kmc = material.extensions.KHR_materials_common;
        var values = kmc.values;

        expect(kmc.technique).toBe('LAMBERT');
        expect(values.ambient).toEqual([0.0, 0.0, 0.0, 1]);
        expect(values.diffuse).toEqual([0.5, 0.5, 0.5, 1]);
        expect(values.emission).toEqual([0.0, 0.0, 0.0, 1]);
        expect(values.specular).toEqual([0.0, 0.0, 0.0, 1]);
        expect(values.shininess).toEqual(0.0);
        expect(values.transparency).toBe(1.0);
        expect(values.transparent).toBe(false);
        expect(values.doubleSided).toBe(false);
    });

    it('sets material for diffuse texture', function() {
        var material = new Material();
        material.diffuseTexture = diffuseTextureUrl;
        boxObjData.materials[0] = material;
        boxObjData.images[diffuseTextureUrl] = diffuseTexture;

        var gltf = createGltf(boxObjData, defaultOptions);
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
        var material = new Material();
        material.alpha = 0.4;
        boxObjData.materials[0] = material;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 0.4]);
        expect(kmc.values.transparency).toBe(1.0);
        expect(kmc.values.transparent).toBe(true);
        expect(kmc.values.doubleSided).toBe(true);
    });

    it('sets material for diffuse texture and alpha less than 1', function() {
        var material = new Material();
        material.diffuseTexture = diffuseTextureUrl;
        material.alpha = 0.4;
        boxObjData.materials[0] = material;

        boxObjData.images[diffuseTextureUrl] = diffuseTexture;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual('texture_cesium');
        expect(kmc.values.transparency).toBe(0.4);
        expect(kmc.values.transparent).toBe(true);
        expect(kmc.values.doubleSided).toBe(true);
    });

    it('sets material for transparent diffuse texture', function() {
        var material = new Material();
        material.diffuseTexture = transparentDiffuseTextureUrl;
        boxObjData.materials[0] = material;

        boxObjData.images[transparentDiffuseTextureUrl] = transparentDiffuseTexture;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toBe('texture_diffuse');
        expect(kmc.values.transparency).toBe(1.0);
        expect(kmc.values.transparent).toBe(true);
        expect(kmc.values.doubleSided).toBe(true);
    });

    it('sets material for specular', function() {
        var material = new Material();
        material.specularColor = [0.1, 0.1, 0.2, 1];
        material.specularShininess = 0.1;
        boxObjData.materials[0] = material;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.technique).toBe('PHONG');
        expect(kmc.values.specular).toEqual([0.1, 0.1, 0.2, 1]);
        expect(kmc.values.shininess).toEqual(0.1);
    });

    it('sets constant material when there are no normals', function() {
        boxObjData.nodes[0].meshes[0].normals.length = 0;

        var material = new Material();
        material.diffuseTexture = diffuseTextureUrl;
        boxObjData.materials[0] = material;

        boxObjData.images[diffuseTextureUrl] = diffuseTexture;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.technique).toBe('CONSTANT');
        expect(kmc.values.emission).toEqual('texture_cesium');
    });

    it('sets default material when texture is missing', function() {
        var material = new Material();
        material.diffuseTexture = diffuseTextureUrl;
        boxObjData.materials[0] = material;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials[0].extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('uses default material (1)', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].material = undefined;

        // Creates a material called "default"
        var gltf = createGltf(boxObjData, defaultOptions);
        expect(gltf.materials[0].name).toBe('default');
        var kmc = gltf.materials[0].extensions.KHR_materials_common;
        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('uses default material (2)', function() {
        boxObjData.materials = {};

        // Uses the original name of the material
        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials[0].extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('runs without normals', function() {
        boxObjData.nodes[0].meshes[0].normals.length = 0;

        var gltf = createGltf(boxObjData, defaultOptions);
        var attributes = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeUndefined();
        expect(attributes.TEXCOORD_0).toBeDefined();
    });

    it('runs without uvs', function() {
        boxObjData.nodes[0].meshes[0].uvs.length = 0;

        var gltf = createGltf(boxObjData, defaultOptions);
        var attributes = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeDefined();
        expect(attributes.TEXCOORD_0).toBeUndefined();
    });

    it('runs without uvs and normals', function() {
        boxObjData.nodes[0].meshes[0].normals.length = 0;
        boxObjData.nodes[0].meshes[0].uvs.length = 0;

        var gltf = createGltf(boxObjData, defaultOptions);
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
        expandObjData(boxObjData, 2731); // Right above 65536 limit
        var mesh = boxObjData.nodes[0].meshes[0];
        var indicesLength = mesh.primitives[0].indices.length;
        var vertexCount = mesh.positions.length / 3;

        var gltf = createGltf(boxObjData, defaultOptions);
        var primitive = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0];
        var indicesAccessor = gltf.accessors[primitive.indices];
        expect(indicesAccessor.count).toBe(indicesLength);
        expect(indicesAccessor.max[0]).toBe(vertexCount - 1);
        expect(indicesAccessor.componentType).toBe(WebGLConstants.UNSIGNED_INT);

        var positionAccessor = gltf.accessors[primitive.attributes.POSITION];
        expect(positionAccessor.count).toBe(vertexCount);
    });

    it('ambient of [1, 1, 1] is treated as [0, 0, 0]', function() {
        boxObjData.materials.Material.ambientColor = [1.0, 1.0, 1.0, 1.0];

        var gltf = createGltf(boxObjData);
        var ambient = gltf.materials.Material.extensions.KHR_materials_common.values.ambient;

        expect(ambient).toEqual([0.0, 0.0, 0.0, 1.0]);
    });
});
