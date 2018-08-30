'use strict';
var fsExtra = require('fs-extra');
var path = require('path');
var Promise = require('bluebird');
var obj2gltf = require('../../lib/obj2gltf');

var texturedObjPath = 'specs/data/box-textured/box-textured.obj';
var complexObjPath = 'specs/data/box-complex-material/box-complex-material.obj';
var missingMtllibObjPath = 'specs/data/box-missing-mtllib/box-missing-mtllib.obj';

var outputDirectory = 'output';

var textureUrl = 'specs/data/box-textured/cesium.png';

describe('obj2gltf', function() {
    beforeEach(function() {
        spyOn(fsExtra, 'outputFile').and.returnValue(Promise.resolve());
    });

    it('converts obj to gltf', function(done) {
        expect(obj2gltf(texturedObjPath)
            .then(function(gltf) {
                expect(gltf).toBeDefined();
                expect(gltf.images.length).toBe(1);
            }), done).toResolve();
    });

    it('converts obj to glb', function(done) {
        var options = {
            binary : true
        };
        expect(obj2gltf(texturedObjPath, options)
            .then(function(glb) {
                var magic = glb.toString('utf8', 0, 4);
                expect(magic).toBe('glTF');
            }), done).toResolve();
    });

    it('convert obj to gltf with separate resources', function(done) {
        var options = {
            separate : true,
            separateTextures : true,
            outputDirectory : outputDirectory
        };
        expect(obj2gltf(texturedObjPath, options)
            .then(function() {
                expect(fsExtra.outputFile.calls.count()).toBe(2); // Saves out .png and .bin
            }), done).toResolve();
    });

    it('converts obj to glb with separate resources', function(done) {
        var options = {
            separate : true,
            separateTextures : true,
            outputDirectory : outputDirectory,
            binary : true
        };
        expect(obj2gltf(texturedObjPath, options)
            .then(function() {
                expect(fsExtra.outputFile.calls.count()).toBe(2); // Saves out .png and .bin
            }), done).toResolve();
    });

    it('converts obj with multiple textures', function(done) {
        var options = {
            separateTextures : true,
            outputDirectory : outputDirectory
        };
        expect(obj2gltf(complexObjPath, options)
            .then(function() {
                expect(fsExtra.outputFile.calls.count()).toBe(5); // baseColor, metallicRoughness, occlusion, emission, normal
            }), done).toResolve();
    });

    it('sets overriding textures (1)', function(done) {
        var options = {
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
        expect(obj2gltf(complexObjPath, options)
            .then(function() {
                var args = fsExtra.outputFile.calls.allArgs();
                var length = args.length;
                for (var i = 0; i < length; ++i) {
                    expect(path.basename(args[i][0])).toBe(path.basename(textureUrl));
                }
            }), done).toResolve();
    });

    it('sets overriding textures (2)', function(done) {
        var options = {
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
        expect(obj2gltf(complexObjPath, options)
            .then(function() {
                var args = fsExtra.outputFile.calls.allArgs();
                var length = args.length;
                for (var i = 0; i < length; ++i) {
                    expect(path.basename(args[i][0])).toBe(path.basename(textureUrl));
                }
            }), done).toResolve();
    });

    it('uses a custom logger', function(done) {
        var lastMessage;
        var options = {
            logger : function(message) {
                lastMessage = message;
            }
        };
        expect(obj2gltf(missingMtllibObjPath, options)
            .then(function() {
                expect(lastMessage.indexOf('Could not read material file') >= 0).toBe(true);
            }), done).toResolve();
    });

    it('uses a custom writer', function(done) {
        var filePaths = [];
        var fileContents = [];
        var options = {
            separate : true,
            writer : function(relativePath, contents) {
                filePaths.push(relativePath);
                fileContents.push(contents);
            }
        };
        expect(obj2gltf(texturedObjPath, options)
            .then(function() {
                expect(filePaths).toEqual(['box-textured.bin', 'cesium.png']);
                expect(fileContents[0]).toBeDefined();
                expect(fileContents[1]).toBeDefined();
            }), done).toResolve();
    });

    it('throws if objPath is undefined', function() {
        expect(function() {
            obj2gltf(undefined);
        }).toThrowDeveloperError();
    });

    it('throws if both options.writer and options.outputDirectory are undefined when writing separate resources', function() {
        var options = {
            separateTextures : true
        };
        expect(function() {
            obj2gltf(texturedObjPath, options);
        }).toThrowDeveloperError();
    });

    it('throws if more than one material type is set', function() {
        var options = {
            metallicRoughness : true,
            specularGlossiness : true
        };
        expect(function() {
            obj2gltf(texturedObjPath, options);
        }).toThrowDeveloperError();
    });

    it('throws if metallicRoughnessOcclusionTexture and specularGlossinessTexture are both defined', function() {
        var options = {
            overridingTextures : {
                metallicRoughnessOcclusionTexture : textureUrl,
                specularGlossinessTexture : textureUrl
            }
        };
        expect(function() {
            obj2gltf(texturedObjPath, options);
        }).toThrowDeveloperError();
    });

    it('adds KHR_materials_unlit to materials if unlit is set', function(done) {
        var options = {
            unlit : true
        };
        expect(obj2gltf(texturedObjPath, options)
            .then(function(glb) {
                for(var i = 0;i < glb.materials.length; i++) {
                    var material = glb.materials[i];
                    expect(material.extensions.KHR_materials_unlit).toBeDefined();
                }
            }), done).toResolve();
    });
});
