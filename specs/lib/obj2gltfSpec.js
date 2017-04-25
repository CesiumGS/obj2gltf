'use strict';
var fsExtra = require('fs-extra');
var GltfPipeline = require('gltf-pipeline').Pipeline;
var os = require('os');
var path = require('path');
var Promise = require('bluebird');
var obj2gltf = require('../../lib/obj2gltf');
var writeUris = require('../../lib/writeUris');

var objPath = 'specs/data/box-textured/box-textured.obj';
var gltfPath = 'specs/data/box-textured/box-textured.gltf';
var glbPath = 'specs/data/box-textured/box-textured.glb';
var objPathNonExistent = 'specs/data/non-existent.obj';

describe('obj2gltf', function() {
    var tempDirectory;

    beforeAll(function() {
        expect(obj2gltf._getTempDirectory()).toContain(os.tmpdir());
        tempDirectory = path.join(os.tmpdir(), 'testPath');
        spyOn(obj2gltf, '_getTempDirectory').and.returnValue(tempDirectory);
        spyOn(obj2gltf, '_outputJson');
        spyOn(writeUris, '_outputFile');
        spyOn(fsExtra, 'remove');
    });

    beforeEach(function() {
        spyOn(GltfPipeline, 'processJSONToDisk').and.returnValue(Promise.resolve());
    });

    it('converts an obj to gltf', function(done) {
        expect(obj2gltf(objPath, gltfPath)
            .then(function() {
                var args = GltfPipeline.processJSONToDisk.calls.first().args;
                var gltf = args[0];
                var outputPath = args[1];
                var options = args[2];
                expect(path.normalize(outputPath)).toEqual(path.normalize(gltfPath));
                expect(gltf).toBeDefined();
                expect(gltf.images.cesium).toBeDefined();
                expect(options).toEqual({
                    basePath : tempDirectory,
                    createDirectory : false,
                    binary : false,
                    embed : true,
                    embedImage : true,
                    encodeNormals : false,
                    quantize : false,
                    compressTextureCoordinates : false,
                    aoOptions : undefined,
                    kmcOptions : undefined,
                    smoothNormals : false,
                    optimizeForCesium : false,
                    textureCompressionOptions : undefined,
                    preserve : true
                });
            }), done).toResolve();
    });

    it('sets options', function(done) {
        var textureCompressionOptions = {
            format : 'dxt1',
            quality : 10
        };
        var options = {
            binary : true,
            separate : true,
            separateTextures : true,
            compress : true,
            optimize : true,
            optimizeForCesium : true,
            generateNormals : true,
            ao : true,
            kmc : true,
            textureCompressionOptions : textureCompressionOptions,
            checkTransparency : true,
            secure : true,
            logger : obj2gltf.defaults.logger
        };

        expect(obj2gltf(objPath, gltfPath, options)
            .then(function() {
                var args = GltfPipeline.processJSONToDisk.calls.first().args;
                var options = args[2];
                expect(options).toEqual({
                    basePath : tempDirectory,
                    createDirectory : false,
                    binary : true,
                    embed : false,
                    embedImage : false,
                    encodeNormals : true,
                    quantize : true,
                    compressTextureCoordinates : true,
                    aoOptions : {},
                    kmcOptions : {},
                    smoothNormals : true,
                    optimizeForCesium : true,
                    textureCompressionOptions : textureCompressionOptions,
                    preserve : false
                });
                expect(writeUris._outputFile.calls.count()).toBe(2); // Saves out .png and .bin
            }), done).toResolve();
    });

    it('saves as binary if gltfPath has a .glb extension', function(done) {
        expect(obj2gltf(objPath, glbPath)
            .then(function() {
                var args = GltfPipeline.processJSONToDisk.calls.first().args;
                var options = args[2];
                expect(options.binary).toBe(true);
            }), done).toResolve();
    });

    it('bypassPipeline flag bypasses gltf-pipeline', function(done) {
        var options = {
            bypassPipeline : true
        };
        expect(obj2gltf(objPath, gltfPath, options)
            .then(function() {
                expect(obj2gltf._outputJson).toHaveBeenCalled();
                expect(GltfPipeline.processJSONToDisk).not.toHaveBeenCalled();
            }), done).toResolve();
    });

    it('rejects if obj path does not exist', function(done) {
        expect(obj2gltf(objPathNonExistent, gltfPath), done).toRejectWith(Error);
    });

    it('throws if objPath is undefined', function() {
        expect(function() {
            obj2gltf(undefined, gltfPath);
        }).toThrowDeveloperError();
    });

    it('rejects if gltfPath is undefined', function() {
        expect(function() {
            obj2gltf(objPath, undefined);
        }).toThrowDeveloperError();
    });
});
