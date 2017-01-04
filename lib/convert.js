'use strict';
var Cesium = require('cesium');
var GltfPipeline = require('gltf-pipeline').Pipeline;
var path = require('path');
var createGltf = require('./gltf');
var loadObj = require('./obj');

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var DeveloperError = Cesium.DeveloperError;

module.exports = convert;

function convert(objPath, gltfPath, options) {
    options = defaultValue(options, defaultValue.EMPTY_OBJECT);
    var binary = defaultValue(options.binary, false);
    var embed = defaultValue(options.embed, true);
    var embedImage = defaultValue(options.embedImage, true);
    var quantize = defaultValue(options.quantize, false);
    var ao = defaultValue(options.ao, false);
    var generateNormals = defaultValue(options.generateNormals, false);
    var optimizeForCesium = defaultValue(options.optimizeForCesium, false);

    if (!defined(objPath)) {
        throw new DeveloperError('objPath is required');
    }

    if (!defined(gltfPath)) {
        throw new DeveloperError('gltfPath is required');
    }

    var basePath = path.dirname(objPath);
    var modelName = path.basename(objPath, path.extname(objPath));
    var extension = path.extname(gltfPath);
    if (extension === '.glb') {
        binary = true;
    }
    gltfPath = path.join(path.dirname(gltfPath), modelName + extension);

    var aoOptions = ao ? {} : undefined;

    var pipelineOptions = {
        binary : binary,
        embed : embed,
        embedImage : embedImage,
        encodeNormals : quantize,
        quantize : quantize,
        compressTextureCoordinates : quantize,
        aoOptions : aoOptions,
        smoothNormals : generateNormals,
        optimizeForCesium : optimizeForCesium,
        createDirectory : false,
        basePath : basePath,
        preserve : true
    };

    return loadObj(objPath)
        .then(function(objData) {
            return createGltf(gltfPath, objData);
        })
        .then(function(gltf) {
            require('fs-extra').outputJsonSync('C:/Users/Sean/Desktop/test.gltf', gltf);
            return GltfPipeline.processJSONToDisk(gltf, gltfPath, pipelineOptions);
        });
}
