'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var GltfPipeline = require('gltf-pipeline').Pipeline;
var path = require('path');
var Promise = require('bluebird');
var createGltf = require('./gltf');
var loadObj = require('./obj');

var fxExtraOutputFile = Promise.promisify(fsExtra.outputFile);
var fsExtraOutputJson = Promise.promisify(fsExtra.outputJson);

var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;
var DeveloperError = Cesium.DeveloperError;

module.exports = convert;

/**
 * Converts an obj file to a glTF file.
 *
 * @param {String} objPath Path to the obj file.
 * @param {String} gltfPath Path of the converted glTF file.
 * @param {Object} [options] An object with the following properties:
 * @param {Boolean} [options.binary=false] Save as binary glTF.
 * @param {Boolean} [options.separate=false] Writes out separate geometry/animation data files, shader files, and textures instead of embedding them in the glTF.
 * @param {Boolean} [options.separateTextures=false] Write out separate textures only.
 * @param {Boolean} [options.compress=false] Quantize positions, compress texture coordinates, and oct-encode normals.
 * @param {Boolean} [options.optimize=false] Use the optimization stages in the glTF pipeline.
 * @param {Boolean} [options.optimizeForCesium=false] Optimize the glTF for Cesium by using the sun as a default light source.
 * @param {Boolean} [options.generateNormals=false] Generate normals if they are missing.
 * @param {Boolean} [options.ao=false] Apply ambient occlusion to the converted model.
 * @param {Boolean} [options.textureCompressionOptions] Options sent to the compressTextures stage of gltf-pipeline.
 * @param {Boolean} [options.bypassPipeline=false] Bypass the gltf-pipeline for debugging purposes. This option overrides many of the options above and will save the glTF with the KHR_materials_common extension.
 */

function convert(objPath, gltfPath, options) {
    options = defaultValue(options, defaultValue.EMPTY_OBJECT);
    var binary = defaultValue(options.binary, false);
    var separate = defaultValue(options.separate, false);
    var separateTextures = defaultValue(options.separateTextures, false);
    var compress = defaultValue(options.compress, false);
    var optimize = defaultValue(options.optimize, false);
    var optimizeForCesium = defaultValue(options.optimizeForCesium, false);
    var generateNormals = defaultValue(options.generateNormals, false);
    var ao = defaultValue(options.ao, false);
    var textureCompressionOptions = options.textureCompressionOptions;
    var bypassPipeline = defaultValue(options.bypassPipeline, false);

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
        createDirectory : false,
        basePath : basePath,
        binary : binary,
        embed : !separate,
        embedImage : !separate && !separateTextures,
        quantize : compress,
        compressTextureCoordinates : compress,
        encodeNormals : compress,
        preserve : !optimize,
        optimizeForCesium : optimizeForCesium,
        smoothNormals : generateNormals,
        aoOptions : aoOptions,
        textureCompressionOptions : textureCompressionOptions
    };

    return loadObj(objPath)
        .then(function(objData) {
            return createGltf(objData);
        })
        .then(function(gltf) {
            return saveExternalBuffer(gltf, gltfPath);
        })
        .then(function(gltf) {
            if (bypassPipeline) {
                return convert._outputJson(gltfPath, gltf);
            } else {
                return GltfPipeline.processJSONToDisk(gltf, gltfPath, pipelineOptions);
            }
        });
}

/**
 * Exposed for testing
 *
 * @private
 */
convert._outputJson = fsExtraOutputJson;

function saveExternalBuffer(gltf, gltfPath) {
    var buffer = gltf.buffers[Object.keys(gltf.buffers)[0]];
    if (defined(buffer.uri)) {
        return Promise.resolve(gltf);
    }

    var binary = buffer.extras._obj2gltf.binary;
    delete buffer.extras;
    var bufferName = path.basename(gltfPath, path.extname(gltfPath));
    var bufferUri = bufferName + '.bin';
    buffer.uri = bufferUri;
    var bufferPath = path.join(path.dirname(gltfPath), bufferUri);
    return fxExtraOutputFile(bufferPath, binary)
        .then(function() {
            return gltf;
        });
}
