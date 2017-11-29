'use strict';
var Cesium = require('cesium');
var path = require('path');
var Promise = require('bluebird');
var loadTexture = require('./loadTexture');
var outsideDirectory = require('./outsideDirectory');
var readLines = require('./readLines');
var Texture = require('./Texture');

var CesiumMath = Cesium.Math;
var combine = Cesium.combine;
var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;

module.exports = loadMtl;

/**
 * Parse a .mtl file and load textures referenced within. Returns an array of glTF materials with Texture
 * objects stored in the texture slots.
 * <p>
 * Packed PBR textures (like metallicRoughnessOcclusion and specularGlossiness) require all input textures to be decoded before hand.
 * If a texture is of an unsupported format like .gif or .tga it can't be packed and a metallicRoughness texture will not be created.
 * Similarly if a texture cannot be found it will be ignored and a default value will be used instead.
 * </p>
 *
 * @param {String} mtlPath Path to the .mtl file.
 * @param {Object} options The options object passed along from lib/obj2gltf.js
 * @param {Boolean} options.hasNormals Whether the model has normals.
 * @returns {Promise} A promise resolving to an array of glTF materials with Texture objects stored in the texture slots.
 *
 * @private
 */
function loadMtl(mtlPath, options) {
    var material;
    var values;
    var value;
    var texturePath;

    var mtlDirectory = path.dirname(mtlPath);
    var materials = [];
    var texturePromiseMap = {}; // Maps texture paths to load promises so that no texture is loaded twice
    var texturePromises = [];

    var overridingTextures = options.overridingTextures;
    var overridingSpecularTexture = defaultValue(overridingTextures.metallicRoughnessOcclusionTexture, overridingTextures.specularGlossinessTexture);
    var overridingSpecularShininessTexture = defaultValue(overridingTextures.metallicRoughnessOcclusionTexture, overridingTextures.specularGlossinessTexture);
    var overridingAmbientTexture = defaultValue(overridingTextures.metallicRoughnessOcclusionTexture, overridingTextures.occlusionTexture);
    var overridingNormalTexture = overridingTextures.normalTexture;
    var overridingDiffuseTexture = overridingTextures.baseColorTexture;
    var overridingEmissiveTexture = overridingTextures.emissiveTexture;

    // Textures that are packed into PBR textures need to be decoded first
    var decodeOptions = options.materialsCommon ? undefined : {
        decode : true
    };

    var diffuseTextureOptions = {
        checkTransparency : options.checkTransparency
    };

    var ambientTextureOptions = options.packOcclusion ? decodeOptions : undefined;
    var specularTextureOptions = decodeOptions;
    var specularShinessTextureOptions = decodeOptions;
    var emissiveTextureOptions;
    var normalTextureOptions;

    function createMaterial(name) {
        material = new Material();
        material.name = name;
        material.specularShininess = options.metallicRoughness ? 1.0 : 0.0;
        loadMaterialTexture(material, 'specularTexture', overridingSpecularTexture, undefined, mtlDirectory, texturePromiseMap, texturePromises, options);
        loadMaterialTexture(material, 'specularShininessTexture', overridingSpecularShininessTexture, undefined, mtlDirectory, texturePromiseMap, texturePromises, options);
        loadMaterialTexture(material, 'ambientTexture', overridingAmbientTexture, undefined, mtlDirectory, texturePromiseMap, texturePromises, options);
        loadMaterialTexture(material, 'normalTexture', overridingNormalTexture, undefined, mtlDirectory, texturePromiseMap, texturePromises, options);
        loadMaterialTexture(material, 'diffuseTexture', overridingDiffuseTexture, diffuseTextureOptions, mtlDirectory, texturePromiseMap, texturePromises, options);
        loadMaterialTexture(material, 'emissiveTexture', overridingEmissiveTexture, undefined, mtlDirectory, texturePromiseMap, texturePromises, options);
        materials.push(material);
    }

    /**
     * Removes texture options from texture name
     * NOTE: assumes no spaces in texture name
     *
     * @param {String} name
     * @returns {String} The clean texture name
     */
    function cleanTextureName (name) {
        var re = /-(bm|t|s|o|blendu|blendv|boost|mm|texres|clamp|imfchan|type)/;
        if (re.test(name)) {
            return name.split(/\s+/).pop();
        }
        return name;
    }

    function parseLine(line) {
        line = line.trim();
        if (/^newmtl /i.test(line)) {
            var name = line.substring(7).trim();
            createMaterial(name);
        } else if (/^Ka /i.test(line)) {
            values = line.substring(3).trim().split(' ');
            material.ambientColor = [
                parseFloat(values[0]),
                parseFloat(values[1]),
                parseFloat(values[2]),
                1.0
            ];
        } else if (/^Ke /i.test(line)) {
            values = line.substring(3).trim().split(' ');
            material.emissiveColor = [
                parseFloat(values[0]),
                parseFloat(values[1]),
                parseFloat(values[2]),
                1.0
            ];
        } else if (/^Kd /i.test(line)) {
            values = line.substring(3).trim().split(' ');
            material.diffuseColor = [
                parseFloat(values[0]),
                parseFloat(values[1]),
                parseFloat(values[2]),
                1.0
            ];
        } else if (/^Ks /i.test(line)) {
            values = line.substring(3).trim().split(' ');
            material.specularColor = [
                parseFloat(values[0]),
                parseFloat(values[1]),
                parseFloat(values[2]),
                1.0
            ];
        } else if (/^Ns /i.test(line)) {
            value = line.substring(3).trim();
            material.specularShininess = parseFloat(value);
        } else if (/^d /i.test(line)) {
            value = line.substring(2).trim();
            material.alpha = correctAlpha(parseFloat(value));
        } else if (/^Tr /i.test(line)) {
            value = line.substring(3).trim();
            material.alpha = correctAlpha(1.0 - parseFloat(value));
        } else if (/^map_Ka /i.test(line)) {
            if (!defined(overridingAmbientTexture)) {
                texturePath = path.resolve(mtlDirectory, cleanTextureName(line.substring(7).trim()));
                loadMaterialTexture(material, 'ambientTexture', texturePath, ambientTextureOptions, mtlDirectory, texturePromiseMap, texturePromises, options);
            }
        } else if (/^map_Ke /i.test(line)) {
            if (!defined(overridingEmissiveTexture)) {
                texturePath = path.resolve(mtlDirectory, cleanTextureName(line.substring(7).trim()));
                loadMaterialTexture(material, 'emissiveTexture', texturePath, emissiveTextureOptions, mtlDirectory, texturePromiseMap, texturePromises, options);
            }
        } else if (/^map_Kd /i.test(line)) {
            if (!defined(overridingDiffuseTexture)) {
                texturePath = path.resolve(mtlDirectory, cleanTextureName(line.substring(7).trim()));
                loadMaterialTexture(material, 'diffuseTexture', texturePath, diffuseTextureOptions, mtlDirectory, texturePromiseMap, texturePromises, options);
            }
        } else if (/^map_Ks /i.test(line)) {
            if (!defined(overridingSpecularTexture)) {
                texturePath = path.resolve(mtlDirectory, cleanTextureName(line.substring(7).trim()));
                loadMaterialTexture(material, 'specularTexture', texturePath, specularTextureOptions, mtlDirectory, texturePromiseMap, texturePromises, options);
            }
        } else if (/^map_Ns /i.test(line)) {
            if (!defined(overridingSpecularShininessTexture)) {
                texturePath = path.resolve(mtlDirectory, cleanTextureName(line.substring(7).trim()));
                loadMaterialTexture(material, 'specularShininessTexture', texturePath, specularShinessTextureOptions, mtlDirectory, texturePromiseMap, texturePromises, options);
            }
        } else if (/^map_Bump /i.test(line)) {
            if (!defined(overridingNormalTexture)) {
                texturePath = path.resolve(mtlDirectory, cleanTextureName(line.substring(9).trim()));
                loadMaterialTexture(material, 'normalTexture', texturePath, normalTextureOptions, mtlDirectory, texturePromiseMap, texturePromises, options);
            }
        }
    }

    return readLines(mtlPath, parseLine)
        .then(function() {
            return Promise.all(texturePromises);
        })
        .then(function() {
            return convertMaterials(materials, options);
        });
}

