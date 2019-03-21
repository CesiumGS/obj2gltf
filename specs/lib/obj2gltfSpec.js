'use strict';
const { DeveloperError } = require('cesium');
const fsExtra = require('fs-extra');
const path = require('path');
const Promise = require('bluebird');
const createGltf = require('../../lib/createGltf');
const obj2gltf = require('../../lib/obj2gltf');

const texturedObjPath = 'specs/data/box-textured/box-textured.obj';
const complexObjPath = 'specs/data/box-complex-material/box-complex-material.obj';
const missingMtllibObjPath = 'specs/data/box-missing-mtllib/box-missing-mtllib.obj';

const outputDirectory = 'output';

const textureUrl = 'specs/data/box-textured/cesium.png';

describe('obj2gltf', () => {
    beforeEach(() => {
        spyOn(fsExtra, 'outputFile').and.returnValue(Promise.resolve());
    });

    it('converts obj to gltf', async () => {
        const gltf = await obj2gltf(texturedObjPath);
        expect(gltf).toBeDefined();
        expect(gltf.images.length).toBe(1);
    });

    it('converts obj to glb', async () => {
        const options = {
            binary : true
        };
        const glb = await obj2gltf(texturedObjPath, options);
        const magic = glb.toString('utf8', 0, 4);
        expect(magic).toBe('glTF');
    });

    it('convert obj to gltf with separate resources', async () => {
        const options = {
            separate : true,
            separateTextures : true,
            outputDirectory : outputDirectory
        };
        await obj2gltf(texturedObjPath, options);
        expect(fsExtra.outputFile.calls.count()).toBe(2); // Saves out .png and .bin
    });

    it('convert obj to gltf with separate resources when buffer exceeds Node limit', async () => {
        spyOn(createGltf, '_getBufferMaxByteLength').and.returnValue(0);
        const options = {
            separate : true,
            separateTextures : true,
            outputDirectory : outputDirectory
        };
        await obj2gltf(texturedObjPath, options);
        expect(fsExtra.outputFile.calls.count()).toBe(5); // Saves out .png and four .bin for positions, normals, uvs, and indices
    });

    it('converts obj to glb with separate resources', async () => {
        const options = {
            separate : true,
            separateTextures : true,
            outputDirectory : outputDirectory,
            binary : true
        };
        await obj2gltf(texturedObjPath, options);
        expect(fsExtra.outputFile.calls.count()).toBe(2); // Saves out .png and .bin
    });

    it('converts obj with multiple textures', async () => {
        const options = {
            separateTextures : true,
            outputDirectory : outputDirectory
        };
        await obj2gltf(complexObjPath, options);
        expect(fsExtra.outputFile.calls.count()).toBe(5); // baseColor, metallicRoughness, occlusion, emission, normal
    });

    it('sets overriding textures (1)', async () => {
        const options = {
            overridingTextures : {
                metallicRoughnessOcclusionTexture : textureUrl,
                normalTexture : textureUrl,
                baseColorTexture : textureUrl,
                emissiveTexture : textureUrl,
                alphaTexture : textureUrl
            },
            separateTextures : true,
            outputDirectory : outputDirectory
        };
        await obj2gltf(complexObjPath, options);
        const args = fsExtra.outputFile.calls.allArgs();
        const length = args.length;
        for (let i = 0; i < length; ++i) {
            expect(path.basename(args[i][0])).toBe(path.basename(textureUrl));
        }
    });

    it('sets overriding textures (2)', async () => {
        const options = {
            overridingTextures : {
                specularGlossinessTexture : textureUrl,
                occlusionTexture : textureUrl,
                normalTexture : textureUrl,
                baseColorTexture : textureUrl,
                emissiveTexture : textureUrl,
                alphaTexture : textureUrl
            },
            separateTextures : true,
            outputDirectory : outputDirectory
        };
        await obj2gltf(complexObjPath, options);
        const args = fsExtra.outputFile.calls.allArgs();
        const length = args.length;
        for (let i = 0; i < length; ++i) {
            expect(path.basename(args[i][0])).toBe(path.basename(textureUrl));
        }
    });

    it('uses a custom logger', async () => {
        let lastMessage;
        const options = {
            logger : (message) => {
                lastMessage = message;
            }
        };
        await obj2gltf(missingMtllibObjPath, options);
        expect(lastMessage.indexOf('Could not read material file') >= 0).toBe(true);
    });

    it('uses a custom writer', async () => {
        const filePaths = [];
        const fileContents = [];
        const options = {
            separate : true,
            writer : (relativePath, contents) => {
                filePaths.push(relativePath);
                fileContents.push(contents);
            }
        };
        await obj2gltf(texturedObjPath, options);
        expect(filePaths).toEqual(['cesium.png', 'box-textured.bin']);
        expect(fileContents[0]).toBeDefined();
        expect(fileContents[1]).toBeDefined();
    });

    it('throws if objPath is undefined', () => {
        let thrownError;
        try {
            obj2gltf(undefined);
        } catch (e) {
            thrownError = e;
        }
        expect(thrownError).toEqual(new DeveloperError('objPath is required'));
    });

    it('throws if both options.writer and options.outputDirectory are undefined when writing separate resources', () => {
        const options = {
            separateTextures : true
        };

        let thrownError;
        try {
            obj2gltf(texturedObjPath, options);
        } catch (e) {
            thrownError = e;
        }
        expect(thrownError).toEqual(new DeveloperError('Either options.writer or options.outputDirectory must be defined when writing separate resources.'));
    });

    it('throws if more than one material type is set', () => {
        const options = {
            metallicRoughness : true,
            specularGlossiness : true
        };

        let thrownError;
        try {
            obj2gltf(texturedObjPath, options);
        } catch (e) {
            thrownError = e;
        }
        expect(thrownError).toEqual(new DeveloperError('Only one material type may be set from [metallicRoughness, specularGlossiness, unlit].'));
    });

    it('throws if metallicRoughnessOcclusionTexture and specularGlossinessTexture are both defined', () => {
        const options = {
            overridingTextures : {
                metallicRoughnessOcclusionTexture : textureUrl,
                specularGlossinessTexture : textureUrl
            }
        };

        let thrownError;
        try {
            obj2gltf(texturedObjPath, options);
        } catch (e) {
            thrownError = e;
        }
        expect(thrownError).toEqual(new DeveloperError('metallicRoughnessOcclusionTexture and specularGlossinessTexture cannot both be defined.'));
    });
});
