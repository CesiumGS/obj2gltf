'use strict';
var fs = require('fs');
var path = require('path');
var convert = require('../../lib/convert');

var objFile = './specs/data/BoxTextured/BoxTextured.obj';
var gltfFile = './specs/data/BoxTextured/BoxTextured.gltf';

describe('convert', function() {
    it('converts an obj to gltf', function(done) {
        var spy = spyOn(fs, 'writeFile').and.callFake(function(file, data, callback) {
            callback();
        });

        convert(objFile, gltfFile, {}, function() {
            expect(path.normalize(spy.calls.first().args[0])).toEqual(path.normalize(gltfFile));
            done();
        });
    });
});