function correctAlpha(alpha) {
    // An alpha of 0.0 usually implies a problem in the export, change to 1.0 instead
    return alpha === 0.0 ? 1.0 : alpha;
}

function Material() {
    this.name = undefined;
    this.ambientColor = [0.0, 0.0, 0.0, 1.0];    // Ka
    this.emissiveColor = [0.0, 0.0, 0.0, 1.0];   // Ke
    this.diffuseColor = [0.5, 0.5, 0.5, 1.0];    // Kd
    this.specularColor = [0.0, 0.0, 0.0, 1.0];   // Ks
    this.specularShininess = 0.0;                // Ns
    this.alpha = 1.0;                            // d / Tr
    this.ambientTexture = undefined;             // map_Ka
    this.emissiveTexture = undefined;            // map_Ke
    this.diffuseTexture = undefined;             // map_Kd
    this.specularTexture = undefined;            // map_Ks
    this.specularShininessTexture = undefined;   // map_Ns
    this.normalTexture = undefined;              // map_Bump
}

loadMtl.getDefaultMaterial = function(options) {
    return convertMaterial(new Material(), options);
};

// Exposed for testing
loadMtl._createMaterial = function(materialOptions, options) {
    return convertMaterial(combine(materialOptions, new Material()), options);
};

function loadMaterialTexture(material, name, texturePath, textureOptions, mtlDirectory, texturePromiseMap, texturePromises, options) {
    if (!defined(texturePath)) {
        return;
    }

    var texturePromise = texturePromiseMap[texturePath];
    if (!defined(texturePromise)) {
        var shallowPath = path.resolve(path.join(mtlDirectory, path.basename(texturePath)));
        if (options.secure && outsideDirectory(texturePath, mtlDirectory)) {
            // Try looking for the texture in the same directory as the obj
            texturePromise = loadTexture(shallowPath, textureOptions)
                .catch(function() {
                    options.logger('Could not read texture file at ' + texturePath + ' because it is outside of the mtl directory and the secure flag is true. This texture will be ignored.');
                });
        } else {
            texturePromise = loadTexture(texturePath, textureOptions)
                .catch(function() {
                    // Try looking for the texture in the same directory as the obj
                    return loadTexture(shallowPath, textureOptions);
                })
                .catch(function() {
                    options.logger('Could not read texture file at ' + texturePath + '. This texture will be ignored.');
                });
        }
        texturePromiseMap[texturePath] = texturePromise;
    }

    texturePromises.push(texturePromise
        .then(function(texture) {
            material[name] = texture;
        }));
}

