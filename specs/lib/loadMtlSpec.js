'use strict';
const Cesium = require('cesium');
const fsExtra = require('fs-extra');
const loadMtl = require('../../lib/loadMtl');
const loadTexture = require('../../lib/loadTexture');
const obj2gltf = require('../../lib/obj2gltf');

const clone = Cesium.clone;

const coloredMaterialPath = 'specs/data/box/box.mtl';
const texturedMaterialPath = 'specs/data/box-complex-material/box-complex-material.mtl';
const texturedWithOptionsMaterialPath = 'specs/data/box-texture-options/box-texture-options.mtl';
const multipleMaterialsPath = 'specs/data/box-multiple-materials/box-multiple-materials.mtl';
const externalMaterialPath = 'specs/data/box-external-resources/box-external-resources.mtl';
const resourcesInRootMaterialPath = 'specs/data/box-resources-in-root/box-resources-in-root.mtl';
const externalInRootMaterialPath = 'specs/data/box-external-resources-in-root/box-external-resources-in-root.mtl';
const transparentMaterialPath = 'specs/data/box-transparent/box-transparent.mtl';
const diffuseAmbientSameMaterialPath = 'specs/data/box-diffuse-ambient-same/box-diffuse-ambient-same.mtl';

const diffuseTexturePath = 'specs/data/box-textured/cesium.png';
const transparentDiffuseTexturePath = 'specs/data/box-complex-material/diffuse.png';
const alphaTexturePath = 'specs/data/box-complex-material-alpha/alpha.png';
const ambientTexturePath = 'specs/data/box-complex-material/ambient.gif';
const normalTexturePath = 'specs/data/box-complex-material/bump.png';
const emissiveTexturePath = 'specs/data/box-complex-material/emission.jpg';
const specularTexturePath = 'specs/data/box-complex-material/specular.jpeg';
const specularShininessTexturePath = 'specs/data/box-complex-material/shininess.png';

let diffuseTexture;
let transparentDiffuseTexture;
let alphaTexture;
let ambientTexture;
let normalTexture;
let emissiveTexture;
let specularTexture;
let specularShininessTexture;

const checkTransparencyOptions = {
    checkTransparency : true
};
const decodeOptions = {
    decode : true
};

let options;

