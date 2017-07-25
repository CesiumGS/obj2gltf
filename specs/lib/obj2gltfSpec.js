'use strict';
var Cesium = require('Cesium');
var fsExtra = require('fs-extra');
var path = require('path');
var Promise = require('bluebird');
var obj2gltf = require('../../lib/obj2gltf');

var objPath = 'specs/data/box-textured/box-textured.obj';
var gltfPath = 'specs/data/box-textured/box-textured.gltf';
var glbPath = 'specs/data/box-textured/box-textured.glb';
var objPathNonExistent = 'specs/data/non-existent.obj';

describe('obj2gltf', function() {
    beforeEach(function() {
        spyOn(fsExtra, 'outputJson').and.returnValue(Promise.resolve());
        spyOn(fsExtra, 'outputFile').and.returnValue(Promise.resolve());
    });

    it('converts obj to gltf', function(done) {
        expect(obj2gltf(objPath, gltfPath)
            .then(function() {
                var args = fsExtra.outputJson.calls.first().args;
                var outputPath = args[0];
                var gltf = args[1];
                expect(path.normalize(outputPath)).toEqual(path.normalize(gltfPath));
                expect(gltf).toBeDefined();
                expect(gltf.images.length).toBe(1);
            }), done).toResolve();
    });

    it('converts obj to glb', function(done) {
        var options = {
            binary : true
        };
        expect(obj2gltf(objPath, gltfPath, options)
            .then(function() {
                var args = fsExtra.outputFile.calls.first().args;
                var outputPath = args[0];
                var glb = args[1];
                expect(path.extname(outputPath)).toBe('.glb');
                var magic = glb.toString('utf8', 0, 4);
                expect(magic).toBe('glTF');
            }), done).toResolve();
    });

    it('converts obj to glb when gltfPath has a .glb extension', function(done) {
        expect(obj2gltf(objPath, glbPath)
            .then(function() {
                var args = fsExtra.outputFile.calls.first().args;
                var outputPath = args[0];
                var glb = args[1];
                expect(path.extname(outputPath)).toBe('.glb');
                var magic = glb.toString('utf8', 0, 4);
                expect(magic).toBe('glTF');
            }), done).toResolve();
    });

    it('writes out separate resources', function(done) {
        var options = {
            separate : true,
            separateTextures : true
        };
        expect(obj2gltf(objPath, gltfPath, options)
            .then(function() {
                expect(fsExtra.outputFile.calls.count()).toBe(2); // Saves out .png and .bin
                expect(fsExtra.outputJson.calls.count()).toBe(1); // Saves out .gltf
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

    it('throws if gltfPath is undefined', function() {
        expect(function() {
            obj2gltf(objPath, undefined);
        }).toThrowDeveloperError();
    });

    it('throws if more than one material type is set', function() {
        var options = {
            metallicRoughness : true,
            specularGlossiness : true
        };
        expect(function() {
            obj2gltf(objPath, gltfPath, options);
        }).toThrowDeveloperError();
    });

    it('throws if metallicRoughnessOcclusionTexture and specularGlossinessTexture are both defined', function() {
        var options = {
            metallicRoughnessOcclusionTexture : 'path/to/metallic-roughness-occlusion/texture',
            specularGlossinessTexture : 'path/to/specular-glossiness/texture'
        };
        expect(function() {
            obj2gltf(objPath, gltfPath, options);
        }).toThrowDeveloperError();
    });
});