function convertMaterial(material, options) {
    if (options.specularGlossiness) {
        return createSpecularGlossinessMaterial(material, options);
    } else if (options.metallicRoughness) {
        return createMetallicRoughnessMaterial(material, options);
    } else if (options.materialsCommon) {
        return createMaterialsCommonMaterial(material, options);
    }

    // No material type specified, convert the material to metallic roughness
    convertTraditionalToMetallicRoughness(material);
    return createMetallicRoughnessMaterial(material, options);
}

function convertMaterials(materials, options) {
    return materials.map(function(material) {
        return convertMaterial(material, options);
    });
}

function resizeChannel(sourcePixels, sourceWidth, sourceHeight, targetPixels, targetWidth, targetHeight) {
    // Nearest neighbor sampling
    var widthRatio = sourceWidth / targetWidth;
    var heightRatio = sourceHeight / targetHeight;

    for (var y = 0; y < targetHeight; ++y) {
        for (var x = 0; x < targetWidth; ++x) {
            var targetIndex = y * targetWidth + x;
            var sourceY = Math.round(y * heightRatio);
            var sourceX = Math.round(x * widthRatio);
            var sourceIndex = sourceY * sourceWidth + sourceX;
            var sourceValue = sourcePixels.readUInt8(sourceIndex);
            targetPixels.writeUInt8(sourceValue, targetIndex);
        }
    }
    return targetPixels;
}

var scratchResizeChannel;

function getTextureChannel(texture, index, targetWidth, targetHeight, targetChannel) {
    var pixels = texture.pixels; // RGBA
    var sourceWidth = texture.width;
    var sourceHeight = texture.height;
    var sourcePixelsLength = sourceWidth * sourceHeight;
    var targetPixelsLength = targetWidth * targetHeight;

    // Allocate the scratchResizeChannel on demand if the texture needs to be resized
    var sourceChannel = targetChannel;
    if (sourcePixelsLength > targetPixelsLength) {
        if (!defined(scratchResizeChannel) || (sourcePixelsLength > scratchResizeChannel.length)) {
            scratchResizeChannel = Buffer.alloc(sourcePixelsLength);
        }
        sourceChannel = scratchResizeChannel;
    }

    for (var i = 0; i < sourcePixelsLength; ++i) {
        var value = pixels.readUInt8(i * 4 + index);
        sourceChannel.writeUInt8(value, i);
    }

    if (sourcePixelsLength > targetPixelsLength) {
        resizeChannel(sourceChannel, sourceWidth, sourceHeight, targetChannel, targetWidth, targetHeight);
    }

    return targetChannel;
}

