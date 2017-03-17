'use strict';
var GltfPipeline = require('gltf-pipeline').Pipeline;
var path = require('path');
var convert = require('../../lib/convert');
var writeUris = require('../../lib/writeUris');

var objPath = 'specs/data/box-textured/box-textured.obj';
var gltfPath = 'specs/data/box-textured/box-textured.gltf';
var glbPath = 'specs/data/box-textured/box-textured.glb';

describe('convert', function() {
    it('converts an obj to gltf', function(done) {
        var spy = spyOn(GltfPipeline, 'processJSONToDisk');
        expect(convert(objPath, gltfPath)
            .then(function() {
                var args = spy.calls.first().args;
                var gltf = args[0];
                var outputPath = args[1];
                expect(path.normalize(outputPath)).toEqual(path.normalize(gltfPath));
                expect(gltf).toBeDefined();
                expect(gltf.images.cesium).toBeDefined();
            }), done).toResolve();
    });

    it('uses default gltf-pipeline options', function(done) {
        var spy = spyOn(GltfPipeline, 'processJSONToDisk');
        expect(convert(objPath, gltfPath)
            .then(function() {
                var args = spy.calls.first().args;
                var options = args[2];
                expect(options).toEqual({
                    createDirectory : false,
                    basePath : path.dirname(objPath),
                    binary : false,
                    embed : true,
                    embedImage : true,
                    encodeNormals : false,
                    quantize : false,
                    compressTextureCoordinates : false,
                    aoOptions : undefined,
                    smoothNormals : false,
                    optimizeForCesium : false,
                    textureCompressionOptions : undefined,
                    preserve : true
                });
            }), done).toResolve();
    });

    it('sets options', function(done) {
        var spy1 = spyOn(GltfPipeline, 'processJSONToDisk');
        var spy2 = spyOn(writeUris, '_outputFile');
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
            generateNormals : true,
            ao : true,
            optimizeForCesium : true,
            textureCompressionOptions : textureCompressionOptions
        };

        expect(convert(objPath, gltfPath, options)
            .then(function() {
                var args = spy1.calls.first().args;
                var options = args[2];
                expect(options).toEqual({
                    createDirectory : false,
                    basePath : path.dirname(objPath),
                    binary : true,
                    embed : false,
                    embedImage : false,
                    encodeNormals : true,
                    quantize : true,
                    compressTextureCoordinates : true,
                    aoOptions : {},
                    smoothNormals : true,
                    optimizeForCesium : true,
                    textureCompressionOptions : textureCompressionOptions,
                    preserve : false
                });
                expect(spy2.calls.count()).toBe(2); // Saves out .png and .bin
            }), done).toResolve();
    });

    it('saves as binary if gltfPath has a .glb extension', function(done) {
        var spy = spyOn(GltfPipeline, 'processJSONToDisk');
        expect(convert(objPath, glbPath)
            .then(function() {
                var args = spy.calls.first().args;
                var options = args[2];
                expect(options.binary).toBe(true);
            }), done).toResolve();
    });

    it('bypassPipeline flag bypasses gltf-pipeline', function(done) {
        var spy1 = spyOn(convert, '_outputJson');
        var spy2 = spyOn(GltfPipeline, 'processJSONToDisk');
        var options = {
            bypassPipeline : true
        };
        expect(convert(objPath, gltfPath, options)
            .then(function() {
                expect(spy1.calls.count()).toBe(1);
                expect(spy2.calls.count()).toBe(0);
            }), done).toResolve();
    });

    it('throws if objPath is undefined', function() {
        expect(function() {
            convert(undefined, gltfPath);
        }).toThrowDeveloperError();
    });

    it('throws if gltfPath is undefined', function() {
        expect(function() {
            convert(objPath, undefined);
        }).toThrowDeveloperError();
    });
});
