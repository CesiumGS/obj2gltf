'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var fsExtra = require('fs-extra');
var loadMtl = require('../../lib/loadMtl');
var loadTexture = require('../../lib/loadTexture');
var obj2gltf = require('../../lib/obj2gltf');
var Texture = require('../../lib/Texture');

var clone = Cesium.clone;

var coloredMaterialPath = 'specs/data/box/box.mtl';
var texturedMaterialPath = 'specs/data/box-complex-material/box-complex-material.mtl';
var texturedWithOptionsMaterialPath = 'specs/data/box-texture-options/box-texture-options.mtl';
var multipleMaterialsPath = 'specs/data/box-multiple-materials/box-multiple-materials.mtl';
var externalMaterialPath = 'specs/data/box-external-resources/box-external-resources.mtl';
var resourcesInRootMaterialPath = 'specs/data/box-resources-in-root/box-resources-in-root.mtl';
var externalInRootMaterialPath = 'specs/data/box-external-resources-in-root/box-external-resources-in-root.mtl';
var transparentMaterialPath = 'specs/data/box-transparent/box-transparent.mtl';
var diffuseAmbientSameMaterialPath = 'specs/data/box-diffuse-ambient-same/box-diffuse-ambient-same.mtl';

var diffuseTexturePath = 'specs/data/box-textured/cesium.png';
var transparentDiffuseTexturePath = 'specs/data/box-complex-material/diffuse.png';
var alphaTexturePath = 'specs/data/box-complex-material-alpha/alpha.png';
var ambientTexturePath = 'specs/data/box-complex-material/ambient.gif';
var normalTexturePath = 'specs/data/box-complex-material/bump.png';
var emissiveTexturePath = 'specs/data/box-complex-material/emission.jpg';
var specularTexturePath = 'specs/data/box-complex-material/specular.jpeg';
var specularShininessTexturePath = 'specs/data/box-complex-material/shininess.png';

var diffuseTexture;
var transparentDiffuseTexture;
var alphaTexture;
var ambientTexture;
var normalTexture;
var emissiveTexture;
var specularTexture;
var specularShininessTexture;

var checkTransparencyOptions = {
    checkTransparency : true
};
var decodeOptions = {
    decode : true
};

var options;

