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
var ambientTextureUrl = 'specs/data/box-complex-material/ambient.gif';
var normalTextureUrl = 'specs/data/box-complex-material/bump.png';
var emissiveTextureUrl = 'specs/data/box-complex-material/emission.jpg';
var metallicTextureUrl = 'specs/data/box-complex-material/specular.jpeg';
var roughnessTextureUrl = 'specs/data/box-complex-material/shininess.png';

var defaultOptions = clone(obj2gltf.defaults);
defaultOptions.overridingImages = {};
var checkTransparencyOptions = clone(defaultOptions);
checkTransparencyOptions.checkTransparency = true;
var decodeOptions = clone(defaultOptions);
decodeOptions.decode = true;

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
    var diffuseTexture;
    var transparentDiffuseTexture;
    var ambientTexture;
    var normalTexture;
    var emissiveTexture;
    var metallicTexture;
    var roughnessTexture;

    beforeEach(function(done) {
        spyOn(console, 'log');
        return Promise.all([
            loadObj(boxObjUrl, decodeOptions)
                .then(function(data) {
                    boxObjData = data;
                }),
            loadObj(groupObjUrl, decodeOptions)
                .then(function(data) {
                    groupObjData = data;
                }),
            loadImage(diffuseTextureUrl, decodeOptions)
                .then(function(image) {
                    diffuseTexture = image;
                }),
            loadImage(transparentDiffuseTextureUrl, checkTransparencyOptions)
                .then(function(image) {
                   transparentDiffuseTexture = image;
                }),
            loadImage(ambientTextureUrl, decodeOptions)
                .then(function(image) {
                    ambientTexture = image;
                }),
            loadImage(normalTextureUrl, decodeOptions)
                .then(function(image) {
                    normalTexture = image;
                }),
            loadImage(emissiveTextureUrl, decodeOptions)
                .then(function(image) {
                    emissiveTexture = image;
                }),
            loadImage(metallicTextureUrl, decodeOptions)
                .then(function(image) {
                    metallicTexture = image;
                }),
            loadImage(roughnessTextureUrl, decodeOptions)
                .then(function(image) {
                    roughnessTexture = image;
                })
        ]).then(done);
    });

    it('simple gltf', function() {
        var gltf = createGltf(boxObjData, defaultOptions);

        expect(gltf.materials.length).toBe(1);
        expect(gltf.scene).toBe(0);
        expect(gltf.scenes[0].nodes[0]).toBe(0);
        expect(gltf.nodes.length).toBe(1);
        expect(gltf.meshes.length).toBe(1);

        var primitives = gltf.meshes[0].primitives;
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

        expect(gltf.materials.length).toBe(3);
        expect(gltf.scene).toBe(0);
        expect(gltf.scenes[0].nodes[0]).toBe(0);
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

    describe('metallicRoughness', function() {
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
            expect(material.alphaMode).toBe('OPAQUE');
            expect(material.doubleSided).toBe(false);
        });

        it('complex material', function() {
            var options = clone(defaultOptions);
            options.metallicRoughness = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = diffuseTextureUrl;
            defaultMaterial.ambientTexture = ambientTextureUrl;
            defaultMaterial.normalTexture = normalTextureUrl;
            defaultMaterial.emissiveTexture = emissiveTextureUrl;
            defaultMaterial.specularTexture = metallicTextureUrl;
            defaultMaterial.specularShininessTexture = roughnessTextureUrl;
            boxObjData.images.push(diffuseTexture, ambientTexture, normalTexture, emissiveTexture, metallicTexture, roughnessTexture);

            var gltf = createGltf(boxObjData, options);
            var material = gltf.materials[0];
            var pbr = material.pbrMetallicRoughness;
            var textureIndexes = [pbr.baseColorTexture.index, pbr.metallicRoughnessTexture.index, material.occlusionTexture.index, material.emissiveTexture.index, material.normalTexture.index].sort();
            expect(textureIndexes).toEqual([0, 1, 2, 3, 4]);
            expect(pbr.baseColorFactor).toEqual([1.0, 1.0, 1.0, 1.0]);
            expect(pbr.metallicFactor).toBe(1.0);
            expect(pbr.roughnessFactor).toBe(1.0);
            expect(material.emissiveFactor).toEqual([1.0, 1.0, 1.0]);
        });

        it('packs occlusion in metallic roughness texture', function() {
            var options = clone(defaultOptions);
            options.metallicRoughness = true;
            options.packOcclusion = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.ambientTexture = diffuseTextureUrl;
            defaultMaterial.specularTexture = metallicTextureUrl;
            defaultMaterial.specularShininessTexture = roughnessTextureUrl;
            boxObjData.images.push(diffuseTexture, metallicTexture, roughnessTexture);

            var gltf = createGltf(boxObjData, options);
            var material = gltf.materials[0];
            var pbr = material.pbrMetallicRoughness;
            expect(pbr.metallicRoughnessTexture).toEqual({index : 0});
            expect(material.occlusionTexture).toEqual({index : 0});
        });

        it('does not create metallic roughness texture if decoded image data is not available', function() {
            var options = clone(defaultOptions);
            options.metallicRoughness = true;
            options.packOcclusion = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.ambientTexture = ambientTextureUrl; // is a .gif which can't be decoded
            defaultMaterial.specularTexture = metallicTextureUrl;
            defaultMaterial.specularShininessTexture = roughnessTextureUrl;
            boxObjData.images.push(ambientTexture, metallicTexture, roughnessTexture);

            var gltf = createGltf(boxObjData, options);
            var material = gltf.materials[0];
            var pbr = material.pbrMetallicRoughness;
            expect(pbr.metallicRoughnessTexture).toBeUndefined();
            expect(material.occlusionTexture).toBeUndefined();
        });

        it('sets material for transparent diffuse texture', function() {
            var options = clone(defaultOptions);
            options.metallicRoughness = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = transparentDiffuseTextureUrl;
            boxObjData.images.push(transparentDiffuseTexture);

            var gltf = createGltf(boxObjData, options);
            var material = gltf.materials[0];
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });
    });

    describe('specularGlossiness', function() {
        it('sets default material values for specularGlossiness', function() {
            var options = clone(defaultOptions);
            options.specularGlossiness = true;

            setDefaultMaterial(boxObjData);

            var gltf = createGltf(boxObjData, options);
            var material = gltf.materials[0];
            var pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.diffuseTexture).toBeUndefined();
            expect(pbr.specularGlossinessTexture).toBeUndefined();
            expect(pbr.diffuseFactor).toEqual([0.5, 0.5, 0.5, 1.0]);
            expect(pbr.specularFactor).toEqual([0.0, 0.0, 0.0]); // No specular color
            expect(pbr.glossinessFactor).toEqual(0.0); // Rough surface
            expect(material.emissiveTexture).toBe(undefined);
            expect(material.normalTexture).toBe(undefined);
            expect(material.occlusionTexture).toBe(undefined);
            expect(material.emissiveFactor).toEqual([0.0, 0.0, 0.0]);
            expect(material.alphaMode).toBe('OPAQUE');
            expect(material.doubleSided).toBe(false);
        });

        it('complex material', function() {
            var options = clone(defaultOptions);
            options.specularGlossiness = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = diffuseTextureUrl;
            defaultMaterial.ambientTexture = ambientTextureUrl;
            defaultMaterial.normalTexture = normalTextureUrl;
            defaultMaterial.emissiveTexture = emissiveTextureUrl;
            defaultMaterial.specularTexture = metallicTextureUrl;
            defaultMaterial.specularShininessTexture = roughnessTextureUrl;
            boxObjData.images.push(diffuseTexture, ambientTexture, normalTexture, emissiveTexture, metallicTexture, roughnessTexture);

            var gltf = createGltf(boxObjData, options);
            var material = gltf.materials[0];
            var pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            var textureIndexes = [pbr.diffuseTexture.index, pbr.specularGlossinessTexture.index, material.occlusionTexture.index, material.emissiveTexture.index, material.normalTexture.index].sort();
            expect(textureIndexes).toEqual([0, 1, 2, 3, 4]);
            expect(pbr.diffuseFactor).toEqual([1.0, 1.0, 1.0, 1.0]);
            expect(pbr.specularFactor).toEqual([1.0, 1.0, 1.0]);
            expect(pbr.glossinessFactor).toEqual(1.0);
            expect(material.emissiveFactor).toEqual([1.0, 1.0, 1.0]);
        });

        it('does not create metallic roughness texture if decoded image data is not available', function() {
            var options = clone(defaultOptions);
            options.specularGlossiness = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.specularTexture = ambientTextureUrl; // is a .gif which can't be decoded;
            defaultMaterial.specularShininessTexture = roughnessTextureUrl;
            boxObjData.images.push(ambientTexture, roughnessTexture);

            var gltf = createGltf(boxObjData, options);
            var material = gltf.materials[0];
            var pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.specularGlossinessTexture).toBeUndefined();
        });

        it('sets material for transparent diffuse texture', function() {
            var options = clone(defaultOptions);
            options.specularGlossiness = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = transparentDiffuseTextureUrl;
            boxObjData.images.push(transparentDiffuseTexture);

            var gltf = createGltf(boxObjData, options);
            var material = gltf.materials[0];
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });
    });

    describe('materialsCommon', function() {
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
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = diffuseTextureUrl;
            boxObjData.images.push(diffuseTexture);

            var gltf = createGltf(boxObjData, options);
            var kmc = gltf.materials[0].extensions.KHR_materials_common;
            var texture = gltf.textures[0];
            var image = gltf.images[0];

            expect(kmc.technique).toBe('LAMBERT');
            expect(kmc.values.diffuse).toEqual({index : 0});
            expect(kmc.values.transparency).toBe(1.0);
            expect(kmc.values.transparent).toBe(false);
            expect(kmc.values.doubleSided).toBe(false);

            expect(texture).toEqual({
                name : 'cesium_texture',
                sampler : 0,
                source : 0
            });

            expect(image).toBeDefined();
            expect(image.name).toBe('cesium');
            expect(image.extras._obj2gltf.source).toBeDefined();
            expect(image.extras._obj2gltf.extension).toBe('.png');

            expect(gltf.samplers[0]).toEqual({
                magFilter : WebGLConstants.LINEAR,
                minFilter : WebGLConstants.NEAREST_MIPMAP_LINEAR,
                wrapS : WebGLConstants.REPEAT,
                wrapT : WebGLConstants.REPEAT
            });
        });

        it('sets material for alpha less than 1', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.alpha = 0.4;

            var gltf = createGltf(boxObjData, options);
            var kmc = gltf.materials[0].extensions.KHR_materials_common;

            expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 0.4]);
            expect(kmc.values.transparency).toBe(1.0);
            expect(kmc.values.transparent).toBe(true);
            expect(kmc.values.doubleSided).toBe(true);
        });

        it('sets material for diffuse texture and alpha less than 1', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = diffuseTextureUrl;
            defaultMaterial.alpha = 0.4;
            boxObjData.images.push(diffuseTexture);

            var gltf = createGltf(boxObjData, options);
            var kmc = gltf.materials[0].extensions.KHR_materials_common;

            expect(kmc.values.diffuse).toEqual({index : 0});
            expect(kmc.values.transparency).toBe(0.4);
            expect(kmc.values.transparent).toBe(true);
            expect(kmc.values.doubleSided).toBe(true);
        });

        it('sets material for transparent diffuse texture', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = transparentDiffuseTextureUrl;
            boxObjData.images.push(transparentDiffuseTexture);

            var gltf = createGltf(boxObjData, options);
            var kmc = gltf.materials[0].extensions.KHR_materials_common;

            expect(kmc.values.diffuse).toEqual({index : 0});
            expect(kmc.values.transparency).toBe(1.0);
            expect(kmc.values.transparent).toBe(true);
            expect(kmc.values.doubleSided).toBe(true);
        });

        it('sets material for specular', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.specularColor = [0.1, 0.1, 0.2, 1];
            defaultMaterial.specularShininess = 0.1;

            var gltf = createGltf(boxObjData, options);
            var kmc = gltf.materials[0].extensions.KHR_materials_common;

            expect(kmc.technique).toBe('PHONG');
            expect(kmc.values.specular).toEqual([0.1, 0.1, 0.2, 1]);
            expect(kmc.values.shininess).toEqual(0.1);
        });

        it('sets constant material when there are no normals', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            boxObjData.nodes[0].meshes[0].normals.length = 0;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = diffuseTextureUrl;
            boxObjData.images.push(diffuseTexture);

            var gltf = createGltf(boxObjData, options);
            var kmc = gltf.materials[0].extensions.KHR_materials_common;

            expect(kmc.technique).toBe('CONSTANT');
            expect(kmc.values.emission).toEqual({index : 0});
        });

        it('sets default material when texture is missing', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            var defaultMaterial = setDefaultMaterial(boxObjData);
            defaultMaterial.diffuseTexture = diffuseTextureUrl;

            var gltf = createGltf(boxObjData, options);
            var kmc = gltf.materials[0].extensions.KHR_materials_common;

            expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
        });

        it('uses default material (1)', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            boxObjData.nodes[0].meshes[0].primitives[0].material = undefined;

            // Creates a material called "default"
            var gltf = createGltf(boxObjData, options);
            expect(gltf.materials[0].name).toBe('default');
            var kmc = gltf.materials[0].extensions.KHR_materials_common;
            expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
        });

        it('uses default material (2)', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            boxObjData.materials = {};

            // Uses the original name of the material
            var gltf = createGltf(boxObjData, options);
            var kmc = gltf.materials[0].extensions.KHR_materials_common;

            expect(kmc.values.diffuse).toEqual([0.5, 0.5, 0.5, 1.0]);
        });

        it('ambient of [1, 1, 1] is treated as [0, 0, 0]', function() {
            var options = clone(defaultOptions);
            options.materialsCommon = true;

            boxObjData.materials[0].ambientColor = [1.0, 1.0, 1.0, 1.0];

            var gltf = createGltf(boxObjData, options);
            var ambient = gltf.materials[0].extensions.KHR_materials_common.values.ambient;

            expect(ambient).toEqual([0.0, 0.0, 0.0, 1.0]);
        });
    });
});
