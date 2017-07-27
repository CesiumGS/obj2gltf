'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var path = require('path');
var Promise = require('bluebird');
var createGltf = require('./createGltf');
var gltfToGlb = require('./gltfToGlb');
var loadImage = require('./loadImage');
var loadObj = require('./loadObj');
var writeUris = require('./writeUris');

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
 * @param {Boolean} [options.checkTransparency=false] Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @param {Boolean} [options.secure=false] Prevent the converter from reading image or mtl files outside of the input obj directory.
 * @param {String} [options.inputUpAxis='Y'] Up axis of the obj. Choices are 'X', 'Y', and 'Z'.
 * @param {String} [options.outputUpAxis='Y'] Up axis of the converted glTF. Choices are 'X', 'Y', and 'Z'.
 * @param {Boolean} [options.packOcclusion=false] Pack the occlusion texture in the red channel of metallic-roughness texture.
 * @param {Boolean} [options.metallicRoughness=false] The values in the mtl file are already metallic-roughness PBR values and no conversion step should be applied. Metallic is stored in the Ks and map_Ks slots and roughness is stored in the Ns and map_Ns slots.
 * @param {Boolean} [options.specularGlossiness=false] The values in the mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the KHR_materials_pbrSpecularGlossiness extension.
 * @param {Boolean} [options.materialsCommon=false] The glTF will be saved with the KHR_materials_common extension.
 * @param {String} [options.metallicRoughnessOcclusionTexture] Path to the metallic-roughness-occlusion texture used by the model, where occlusion is stored in the red channel, roughness is stored in the green channel, and metallic is stored in the blue channel. This may be used instead of setting texture paths in the .mtl file, and is intended for models that use one material. The model will be saved with a pbrMetallicRoughness material.
 * @param {String} [options.specularGlossinessTexture] Path to the specular-glossiness texture used by the model, where specular color is stored in the red, green, and blue channels and specular glossiness is stored in the alpha channel. This may be used instead of setting texture paths in the .mtl file, and is intended for models that use one material. The model will be saved with a material using the KHR_materials_pbrSpecularGlossiness extension.
 * @param {String} [options.occlusionTexture] Path to the occlusion texture used by the model. This may be used instead of setting texture paths in the .mtl file, and is intended for models that use one material. Ignored if metallicRoughnessOcclusionTexture is also set.
 * @param {String} [options.normalTexture] Path to the normal texture used by the model. This may be used instead of setting texture paths in the .mtl file, and is intended for models that use one material.
 * @param {String} [options.baseColorTexture] Path to the baseColor/diffuse texture used by the model. This may be used instead of setting texture paths in the .mtl file, and is intended for models that use one material.
 * @param {String} [options.emissiveTexture] Path to the emissive texture used by the model. This may be used instead of setting texture paths in the .mtl file, and is intended for models that use one material.

 * @param {Logger} [options.logger] A callback function for handling logged messages. Defaults to console.log.
 * @return {Promise} A promise that resolves when the glTF file is saved.
 */
