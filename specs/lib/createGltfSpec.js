'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var obj2gltf = require('../../lib/obj2gltf');
var createGltf = require('../../lib/createGltf');
var loadImage = require('../../lib/loadImage');
var loadObj = require('../../lib/loadObj');
var Material = require('../../lib/Material');

var clone = Cesium.clone;
var WebGLConstants = Cesium.WebGLConstants;

var boxObjUrl = 'specs/data/box/box.obj';
var groupObjUrl = 'specs/data/box-objects-groups-materials/box-objects-groups-materials.obj';
var diffuseTextureUrl = 'specs/data/box-textured/cesium.png';
var transparentDiffuseTextureUrl = 'specs/data/box-complex-material/diffuse.png';

var defaultOptions = obj2gltf.defaults;
var checkTransparencyOptions = clone(defaultOptions);
checkTransparencyOptions.checkTransparency = true;

describe('createGltf', function() {
    var boxObjData;
    var duplicateBoxObjData;
    var groupObjData;
    var diffuseTexture;
    var transparentDiffuseTexture;

    beforeEach(function(done) {
        return Promise.all([
            loadObj(boxObjUrl, defaultOptions)
                .then(function(data) {
                    boxObjData = data;
                }),
            loadObj(boxObjUrl, defaultOptions)
                .then(function(data) {
                    duplicateBoxObjData = data;
                }),
            loadObj(groupObjUrl, defaultOptions)
                .then(function(data) {
                    groupObjData = data;
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

    it('simple gltf', function() {
        var gltf = createGltf(boxObjData, defaultOptions);

        expect(Object.keys(gltf.materials).length).toBe(1);
        expect(Object.keys(gltf.nodes).length).toBe(1);
        expect(Object.keys(gltf.meshes).length).toBe(1);

        var primitives = gltf.meshes['Cube-Mesh'].primitives;
        var primitive = primitives[0];
        var attributes = primitive.attributes;
        var positionAccessor = gltf.accessors[attributes.POSITION];
        var normalAccessor = gltf.accessors[attributes.NORMAL];
        var uvAccessor = gltf.accessors[attributes.TEXCOORD_0];
        var indexAccessor = gltf.accessors[primitive.indices];

        expect(primitives.length).toBe(1);
        expect(positionAccessor.count).toBe(24);
        expect(normalAccessor.count).toBe(24);
        expect(uvAccessor.count).toBe(24);
        expect(indexAccessor.count).toBe(36);
    });

    it('multiple nodes, meshes, and primitives', function() {
        var gltf = createGltf(groupObjData, defaultOptions);

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
        boxObjData.materials.Material = new Material();

        var gltf = createGltf(boxObjData, defaultOptions);
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
        var material = new Material();
        material.diffuseTexture = diffuseTextureUrl;
        boxObjData.materials.Material = material;
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
            minFilter : WebGLConstants.NEAREST_MIPMAP_LINEAR,
            wrapS : WebGLConstants.REPEAT,
            wrapT : WebGLConstants.REPEAT
        });
    });

    it('sets material for alpha less than 1', function() {
        var material = new Material();
        material.alpha = 0.4;
        boxObjData.materials.Material = material;

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
        boxObjData.materials.Material = material;

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
        boxObjData.materials.Material = material;

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
        boxObjData.materials.Material = material;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.technique).toBe('PHONG');
        expect(kmc.values.specular).toEqual([0.1, 0.1, 0.2, 1]);
        expect(kmc.values.shininess).toEqual(0.1);
    });

    it('sets constant material when there are no normals', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].normals.length = 0;

        var material = new Material();
        material.diffuseTexture = diffuseTextureUrl;
        boxObjData.materials.Material = material;

        boxObjData.images[diffuseTextureUrl] = diffuseTexture;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.technique).toBe('CONSTANT');
        expect(kmc.values.emission).toEqual('texture_cesium');
    });

    it('sets default material when texture is missing', function() {
        var material = new Material();
        material.diffuseTexture = diffuseTextureUrl;
        boxObjData.materials.Material = material;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('uses default material (1)', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].material = undefined;

        // Creates a material called "default"
        var gltf = createGltf(boxObjData, defaultOptions);
        expect(gltf.materials.default).toBeDefined();
        var kmc = gltf.materials.default.extensions.KHR_materials_common;
        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('uses default material (2)', function() {
        boxObjData.materials = {};

        // Uses the original name of the material
        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc = gltf.materials.Material.extensions.KHR_materials_common;

        expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
    });

    it('handles material used with and without normals (1)', function() {
        // Two meshes - one with normals, and one without
        boxObjData.nodes.push(duplicateBoxObjData.nodes[0]);
        boxObjData.nodes[1].meshes[0].primitives[0].normals.length = 0;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc1 = gltf.materials.Material.extensions.KHR_materials_common;
        var kmc2 = gltf.materials.Material_constant.extensions.KHR_materials_common;

        expect(kmc1.technique).toBe('PHONG');
        expect(kmc2.technique).toBe('CONSTANT');
    });

    it('handles material used with and without normals (2)', function() {
        // Now test in a different order
        boxObjData.nodes.push(duplicateBoxObjData.nodes[0]);
        boxObjData.nodes[0].meshes[0].primitives[0].normals.length = 0;

        var gltf = createGltf(boxObjData, defaultOptions);
        var kmc1 = gltf.materials.Material.extensions.KHR_materials_common;
        var kmc2 = gltf.materials.Material_shaded.extensions.KHR_materials_common;

        expect(kmc1.technique).toBe('CONSTANT');
        expect(kmc2.technique).toBe('PHONG');
    });

    it('runs without normals', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].normals.length = 0;

        var gltf = createGltf(boxObjData, defaultOptions);
        var attributes = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeUndefined();
        expect(attributes.TEXCOORD_0).toBeDefined();
    });

    it('runs without uvs', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].uvs.length = 0;

        var gltf = createGltf(boxObjData, defaultOptions);
        var attributes = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeDefined();
        expect(attributes.TEXCOORD_0).toBeUndefined();
    });

    it('runs without uvs and normals', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].normals.length = 0;
        boxObjData.nodes[0].meshes[0].primitives[0].uvs.length = 0;

        var gltf = createGltf(boxObjData, defaultOptions);
        var attributes = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeUndefined();
        expect(attributes.TEXCOORD_0).toBeUndefined();
    });

    function expandObjData(objData, duplicatesLength) {
        var primitive = objData.nodes[0].meshes[0].primitives[0];
        var indices = primitive.indices;
        var positions = primitive.positions;
        var normals = primitive.normals;
        var uvs = primitive.uvs;

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
        var primitive = boxObjData.nodes[0].meshes[0].primitives[0];
        var indicesLength = primitive.indices.length;
        var vertexCount = primitive.positions.length / 3;

        var gltf = createGltf(boxObjData, defaultOptions);
        var gltfPrimitive = gltf.meshes[Object.keys(gltf.meshes)[0]].primitives[0];
        var indicesAccessor = gltf.accessors[gltfPrimitive.indices];
        expect(indicesAccessor.count).toBe(indicesLength);
        expect(indicesAccessor.max[0]).toBe(vertexCount - 1);
        expect(indicesAccessor.componentType).toBe(WebGLConstants.UNSIGNED_INT);

        var positionAccessor = gltf.accessors[gltfPrimitive.attributes.POSITION];
        expect(positionAccessor.count).toBe(vertexCount);
    });

    it('ambient of [1, 1, 1] is treated as [0, 0, 0]', function() {
        boxObjData.materials.Material.ambientColor = [1.0, 1.0, 1.0, 1.0];

        var gltf = createGltf(boxObjData, defaultOptions);
        var ambient = gltf.materials.Material.extensions.KHR_materials_common.values.ambient;

        expect(ambient).toEqual([0.0, 0.0, 0.0, 1.0]);
    });
});