function writeChannel(pixels, channel, index) {
    var pixelsLength = pixels.length / 4;
    for (var i = 0; i < pixelsLength; ++i) {
        var value = channel.readUInt8(i);
        pixels.writeUInt8(value, i * 4 + index);
    }
}

function getMinimumDimensions(textures, options) {
    var i;
    var texture;
    var width = Number.POSITIVE_INFINITY;
    var height = Number.POSITIVE_INFINITY;

    var length = textures.length;
    for (i = 0; i < length; ++i) {
        texture = textures[i];
        width = Math.min(texture.width, width);
        height = Math.min(texture.height, height);
    }

    for (i = 0; i < length; ++i) {
        texture = textures[i];
        if (texture.width !== width || texture.height !== height) {
            options.logger('Texture ' + texture.path + ' will be scaled from ' + texture.width + 'x' + texture.height + ' to ' + width + 'x' + height + '.');
        }
    }

    return [width, height];
}

function createMetallicRoughnessTexture(metallicTexture, roughnessTexture, occlusionTexture, options) {
    if (defined(options.overridingTextures.metallicRoughnessOcclusionTexture)) {
        return metallicTexture;
    }

    var packMetallic = defined(metallicTexture);
    var packRoughness = defined(roughnessTexture);
    var packOcclusion = defined(occlusionTexture) && options.packOcclusion;

    if (!packMetallic && !packRoughness) {
        return undefined;
    }

    if (packMetallic && !defined(metallicTexture.pixels)) {
        options.logger('Could not get decoded texture data for ' + metallicTexture.path + '. The material will be created without a metallicRoughness texture.');
        return undefined;
    }

    if (packRoughness && !defined(roughnessTexture.pixels)) {
        options.logger('Could not get decoded texture data for ' + roughnessTexture.path + '. The material will be created without a metallicRoughness texture.');
        return undefined;
    }

    if (packOcclusion && !defined(occlusionTexture.pixels)) {
        options.logger('Could not get decoded texture data for ' + occlusionTexture.path + '. The occlusion texture will not be packed in the metallicRoughness texture.');
        return undefined;
    }

    var packedTextures = [metallicTexture, roughnessTexture, occlusionTexture].filter(function(texture) {
        return defined(texture) && defined(texture.pixels);
    });

    var dimensions = getMinimumDimensions(packedTextures, options);
    var width = dimensions[0];
    var height = dimensions[1];
    var pixelsLength = width * height;
    var pixels = Buffer.alloc(pixelsLength * 4, 0xFF); // Initialize with 4 channels, unused channels will be white
    var scratchChannel = Buffer.alloc(pixelsLength);

    if (packMetallic) {
        // Write into the B channel
        var metallicChannel = getTextureChannel(metallicTexture, 0, width, height, scratchChannel);
        writeChannel(pixels, metallicChannel, 2);
    }

    if (packRoughness) {
        // Write into the G channel
        var roughnessChannel = getTextureChannel(roughnessTexture, 0, width, height, scratchChannel);
        writeChannel(pixels, roughnessChannel, 1);
    }

    if (packOcclusion) {
        // Write into the R channel
        var occlusionChannel = getTextureChannel(occlusionTexture, 0, width, height, scratchChannel);
        writeChannel(pixels, occlusionChannel, 0);
    }

    var length = packedTextures.length;
    var names = new Array(length);
    for (var i = 0; i < length; ++i) {
        names[i] = packedTextures[i].name;
    }
    var name = names.join('_');

    var texture = new Texture();
    texture.name = name;
    texture.extension = '.png';
    texture.pixels = pixels;
    texture.width = width;
    texture.height = height;

    return texture;
}

