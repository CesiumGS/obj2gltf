'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var GltfPipeline = require('gltf-pipeline').Pipeline;
var path = require('path');
var Promise = require('bluebird');
var createGltf = require('./createGltf');
var loadObj = require('./loadObj');
var writeUris = require('./writeUris');

var fsExtraOutputJson = Promise.promisify(fsExtra.outputJson);

var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;
var DeveloperError = Cesium.DeveloperError;

module.exports = obj2gltf;

/**
 * Converts an obj file to a glTF file.
 *
 * @param {String} objPath Path to the obj file.
 * @param {String} gltfPath Path of the converted glTF file.
 * @param {Object} [options] An object with the following properties:
 * @param {Boolean} [options.binary=false] Save as binary glTF.
 * @param {Boolean} [options.separate=false] Writes out separate geometry data files, shader files, and textures instead of embedding them in the glTF.
 * @param {Boolean} [options.separateTextures=false] Write out separate textures only.
 * @param {Boolean} [options.compress=false] Quantize positions, compress texture coordinates, and oct-encode normals.
 * @param {Boolean} [options.optimize=false] Optimize the glTF for size and runtime performance.
 * @param {Boolean} [options.optimizeForCesium=false] Optimize the glTF for Cesium by using the sun as a default light source.
 * @param {Boolean} [options.generateNormals=false] Generate normals if they are missing.
 * @param {Boolean} [options.ao=false] Apply ambient occlusion to the converted model.
 * @param {Boolean} [options.kmc=false] Output glTF with the KHR_materials_common extension.
 * @param {Boolean} [options.textureCompressionOptions] Options sent to the compressTextures stage of gltf-pipeline.
 * @param {Boolean} [options.bypassPipeline=false] Bypass the gltf-pipeline for debugging purposes. This option overrides many of the options above and will save the glTF with the KHR_materials_common extension.
 * @param {Boolean} [options.checkTransparency=false] Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @param {Boolean} [options.secure=false] Prevent the converter from reading image or mtl files outside of the input obj directory.
 * @param {Logger} [options.logger] A callback function for handling logged messages. Defaults to console.log.
 */
function obj2gltf(objPath, gltfPath, options) {
    var defaults = obj2gltf.defaults;

    options = defaultValue(options, {});
    var binary = defaultValue(options.binary, defaults.binary);
    var separate = defaultValue(options.separate, defaults.separate);
    var separateTextures = defaultValue(options.separateTextures, defaults.separateTextures) || separate;
    var compress = defaultValue(options.compress, defaults.compress);
    var optimize = defaultValue(options.optimize, defaults.optimize);
    var optimizeForCesium = defaultValue(options.optimizeForCesium, defaults.optimizeForCesium);
    var generateNormals = defaultValue(options.generateNormals, defaults.generateNormals);
    var ao = defaultValue(options.ao, defaults.ao);
    var kmc = defaultValue(options.kmc, defaults.kmc);
    var textureCompressionOptions = options.textureCompressionOptions;
    var bypassPipeline = defaultValue(options.bypassPipeline, defaults.bypassPipeline);
    var checkTransparency = defaultValue(options.checkTransparency, defaults.checkTransparency);
    var secure = defaultValue(options.secure, defaults.secure);
    var logger = defaultValue(options.logger, defaults.logger);

    options.separate = separate;
    options.separateTextures = separateTextures;
    options.checkTransparency = checkTransparency;
    options.secure = secure;
    options.logger = logger;


    if (!defined(objPath)) {
        throw new DeveloperError('objPath is required');
    }

    if (!defined(gltfPath)) {
        throw new DeveloperError('gltfPath is required');
    }

    var extension = path.extname(gltfPath).toLowerCase();
    var basePath = path.dirname(gltfPath);
    var modelName = path.basename(gltfPath, path.extname(gltfPath));
    if (extension === '.glb') {
        binary = true;
    }

    if (binary && bypassPipeline) {
        throw new DeveloperError('--bypassPipeline does not convert to binary glTF');
    }

    gltfPath = path.join(path.dirname(gltfPath), modelName + extension);

    var aoOptions = ao ? {} : undefined;
    var kmcOptions = kmc ? {} : undefined;

    var pipelineOptions = {
        createDirectory : false,
        basePath : basePath,
        binary : binary,
        embed : !separate,
        embedImage : !separateTextures,
        quantize : compress,
        compressTextureCoordinates : compress,
        encodeNormals : compress,
        preserve : !optimize,
        optimizeForCesium : optimizeForCesium,
        smoothNormals : generateNormals,
        aoOptions : aoOptions,
        kmcOptions : kmcOptions,
        textureCompressionOptions : textureCompressionOptions
    };

    return loadObj(objPath, options)
        .then(function(objData) {
            return createGltf(objData);
        })
        .then(function(gltf) {
            return writeUris(gltf, gltfPath, options);
        })
        .then(function(gltf) {
            if (bypassPipeline) {
                return obj2gltf._outputJson(gltfPath, gltf);
            } else {
                return GltfPipeline.processJSONToDisk(gltf, gltfPath, pipelineOptions);
            }
        });
}

/**
 * Default values that will be used when calling obj2gltf(options) unless specified in the options object.
 */
obj2gltf.defaults = {
    /**
     * Gets or sets whether the model will be saved as binary glTF.
     * @type Boolean
     * @default false
     */
    binary: false,
    /**
     * Gets or sets whether to write out separate geometry/animation data files,
     * shader files, and textures instead of embedding them in the glTF.
     * @type Boolean
     * @default false
     */
    separate: false,
    /**
     * Gets or sets whether to write out separate textures only.
     * @type Boolean
     * @default false
     */
    separateTextures: false,
    /**
     * Gets or sets whether to compress attribute data. This includes quantizing positions, compressing texture coordinates, and oct-encoding normals.
     * @type Boolean
     * @default false
     */
    compress: false,
    /**
     * Gets or sets whether the model is optimized for size and runtime performance.
     * @type Boolean
     * @default false
     */
    optimize: false,
    /**
     * Gets or sets whether the model is optimized for Cesium by using the sun as a default light source.
     * @type Boolean
     * @default false
     */
    optimizeForCesium: false,
    /**
     * Gets or sets whether normals will be generated for the model if they are missing.
     * @type Boolean
     * @default false
     */
    generateNormals: false,
    /**
     * Gets or sets whether the model will have ambient occlusion applied.
     * @type Boolean
     * @default false
     */
    ao: false,
    /**
     * Gets or sets whether the model will be saved with the KHR_materials_common extension.
     * @type Boolean
     * @default false
     */
    kmc: false,
    /**
     * Gets or sets whether the converter will bypass the gltf-pipeline for debugging purposes.
     * @type Boolean
     * @default false
     */
    bypassPipeline: false,
    /**
     * Gets or sets whether the converter will do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
     * @type Boolean
     * @default false
     */
    checkTransparency: false,
    /**
     * Gets or sets whether the source model can reference paths outside of its directory.
     * @type Boolean
     * @default false
     */
    secure: false,
    /**
     * @private
     */
    logger: function(message) {
        console.log(message);
    }
};

/**
 * Exposed for testing
 *
 * @private
 */
obj2gltf._outputJson = fsExtraOutputJson;

/**
 * A callback function that logs messages.
 * @callback Logger
 *
 * @param {String} message The message to log.
 */