function obj2gltf(objPath, gltfPath, options) {
    var defaults = obj2gltf.defaults;

    options = defaultValue(options, {});
    var binary = defaultValue(options.binary, defaults.binary);
    var separate = defaultValue(options.separate, defaults.separate);
    var separateTextures = defaultValue(options.separateTextures, defaults.separateTextures) || separate;
    var checkTransparency = defaultValue(options.checkTransparency, defaults.checkTransparency);
    var secure = defaultValue(options.secure, defaults.secure);
    var inputUpAxis = defaultValue(options.inputUpAxis, defaults.inputUpAxis);
    var outputUpAxis = defaultValue(options.outputUpAxis, defaults.outputUpAxis);
    var packOcclusion = defaultValue(options.packOcclusion, defaults.packOcclusion);
    var metallicRoughness = defaultValue(options.metallicRoughness, defaults.metallicRoughness);
    var specularGlossiness = defaultValue(options.specularGlossiness, defaults.specularGlossiness);
    var materialsCommon = defaultValue(options.materialsCommon, defaults.materialsCommon);
    var logger = defaultValue(options.logger, defaults.logger);

    options.separate = separate;
    options.separateTextures = separateTextures;
    options.checkTransparency = checkTransparency;
    options.secure = secure;
    options.inputUpAxis = inputUpAxis;
    options.outputUpAxis = outputUpAxis;
    options.packOcclusion = packOcclusion;
    options.metallicRoughness = metallicRoughness;
    options.specularGlossiness = specularGlossiness;
    options.materialsCommon = materialsCommon;
    options.logger = logger;

    if (!defined(objPath)) {
        throw new DeveloperError('objPath is required');
    }

    if (!defined(gltfPath)) {
        throw new DeveloperError('gltfPath is required');
    }

    if (metallicRoughness + specularGlossiness + materialsCommon > 1) {
        throw new DeveloperError('Only one material type may be set from [--metallicRoughness, --specularGlossiness, --materialsCommon].');
    }

    if (defined(options.metallicRoughnessOcclusionTexture) && defined(options.specularGlossinessTexture)) {
        throw new DeveloperError('options.metallicRoughnessOcclusionTexture and options.specularGlossinessTexture cannot both be defined.');
    }

    if (defined(options.metallicRoughnessOcclusionTexture)) {
        options.metallicRoughness = true;
        options.specularGlossiness = false;
        options.materialsCommon = false;
    }

    if (defined(options.specularGlossinessTexture)) {
        options.metallicRoughness = false;
        options.specularGlossiness = true;
        options.materialsCommon = false;
    }

    var extension = path.extname(gltfPath).toLowerCase();
    var modelName = path.basename(gltfPath, path.extname(gltfPath));
    if (binary || extension === '.glb') {
        binary = true;
        extension = '.glb';
    }

    gltfPath = path.join(path.dirname(gltfPath), modelName + extension);

    return loadOverridingImages(options)
        .then(function() {
            return loadObj(objPath, options);
        })
        .then(function(objData) {
            return createGltf(objData, options);
        })
        .then(function(gltf) {
            return writeUris(gltf, gltfPath, options);
        })
        .then(function(gltf) {
            if (binary) {
                var glb = gltfToGlb(gltf);
                return fsExtra.outputFile(gltfPath, glb);
            }
            var jsonOptions = {
                spaces : 2
            };
            return fsExtra.outputJson(gltfPath, gltf, jsonOptions);
        });
}

function loadOverridingImages(options) {
    // The texture paths supplied in the .mtl may be overriden by the texture path supplied in options
    var checkTransparencyOptions = {
        checkTransparency : options.checkTransparency
    };
    var imagePaths = [options.metallicRoughnessOcclusionTexture, options.specularGlossinessTexture, options.occlusionTexture, options.normalTexture, options.baseColorTexture, options.emissiveTexture];
    imagePaths = imagePaths.filter(function(imagePath) {return defined(imagePath);});
    return Promise.map(imagePaths, function(imagePath) {
        var imageOptions = (imagePath === options.baseColorTexture) ? checkTransparencyOptions : undefined;
        return loadImage(imagePath, imageOptions);
    }).then(function(images) {
        options.overridingImages = images;
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
     * Gets or sets the up axis of the obj.
     * @type String
     * @default 'Y'
     */
    inputUpAxis: 'Y',
    /**
     * Gets or sets the up axis of the converted glTF.
     * @type String
     * @default 'Y'
     */
    outputUpAxis: 'Y',
    /**
     * Gets or sets whether to pack the occlusion texture in the red channel of the metallic-roughness texture.
     * @type Boolean
     * @default false
     */
    packOcclusion: false,
    /**
     * The values in the mtl file are already metallic-roughness PBR values and no conversion step should be applied. Metallic is stored in the Ks and map_Ks slots and roughness is stored in the Ns and map_Ns slots.
     * @type Boolean
     * @default false
     */
    metallicRoughness: false,
    /**
     * The values in the mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the KHR_materials_pbrSpecularGlossiness extension.
     * @type Boolean
     * @default false
     */
    specularGlossiness: false,
    /**
     * The values in the mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the KHR_materials_pbrSpecularGlossiness extension.
     * @type Boolean
     * @default false
     */
    materialsCommon: false,

    /**
     * @private
     */
    logger: function(message) {
        console.log(message);
    }
};

/**
 * A callback function that logs messages.
 * @callback Logger
 *
 * @param {String} message The message to log.
 */
