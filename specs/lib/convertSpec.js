'use strict';
var Promise = require('bluebird');

var gltfPipeline = require('gltf-pipeline').gltfPipeline;
var path = require('path');
var convert = require('../../lib/convert');

var objFile = './specs/data/BoxTextured/BoxTextured.obj';
var gltfFile = './specs/data/BoxTextured/BoxTextured.gltf';

describe('convert', function() {
    it('converts an obj to gltf', function(done) {
        var spy = spyOn(gltfPipeline, 'processJSONToDisk').and.callFake(function(gltf, outputPath, options, callback) {
            return;
        });
        expect(convert(objFile, gltfFile, {})
            .then(function() {
                var args = spy.calls.first().args;
                expect(args[0]).toBeDefined();
                expect(path.normalize(args[1])).toEqual(path.normalize(gltfFile));
            }), done).toResolve();
    });
});