describe('loadMtl', function() {
    beforeAll(function(done) {
        return Promise.all([
            loadTexture(diffuseTexturePath, decodeOptions)
                .then(function(texture) {
                    diffuseTexture = texture;
                }),
            loadTexture(transparentDiffuseTexturePath, checkTransparencyOptions)
                .then(function(texture) {
                    transparentDiffuseTexture = texture;
                }),
            loadTexture(alphaTexturePath, decodeOptions)
                .then(function(texture) {
                    alphaTexture = texture;
                }),
            loadTexture(ambientTexturePath)
                .then(function(texture) {
                    ambientTexture = texture;
                }),
            loadTexture(normalTexturePath)
                .then(function(texture) {
                    normalTexture = texture;
                }),
            loadTexture(emissiveTexturePath)
                .then(function(texture) {
                    emissiveTexture = texture;
                }),
            loadTexture(specularTexturePath, decodeOptions)
                .then(function(texture) {
                    specularTexture = texture;
                }),
            loadTexture(specularShininessTexturePath, decodeOptions)
                .then(function(texture) {
                    specularShininessTexture = texture;
                })
        ]).then(done);
    });

    beforeEach(function() {
        options = clone(obj2gltf.defaults);
        options.overridingTextures = {};
        options.logger = function() {};
        options.hasNormals = true;
    });

    it('loads mtl', function(done) {
        options.metallicRoughness = true;
        expect(loadMtl(coloredMaterialPath, options)
            .then(function(materials) {
                expect(materials.length).toBe(1);
                var material = materials[0];
                var pbr = material.pbrMetallicRoughness;
                expect(pbr.baseColorTexture).toBeUndefined();
                expect(pbr.metallicRoughnessTexture).toBeUndefined();
                expect(pbr.baseColorFactor).toEqual([0.64, 0.64, 0.64, 1.0]);
                expect(pbr.metallicFactor).toBe(0.5);
                expect(pbr.roughnessFactor).toBe(96.078431);
                expect(material.name).toBe('Material');
                expect(material.emissiveTexture).toBeUndefined();
                expect(material.normalTexture).toBeUndefined();
                expect(material.ambientTexture).toBeUndefined();
                expect(material.emissiveFactor).toEqual([0.0, 0.0, 0.1]);
                expect(material.alphaMode).toBe('OPAQUE');
                expect(material.doubleSided).toBe(false);
            }), done).toResolve();
    });

    it('loads mtl with textures', function(done) {
        options.metallicRoughness = true;
        expect(loadMtl(texturedMaterialPath, options)
            .then(function(materials) {
                expect(materials.length).toBe(1);
                var material = materials[0];
                var pbr = material.pbrMetallicRoughness;
                expect(pbr.baseColorTexture).toBeDefined();
                expect(pbr.metallicRoughnessTexture).toBeDefined();
                expect(pbr.baseColorFactor).toEqual([1.0, 1.0, 1.0, 0.9]);
                expect(pbr.metallicFactor).toBe(1.0);
                expect(pbr.roughnessFactor).toBe(1.0);
                expect(material.name).toBe('Material');
                expect(material.emissiveTexture).toBeDefined();
                expect(material.normalTexture).toBeDefined();
                expect(material.occlusionTexture).toBeDefined();
                expect(material.emissiveFactor).toEqual([1.0, 1.0, 1.0]);
                expect(material.alphaMode).toBe('BLEND');
                expect(material.doubleSided).toBe(true);
            }), done).toResolve();
    });

    it('loads mtl with textures having options', function(done) {
        options.metallicRoughness = true;
        expect(loadMtl(texturedWithOptionsMaterialPath, options)
            .then(function(materials) {
                expect(materials.length).toBe(1);
                var material = materials[0];
                var pbr = material.pbrMetallicRoughness;
                expect(pbr.baseColorTexture).toBeDefined();
                expect(pbr.metallicRoughnessTexture).toBeDefined();
                expect(pbr.baseColorFactor).toEqual([1.0, 1.0, 1.0, 0.9]);
                expect(pbr.metallicFactor).toBe(1.0);
                expect(pbr.roughnessFactor).toBe(1.0);
                expect(material.name).toBe('Material');
                expect(material.emissiveTexture).toBeDefined();
                expect(material.normalTexture).toBeDefined();
                expect(material.occlusionTexture).toBeDefined();
                expect(material.emissiveFactor).toEqual([1.0, 1.0, 1.0]);
                expect(material.alphaMode).toBe('BLEND');
                expect(material.doubleSided).toBe(true);
            }), done).toResolve();
    });

    it('loads mtl with multiple materials', function(done) {
        options.metallicRoughness = true;
        expect(loadMtl(multipleMaterialsPath, options)
            .then(function(materials) {
                expect(materials.length).toBe(3);
                expect(materials[0].name).toBe('Blue');
                expect(materials[0].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.0, 0.64, 1.0]);
                expect(materials[1].name).toBe('Green');
                expect(materials[1].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.64, 0.0, 1.0]);
                expect(materials[2].name).toBe('Red');
                expect(materials[2].pbrMetallicRoughness.baseColorFactor).toEqual([0.64, 0.0, 0.0, 1.0]);
            }), done).toResolve();
    });

    it('sets overriding textures', function(done) {
        spyOn(fsExtra, 'readFile').and.callThrough();
        options.overridingTextures = {
            metallicRoughnessOcclusionTexture : alphaTexturePath,
            baseColorTexture : alphaTexturePath,
            emissiveTexture : emissiveTexturePath
        };
        expect(loadMtl(texturedMaterialPath, options)
            .then(function(materials) {
                var material = materials[0];
                var pbr = material.pbrMetallicRoughness;
                expect(pbr.baseColorTexture.name).toBe('alpha');
                expect(pbr.metallicRoughnessTexture.name).toBe('alpha');
                expect(material.emissiveTexture.name).toBe('emission');
                expect(material.normalTexture.name).toBe('bump');
                expect(fsExtra.readFile.calls.count()).toBe(3);
            }), done).toResolve();
    });

    it('loads texture outside of the mtl directory', function(done) {
        expect(loadMtl(externalMaterialPath, options)
            .then(function(materials) {
                var material = materials[0];
                var baseColorTexture = material.pbrMetallicRoughness.baseColorTexture;
                expect(baseColorTexture.source).toBeDefined();
                expect(baseColorTexture.name).toBe('cesium');
            }), done).toResolve();
    });

    it('does not load texture outside of the mtl directory when secure is true', function(done) {
        var spy = jasmine.createSpy('logger');
        options.logger = spy;
        options.secure = true;

        expect(loadMtl(externalMaterialPath, options)
            .then(function(materials) {
                var material = materials[0];
                var baseColorTexture = material.pbrMetallicRoughness.baseColorTexture;
                expect(baseColorTexture).toBeUndefined();
                expect(spy.calls.argsFor(0)[0].indexOf('Texture file is outside of the mtl directory and the secure flag is true. Attempting to read the texture file from within the obj directory instead') >= 0).toBe(true);
                expect(spy.calls.argsFor(1)[0].indexOf('ENOENT') >= 0).toBe(true);
                expect(spy.calls.argsFor(2)[0].indexOf('Could not read texture file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('loads textures from root directory when the texture paths do not exist', function(done) {
        expect(loadMtl(resourcesInRootMaterialPath, options)
            .then(function(materials) {
                var material = materials[0];
                var baseColorTexture = material.pbrMetallicRoughness.baseColorTexture;
                expect(baseColorTexture.source).toBeDefined();
                expect(baseColorTexture.name).toBe('cesium');
            }), done).toResolve();
    });

    it('loads textures from root directory when texture is outside of the mtl directory and secure is true', function(done) {
        options.secure = true;

        expect(loadMtl(externalInRootMaterialPath, options)
            .then(function(materials) {
                var material = materials[0];
                var baseColorTexture = material.pbrMetallicRoughness.baseColorTexture;
                expect(baseColorTexture.source).toBeDefined();
                expect(baseColorTexture.name).toBe('cesium');
            }), done).toResolve();
    });

    it('alpha of 0.0 is treated as 1.0', function(done) {
        expect(loadMtl(transparentMaterialPath, options)
            .then(function(materials) {
                expect(materials.length).toBe(1);
                var material = materials[0];
                var pbr = material.pbrMetallicRoughness;
                expect(pbr.baseColorTexture).toBeUndefined();
                expect(pbr.metallicRoughnessTexture).toBeUndefined();
                expect(pbr.baseColorFactor[3]).toEqual(1.0);
                expect(material.alphaMode).toBe('OPAQUE');
                expect(material.doubleSided).toBe(false);
            }), done).toResolve();
    });

    it('ambient texture is ignored if it is the same as the diffuse texture', function(done) {
        expect(loadMtl(diffuseAmbientSameMaterialPath, options)
            .then(function(materials) {
                expect(materials.length).toBe(1);
                var material = materials[0];
                var pbr = material.pbrMetallicRoughness;
                expect(pbr.baseColorTexture).toBeDefined();
                expect(pbr.occlusionTexture).toBeUndefined();
            }), done).toResolve();
    });

    describe('metallicRoughness', function() {
        it('creates default material', function() {
            var material = loadMtl._createMaterial(undefined, options);
            var pbr = material.pbrMetallicRoughness;
            expect(pbr.baseColorTexture).toBeUndefined();
            expect(pbr.metallicRoughnessTexture).toBeUndefined();
            expect(pbr.baseColorFactor).toEqual([0.5, 0.5, 0.5, 1.0]);
            expect(pbr.metallicFactor).toBe(0.0); // No metallic
            expect(pbr.roughnessFactor).toBe(1.0); // Fully rough
            expect(material.emissiveTexture).toBeUndefined();
            expect(material.normalTexture).toBeUndefined();
            expect(material.ambientTexture).toBeUndefined();
            expect(material.emissiveFactor).toEqual([0.0, 0.0, 0.0]);
            expect(material.alphaMode).toBe('OPAQUE');
            expect(material.doubleSided).toBe(false);
        });

        it('creates material with textures', function() {
            options.metallicRoughness = true;

            var material = loadMtl._createMaterial({
                diffuseTexture : diffuseTexture,
                ambientTexture : ambientTexture,
                normalTexture : normalTexture,
                emissiveTexture : emissiveTexture,
                specularTexture : specularTexture,
                specularShininessTexture : specularShininessTexture
            }, options);

            var pbr = material.pbrMetallicRoughness;
            expect(pbr.baseColorTexture).toBeDefined();
            expect(pbr.metallicRoughnessTexture).toBeDefined();
            expect(pbr.baseColorFactor).toEqual([1.0, 1.0, 1.0, 1.0]);
            expect(pbr.metallicFactor).toBe(1.0);
            expect(pbr.roughnessFactor).toBe(1.0);
            expect(material.emissiveTexture).toBeDefined();
            expect(material.normalTexture).toBeDefined();
            expect(material.occlusionTexture).toBeDefined();
            expect(material.emissiveFactor).toEqual([1.0, 1.0, 1.0]);
            expect(material.alphaMode).toBe('OPAQUE');
            expect(material.doubleSided).toBe(false);
        });

        it('packs occlusion in metallic roughness texture', function() {
            options.metallicRoughness = true;
            options.packOcclusion = true;

            var material = loadMtl._createMaterial({
                ambientTexture : alphaTexture,
                specularTexture : specularTexture,
                specularShininessTexture : specularShininessTexture
            }, options);

            var pbr = material.pbrMetallicRoughness;
            expect(pbr.metallicRoughnessTexture).toBeDefined();
            expect(pbr.metallicRoughnessTexture).toBe(material.occlusionTexture);
        });

        it('does not create metallic roughness texture if decoded texture data is not available', function() {
            options.metallicRoughness = true;
            options.packOcclusion = true;

            var material = loadMtl._createMaterial({
                ambientTexture : ambientTexture, // Is a .gif which can't be decoded
                specularTexture : specularTexture,
                specularShininessTexture : specularShininessTexture
            }, options);

            var pbr = material.pbrMetallicRoughness;
            expect(pbr.metallicRoughnessTexture).toBeUndefined();
            expect(material.occlusionTexture).toBeUndefined();
        });

        it('sets material for transparent diffuse texture', function() {
            options.metallicRoughness = true;

            var material = loadMtl._createMaterial({
                diffuseTexture : transparentDiffuseTexture
            }, options);
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });

        it('packs alpha texture in base color texture', function() {
            options.metallicRoughness = true;

            var material = loadMtl._createMaterial({
                diffuseTexture : diffuseTexture,
                alphaTexture : alphaTexture
            }, options);

            var pbr = material.pbrMetallicRoughness;
            expect(pbr.baseColorTexture).toBeDefined();

            var hasBlack = false;
            var hasWhite = false;
            var pixels = pbr.baseColorTexture.pixels;
            var pixelsLength = pixels.length / 4;
            for (var i = 0; i < pixelsLength; ++i) {
                var alpha = pixels[i * 4 + 3];
                hasBlack = hasBlack || (alpha === 0);
                hasWhite = hasWhite || (alpha === 255);
            }
            expect(hasBlack).toBe(true);
            expect(hasWhite).toBe(true);
            expect(pbr.baseColorFactor[3]).toEqual(1);
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });
    });

    describe('specularGlossiness', function() {
        it('creates default material', function() {
            options.specularGlossiness = true;
            var material = loadMtl._createMaterial(undefined, options);
            var pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.diffuseTexture).toBeUndefined();
            expect(pbr.specularGlossinessTexture).toBeUndefined();
            expect(pbr.diffuseFactor).toEqual([0.5, 0.5, 0.5, 1.0]);
            expect(pbr.specularFactor).toEqual([0.0, 0.0, 0.0]); // No specular color
            expect(pbr.glossinessFactor).toEqual(0.0); // Rough surface
            expect(material.emissiveTexture).toBeUndefined();
            expect(material.normalTexture).toBeUndefined();
            expect(material.occlusionTexture).toBeUndefined();
            expect(material.emissiveFactor).toEqual([0.0, 0.0, 0.0]);
            expect(material.alphaMode).toBe('OPAQUE');
            expect(material.doubleSided).toBe(false);
        });

        it('creates material with textures', function() {
            options.specularGlossiness = true;

            var material = loadMtl._createMaterial({
                diffuseTexture : diffuseTexture,
                ambientTexture : ambientTexture,
                normalTexture : normalTexture,
                emissiveTexture : emissiveTexture,
                specularTexture : specularTexture,
                specularShininessTexture : specularShininessTexture
            }, options);

            var pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.diffuseTexture).toBeDefined();
            expect(pbr.specularGlossinessTexture).toBeDefined();
            expect(pbr.diffuseFactor).toEqual([1.0, 1.0, 1.0, 1.0]);
            expect(pbr.specularFactor).toEqual([1.0, 1.0, 1.0]);
            expect(pbr.glossinessFactor).toEqual(1.0);
            expect(material.emissiveTexture).toBeDefined();
            expect(material.normalTexture).toBeDefined();
            expect(material.occlusionTexture).toBeDefined();
            expect(material.emissiveFactor).toEqual([1.0, 1.0, 1.0]);
            expect(material.alphaMode).toBe('OPAQUE');
            expect(material.doubleSided).toBe(false);
        });

        it('does not create specular glossiness texture if decoded texture data is not available', function() {
            options.specularGlossiness = true;

            var material = loadMtl._createMaterial({
                specularTexture : ambientTexture, // Is a .gif which can't be decoded
                specularShininessTexture : specularShininessTexture
            }, options);

            var pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.specularGlossinessTexture).toBeUndefined();
        });

        it('sets material for transparent diffuse texture', function() {
            options.specularGlossiness = true;

            var material = loadMtl._createMaterial({
                diffuseTexture : transparentDiffuseTexture
            }, options);

            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });

        it('packs alpha texture in diffuse texture', function() {
            options.specularGlossiness = true;

            var material = loadMtl._createMaterial({
                diffuseTexture : diffuseTexture,
                alphaTexture : alphaTexture
            }, options);

            var pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.diffuseTexture).toBeDefined();

            var hasBlack = false;
            var hasWhite = false;
            var pixels = pbr.diffuseTexture.pixels;
            var pixelsLength = pixels.length / 4;
            for (var i = 0; i < pixelsLength; ++i) {
                var alpha = pixels[i * 4 + 3];
                hasBlack = hasBlack || (alpha === 0);
                hasWhite = hasWhite || (alpha === 255);
            }
            expect(hasBlack).toBe(true);
            expect(hasWhite).toBe(true);
            expect(pbr.diffuseFactor[3]).toEqual(1);
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });
    });
});