function createSpecularGlossinessTexture(specularTexture, glossinessTexture, options) {
    if (defined(options.overridingTextures.specularGlossinessTexture)) {
        return specularTexture;
    }

    var packSpecular = defined(specularTexture);
    var packGlossiness = defined(glossinessTexture);

    if (!packSpecular && !packGlossiness) {
        return undefined;
    }

    if (packSpecular && !defined(specularTexture.pixels)) {
        options.logger('Could not get decoded texture data for ' + specularTexture.path + '. The material will be created without a specularGlossiness texture.');
        return undefined;
    }

    if (packGlossiness && !defined(glossinessTexture.pixels)) {
        options.logger('Could not get decoded texture data for ' + glossinessTexture.path + '. The material will be created without a specularGlossiness texture.');
        return undefined;
    }

    var packedTextures = [specularTexture, glossinessTexture].filter(function(texture) {
        return defined(texture) && defined(texture.pixels);
    });

    var dimensions = getMinimumDimensions(packedTextures, options);
    var width = dimensions[0];
    var height = dimensions[1];
    var pixelsLength = width * height;
    var pixels = Buffer.alloc(pixelsLength * 4, 0xFF); // Initialize with 4 channels, unused channels will be white
    var scratchChannel = Buffer.alloc(pixelsLength);

    if (packSpecular) {
        // Write into the R, G, B channels
        var redChannel = getTextureChannel(specularTexture, 0, width, height, scratchChannel);
        writeChannel(pixels, redChannel, 0);
        var greenChannel = getTextureChannel(specularTexture, 1, width, height, scratchChannel);
        writeChannel(pixels, greenChannel, 1);
        var blueChannel = getTextureChannel(specularTexture, 2, width, height, scratchChannel);
        writeChannel(pixels, blueChannel, 2);
    }

    if (packGlossiness) {
        // Write into the A channel
        var glossinessChannel = getTextureChannel(glossinessTexture, 0, width, height, scratchChannel);
        writeChannel(pixels, glossinessChannel, 3);
    }

    var length = packedTextures.length;
    var names = new Array(length);
    for (var i = 0; i < length; ++i) {
        names[i] = packedTextures[i].name;
    }
    var name = names.join('_');

    var texture = new Texture();
    texture.name = name;
    texture.extension = '.png';
    texture.pixels = pixels;
    texture.width = width;
    texture.height = height;

    return texture;
}

function createSpecularGlossinessMaterial(material, options) {
    var emissiveTexture = material.emissiveTexture;
    var normalTexture = material.normalTexture;
    var occlusionTexture = material.ambientTexture;
    var diffuseTexture = material.diffuseTexture;
    var specularTexture = material.specularTexture;
    var glossinessTexture = material.specularShininessTexture;
    var specularGlossinessTexture = createSpecularGlossinessTexture(specularTexture, glossinessTexture, options);

    var emissiveFactor = material.emissiveColor.slice(0, 3);
    var diffuseFactor = material.diffuseColor;
    var specularFactor = material.specularColor.slice(0, 3);
    var glossinessFactor = material.specularShininess;

    if (defined(emissiveTexture)) {
        emissiveFactor = [1.0, 1.0, 1.0];
    }

    if (defined(diffuseTexture)) {
        diffuseFactor = [1.0, 1.0, 1.0, 1.0];
    }

    if (defined(specularTexture)) {
        specularFactor = [1.0, 1.0, 1.0];
    }

    if (defined(glossinessTexture)) {
        glossinessFactor = 1.0;
    }

    var alpha = material.alpha;
    diffuseFactor[3] = alpha;

    var transparent = alpha < 1.0;
    if (defined(diffuseTexture)) {
        transparent = transparent || diffuseTexture.transparent;
    }

    var doubleSided = transparent;
    var alphaMode = transparent ? 'BLEND' : 'OPAQUE';

    return {
        name : material.name,
        extensions : {
            KHR_materials_pbrSpecularGlossiness: {
                diffuseTexture : diffuseTexture,
                specularGlossinessTexture : specularGlossinessTexture,
                diffuseFactor : diffuseFactor,
                specularFactor : specularFactor,
                glossinessFactor : glossinessFactor
            }
        },
        emissiveTexture : emissiveTexture,
        normalTexture : normalTexture,
        occlusionTexture : occlusionTexture,
        emissiveFactor : emissiveFactor,
        alphaMode : alphaMode,
        doubleSided : doubleSided
    };
}