describe('loadMtl', () => {
    beforeAll(async () => {
        diffuseTexture = await loadTexture(diffuseTexturePath, decodeOptions);
        transparentDiffuseTexture = await loadTexture(transparentDiffuseTexturePath, checkTransparencyOptions);
        alphaTexture = await loadTexture(alphaTexturePath, decodeOptions);
        ambientTexture = await loadTexture(ambientTexturePath);
        normalTexture = await loadTexture(normalTexturePath);
        emissiveTexture = await loadTexture(emissiveTexturePath);
        specularTexture = await loadTexture(specularTexturePath, decodeOptions);
        specularShininessTexture = await loadTexture(specularShininessTexturePath, decodeOptions);
    });

    beforeEach(() => {
        options = clone(obj2gltf.defaults);
        options.overridingTextures = {};
        options.logger = () => {};
    });

    it('loads mtl', async () => {
        options.metallicRoughness = true;
        const materials = await loadMtl(coloredMaterialPath, options);
        expect(materials.length).toBe(1);
        const material = materials[0];
        const pbr = material.pbrMetallicRoughness;
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
    });

    it('loads mtl with textures', async () => {
        options.metallicRoughness = true;
        const materials = await loadMtl(texturedMaterialPath, options);
        expect(materials.length).toBe(1);
        const material = materials[0];
        const pbr = material.pbrMetallicRoughness;
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
    });

    it('loads mtl with textures having options', async () => {
        options.metallicRoughness = true;
        const materials = await loadMtl(texturedWithOptionsMaterialPath, options);
        expect(materials.length).toBe(1);
        const material = materials[0];
        const pbr = material.pbrMetallicRoughness;
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
    });

    it('loads mtl with multiple materials', async () => {
        options.metallicRoughness = true;
        const materials = await loadMtl(multipleMaterialsPath, options);
        expect(materials.length).toBe(3);
        expect(materials[0].name).toBe('Blue');
        expect(materials[0].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.0, 0.64, 1.0]);
        expect(materials[1].name).toBe('Green');
        expect(materials[1].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.64, 0.0, 1.0]);
        expect(materials[2].name).toBe('Red');
        expect(materials[2].pbrMetallicRoughness.baseColorFactor).toEqual([0.64, 0.0, 0.0, 1.0]);
    });

    it('sets overriding textures', async () => {
        spyOn(fsExtra, 'readFile').and.callThrough();
        options.overridingTextures = {
            metallicRoughnessOcclusionTexture : alphaTexturePath,
            baseColorTexture : alphaTexturePath,
            emissiveTexture : emissiveTexturePath
        };
        const materials = await loadMtl(texturedMaterialPath, options);
        const material = materials[0];
        const pbr = material.pbrMetallicRoughness;
        expect(pbr.baseColorTexture.name).toBe('alpha');
        expect(pbr.metallicRoughnessTexture.name).toBe('alpha');
        expect(material.emissiveTexture.name).toBe('emission');
        expect(material.normalTexture.name).toBe('bump');
        expect(fsExtra.readFile.calls.count()).toBe(3);
    });

    it('loads texture outside of the mtl directory', async () => {
        const materials = await loadMtl(externalMaterialPath, options);
        const material = materials[0];
        const baseColorTexture = material.pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.source).toBeDefined();
        expect(baseColorTexture.name).toBe('cesium');
    });

    it('does not load texture outside of the mtl directory when secure is true', async () => {
        const spy = jasmine.createSpy('logger');
        options.logger = spy;
        options.secure = true;

        const materials = await loadMtl(externalMaterialPath, options);
        const material = materials[0];
        const baseColorTexture = material.pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture).toBeUndefined();
        expect(spy.calls.argsFor(0)[0].indexOf('Texture file is outside of the mtl directory and the secure flag is true. Attempting to read the texture file from within the obj directory instead') >= 0).toBe(true);
        expect(spy.calls.argsFor(1)[0].indexOf('ENOENT') >= 0).toBe(true);
        expect(spy.calls.argsFor(2)[0].indexOf('Could not read texture file') >= 0).toBe(true);
    });

    it('loads textures from root directory when the texture paths do not exist', async () => {
        const materials = await loadMtl(resourcesInRootMaterialPath, options);
        const material = materials[0];
        const baseColorTexture = material.pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.source).toBeDefined();
        expect(baseColorTexture.name).toBe('cesium');
    });

    it('loads textures from root directory when texture is outside of the mtl directory and secure is true', async () => {
        options.secure = true;

        const materials = await loadMtl(externalInRootMaterialPath, options);
        const material = materials[0];
        const baseColorTexture = material.pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.source).toBeDefined();
        expect(baseColorTexture.name).toBe('cesium');
    });

    it('alpha of 0.0 is treated as 1.0', async () => {
        const materials = await loadMtl(transparentMaterialPath, options);
        expect(materials.length).toBe(1);
        const material = materials[0];
        const pbr = material.pbrMetallicRoughness;
        expect(pbr.baseColorTexture).toBeUndefined();
        expect(pbr.metallicRoughnessTexture).toBeUndefined();
        expect(pbr.baseColorFactor[3]).toEqual(1.0);
        expect(material.alphaMode).toBe('OPAQUE');
        expect(material.doubleSided).toBe(false);
    });

    it('ambient texture is ignored if it is the same as the diffuse texture', async () => {
        const materials = await loadMtl(diffuseAmbientSameMaterialPath, options);
        expect(materials.length).toBe(1);
        const material = materials[0];
        const pbr = material.pbrMetallicRoughness;
        expect(pbr.baseColorTexture).toBeDefined();
        expect(pbr.occlusionTexture).toBeUndefined();
    });

    describe('metallicRoughness', () => {
        it('creates default material', () => {
            const material = loadMtl._createMaterial(undefined, options);
            const pbr = material.pbrMetallicRoughness;
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

        it('creates material with textures', () => {
            options.metallicRoughness = true;

            const material = loadMtl._createMaterial({
                diffuseTexture : diffuseTexture,
                ambientTexture : ambientTexture,
                normalTexture : normalTexture,
                emissiveTexture : emissiveTexture,
                specularTexture : specularTexture,
                specularShininessTexture : specularShininessTexture
            }, options);

            const pbr = material.pbrMetallicRoughness;
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

        it('packs occlusion in metallic roughness texture', () => {
            options.metallicRoughness = true;
            options.packOcclusion = true;

            const material = loadMtl._createMaterial({
                ambientTexture : alphaTexture,
                specularTexture : specularTexture,
                specularShininessTexture : specularShininessTexture
            }, options);

            const pbr = material.pbrMetallicRoughness;
            expect(pbr.metallicRoughnessTexture).toBeDefined();
            expect(pbr.metallicRoughnessTexture).toBe(material.occlusionTexture);
        });

        it('does not create metallic roughness texture if decoded texture data is not available', () => {
            options.metallicRoughness = true;
            options.packOcclusion = true;

            const material = loadMtl._createMaterial({
                ambientTexture : ambientTexture, // Is a .gif which can't be decoded
                specularTexture : specularTexture,
                specularShininessTexture : specularShininessTexture
            }, options);

            const pbr = material.pbrMetallicRoughness;
            expect(pbr.metallicRoughnessTexture).toBeUndefined();
            expect(material.occlusionTexture).toBeUndefined();
        });

        it('sets material for transparent diffuse texture', () => {
            options.metallicRoughness = true;

            const material = loadMtl._createMaterial({
                diffuseTexture : transparentDiffuseTexture
            }, options);
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });

        it('packs alpha texture in base color texture', () => {
            options.metallicRoughness = true;

            const material = loadMtl._createMaterial({
                diffuseTexture : diffuseTexture,
                alphaTexture : alphaTexture
            }, options);

            const pbr = material.pbrMetallicRoughness;
            expect(pbr.baseColorTexture).toBeDefined();

            let hasBlack = false;
            let hasWhite = false;
            const pixels = pbr.baseColorTexture.pixels;
            const pixelsLength = pixels.length / 4;
            for (let i = 0; i < pixelsLength; ++i) {
                const alpha = pixels[i * 4 + 3];
                hasBlack = hasBlack || (alpha === 0);
                hasWhite = hasWhite || (alpha === 255);
            }
            expect(hasBlack).toBe(true);
            expect(hasWhite).toBe(true);
            expect(pbr.baseColorFactor[3]).toEqual(1);
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });

        it('uses diffuse texture if diffuse and alpha are the same', async () => {
            options.metallicRoughness = true;

            // The transparent property will be modified so make a copy
            const diffuseTextureCopy = await loadTexture(diffuseTexturePath, decodeOptions);
            const material = loadMtl._createMaterial({
                diffuseTexture : diffuseTextureCopy,
                alphaTexture : diffuseTexture
            }, options);

            const pbr = material.pbrMetallicRoughness;
            expect(pbr.baseColorTexture).toBe(diffuseTextureCopy);
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });
    });

    describe('specularGlossiness', () => {
        it('creates default material', () => {
            options.specularGlossiness = true;
            const material = loadMtl._createMaterial(undefined, options);
            const pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
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

        it('creates material with textures', () => {
            options.specularGlossiness = true;

            const material = loadMtl._createMaterial({
                diffuseTexture : diffuseTexture,
                ambientTexture : ambientTexture,
                normalTexture : normalTexture,
                emissiveTexture : emissiveTexture,
                specularTexture : specularTexture,
                specularShininessTexture : specularShininessTexture
            }, options);

            const pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
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

        it('does not create specular glossiness texture if decoded texture data is not available', () => {
            options.specularGlossiness = true;

            const material = loadMtl._createMaterial({
                specularTexture : ambientTexture, // Is a .gif which can't be decoded
                specularShininessTexture : specularShininessTexture
            }, options);

            const pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.specularGlossinessTexture).toBeUndefined();
        });

        it('sets material for transparent diffuse texture', () => {
            options.specularGlossiness = true;

            const material = loadMtl._createMaterial({
                diffuseTexture : transparentDiffuseTexture
            }, options);

            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });

        it('packs alpha texture in diffuse texture', () => {
            options.specularGlossiness = true;

            const material = loadMtl._createMaterial({
                diffuseTexture : diffuseTexture,
                alphaTexture : alphaTexture
            }, options);

            const pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.diffuseTexture).toBeDefined();

            let hasBlack = false;
            let hasWhite = false;
            const pixels = pbr.diffuseTexture.pixels;
            const pixelsLength = pixels.length / 4;
            for (let i = 0; i < pixelsLength; ++i) {
                const alpha = pixels[i * 4 + 3];
                hasBlack = hasBlack || (alpha === 0);
                hasWhite = hasWhite || (alpha === 255);
            }
            expect(hasBlack).toBe(true);
            expect(hasWhite).toBe(true);
            expect(pbr.diffuseFactor[3]).toEqual(1);
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });

        it('uses diffuse texture if diffuse and alpha are the same', async () => {
            options.specularGlossiness = true;

            // The transparent property will be modified so make a copy
            const diffuseTextureCopy = await loadTexture(diffuseTexturePath, decodeOptions);
            const material = loadMtl._createMaterial({
                diffuseTexture : diffuseTextureCopy,
                alphaTexture : diffuseTexture
            }, options);

            const pbr = material.extensions.KHR_materials_pbrSpecularGlossiness;
            expect(pbr.diffuseTexture).toEqual(diffuseTextureCopy);
            expect(material.alphaMode).toBe('BLEND');
            expect(material.doubleSided).toBe(true);
        });
    });
});
