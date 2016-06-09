"use strict";
var path = require('path');
var gltfPipeline = require('gltf-pipeline').gltfPipeline;
var parseObj = require('./obj');
var createGltf = require('./gltf');
var Cesium = require('cesium');
var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;

module.exports = convert;

function convert(objFile, outputPath, options, done) {
    var binary = defaultValue(options.binary, false);
    var embed = defaultValue(options.embed, true);

    if (!defined(objFile)) {
        throw new Error('objFile is required');
    }

    if (!defined(outputPath)) {
        outputPath = path.dirname(objFile);
    }

    var inputPath = path.dirname(objFile);
    var modelName = path.basename(objFile, '.obj');

    var extension = path.extname(outputPath);
    if (extension !== '') {
        modelName = path.basename(outputPath, extension);
        outputPath = path.dirname(outputPath);
    }

    extension = binary ? '.glb' : '.gltf';
    var gltfFile = path.join(outputPath, modelName + extension);

    parseObj(objFile, inputPath, function(data) {
        createGltf(data, modelName, function(gltf) {
            var options = {
                binary : binary,
                embed : embed,
                createDirectory : false
            };
            gltfPipeline.processJSONToDisk(gltf, gltfFile, options, function(error) {
                if (error) {
                    throw error;
                }
                done();
            });
        });
    });
}