function createMetallicRoughnessMaterial(material, options) {
    var emissiveTexture = material.emissiveTexture;
    var normalTexture = material.normalTexture;
    var occlusionTexture = material.ambientTexture;
    var baseColorTexture = material.diffuseTexture;
    var metallicTexture = material.specularTexture;
    var roughnessTexture = material.specularShininessTexture;
    var metallicRoughnessTexture = createMetallicRoughnessTexture(metallicTexture, roughnessTexture, occlusionTexture, options);

    if (options.packOcclusion) {
        occlusionTexture = metallicRoughnessTexture;
    }

    var emissiveFactor = material.emissiveColor.slice(0, 3);
    var baseColorFactor = material.diffuseColor;
    var metallicFactor = material.specularColor[0];
    var roughnessFactor = material.specularShininess;

    if (defined(emissiveTexture)) {
        emissiveFactor = [1.0, 1.0, 1.0];
    }

    if (defined(baseColorTexture)) {
        baseColorFactor = [1.0, 1.0, 1.0, 1.0];
    }

    if (defined(metallicTexture)) {
        metallicFactor = 1.0;
    }

    if (defined(roughnessTexture)) {
        roughnessFactor = 1.0;
    }

    var alpha = material.alpha;
    baseColorFactor[3] = alpha;

    var transparent = alpha < 1.0;
    if (defined(baseColorTexture)) {
        transparent = transparent || baseColorTexture.transparent;
    }

    var doubleSided = transparent;
    var alphaMode = transparent ? 'BLEND' : 'OPAQUE';

    return {
        name : material.name,
        pbrMetallicRoughness : {
            baseColorTexture : baseColorTexture,
            metallicRoughnessTexture : metallicRoughnessTexture,
            baseColorFactor : baseColorFactor,
            metallicFactor : metallicFactor,
            roughnessFactor : roughnessFactor
        },
        emissiveTexture : emissiveTexture,
        normalTexture : normalTexture,
        occlusionTexture : occlusionTexture,
        emissiveFactor : emissiveFactor,
        alphaMode : alphaMode,
        doubleSided : doubleSided
    };
}

function luminance(color) {
    return color[0] * 0.2125 + color[1] * 0.7154 + color[2] * 0.0721;
}

function convertTraditionalToMetallicRoughness(material) {
    // Translate the blinn-phong model to the pbr metallic-roughness model
    // Roughness factor is a combination of specular intensity and shininess
    // Metallic factor is 0.0
    // Textures are not converted for now
    var specularIntensity = luminance(material.specularColor);

    // Transform from 0-1000 range to 0-1 range. Then invert.
    var roughnessFactor = material.specularShininess;
    roughnessFactor = roughnessFactor / 1000.0;
    roughnessFactor = 1.0 - roughnessFactor;
    roughnessFactor = CesiumMath.clamp(roughnessFactor, 0.0, 1.0);

    // Low specular intensity values should produce a rough material even if shininess is high.
    if (specularIntensity < 0.1) {
        roughnessFactor *= (1.0 - specularIntensity);
    }

    var metallicFactor = 0.0;

    material.specularColor = [metallicFactor, metallicFactor, metallicFactor, 1.0];
    material.specularShininess = roughnessFactor;
}

function createMaterialsCommonMaterial(material, options) {
    var ambient = defaultValue(material.ambientTexture, material.ambientColor);
    var diffuse = defaultValue(material.diffuseTexture, material.diffuseColor);
    var emission = defaultValue(material.emissiveTexture, material.emissiveColor);
    var specular = defaultValue(material.specularTexture, material.specularColor);

    var alpha = material.alpha;
    var shininess = material.specularShininess;
    var hasSpecular = (shininess > 0.0) && (defined(material.specularTexture) || (specular[0] > 0.0 || specular[1] > 0.0 || specular[2] > 0.0));

    var transparent;
    var transparency = 1.0;
    if (defined(material.diffuseTexture)) {
        transparency = alpha;
        transparent = material.diffuseTexture.transparent || (transparency < 1.0);
    } else {
        diffuse[3] = alpha;
        transparent = alpha < 1.0;
    }

    if (!defined(material.ambientTexture)) {
        // If ambient color is [1, 1, 1] assume it is a multiplier and instead change to [0, 0, 0]
        if (ambient[0] === 1.0 && ambient[1] === 1.0 && ambient[2] === 1.0) {
            ambient = [0.0, 0.0, 0.0, 1.0];
        }
    }

    var doubleSided = transparent;
    var technique = hasSpecular ? 'PHONG' : 'LAMBERT';

    if (!options.hasNormals) {
        // Constant technique only factors in ambient and emission sources - set emission to diffuse
        emission = diffuse;
        technique = 'CONSTANT';
    }

    return {
        name : material.name,
        extensions : {
            KHR_materials_common : {
                technique : technique,
                transparent : transparent,
                doubleSided : doubleSided,
                values : {
                    ambient : ambient,
                    diffuse : diffuse,
                    emission : emission,
                    specular : specular,
                    shininess : shininess,
                    transparency : transparency,
                    transparent : transparent,
                    doubleSided : doubleSided
                }
            }
        }
    };
}
