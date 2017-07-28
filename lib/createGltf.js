'use strict';
var Cesium = require('cesium');
var path = require('path');
var getBufferPadded = require('./getBufferPadded');
var Image = require('./Image');
var Material = require('./Material');

var CesiumMath = Cesium.Math;
var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = createGltf;

/**
 * Create a glTF from obj data.
 *
 * @param {Object} objData Output of obj.js, containing an array of nodes containing geometry information, materials, and images.
 * @param {Object} options An object with the following properties:
 * @param {Boolean} options.packOcclusion Pack the occlusion texture in the red channel of metallic-roughness texture.
 * @param {Boolean} options.metallicRoughness The values in the mtl file are already metallic-roughness PBR values and no conversion step should be applied. Metallic is stored in the Ks and map_Ks slots and roughness is stored in the Ns and map_Ns slots.
 * @param {Boolean} options.specularGlossiness The values in the mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the KHR_materials_pbrSpecularGlossiness extension.
 * @param {Boolean} options.materialsCommon The glTF will be saved with the KHR_materials_common extension.
 * @param {Object} [options.overridingImages] An object containing image paths that override material values defined in the .mtl file. This is often convenient in workflows where the .mtl does not exist or is not set up to use PBR materials. Intended for models with a single material.
 * @param {String} [options.overridingImages.metallicRoughnessOcclusionTexture] Path to the metallic-roughness-occlusion texture, where occlusion is stored in the red channel, roughness is stored in the green channel, and metallic is stored in the blue channel. The model will be saved with a pbrMetallicRoughness material.
 * @param {String} [options.overridingImages.specularGlossinessTexture] Path to the specular-glossiness texture, where specular color is stored in the red, green, and blue channels and specular glossiness is stored in the alpha channel. The model will be saved with a material using the KHR_materials_pbrSpecularGlossiness extension.
 * @param {String} [options.overridingImages.occlusionTexture] Path to the occlusion texture. Ignored if metallicRoughnessOcclusionTexture is also set.
 * @param {String} [options.overridingImages.normalTexture] Path to the normal texture.
 * @param {String} [options.overridingImages.baseColorTexture] Path to the baseColor/diffuse texture.
 * @param {String} [options.overridingImages.emissiveTexture] Path to the emissive texture.
 * @param {Boolean} options.logger A callback function for handling logged messages. Defaults to console.log.
 * @returns {Object} A glTF asset.
 *
 * @private
 */
function createGltf(objData, options) {
    var nodes = objData.nodes;
    var materials = objData.materials;
    var images = objData.images;

    var gltf = {
        accessors : [],
        asset : {},
        buffers : [],
        bufferViews : [],
        extensionsUsed : [],
        extensionsRequired : [],
        images : [],
        materials : [],
        meshes : [],
        nodes : [],
        samplers : [],
        scene : 0,
        scenes : [],
        textures : []
    };

    gltf.asset = {
        generator : 'obj2gltf',
        version: '2.0'
    };

    gltf.scenes.push({
        nodes : []
    });

    var bufferState = {
        positionBuffers : [],
        normalBuffers : [],
        uvBuffers : [],
        indexBuffers : [],
        positionAccessors : [],
        normalAccessors : [],
        uvAccessors : [],
        indexAccessors : []
    };

    var uint32Indices = requiresUint32Indices(nodes);

    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        var node = nodes[i];
        var meshes = node.meshes;
        var meshesLength = meshes.length;
        var meshIndex;

        if (meshesLength === 1) {
            meshIndex = addMesh(gltf, materials, images, bufferState, uint32Indices, meshes[0], options);
            addNode(gltf, node.name, meshIndex);
        } else {
            // Add meshes as child nodes
            var parentIndex = addNode(gltf, node.name);
            for (var j = 0; j < meshesLength; ++j) {
                var mesh = meshes[j];
                meshIndex = addMesh(gltf, materials, images, bufferState, uint32Indices, mesh, options);
                addNode(gltf, mesh.name, meshIndex, parentIndex);
            }
        }
    }

    if (gltf.images.length > 0) {
        gltf.samplers.push({
            magFilter : WebGLConstants.LINEAR,
            minFilter : WebGLConstants.NEAREST_MIPMAP_LINEAR,
            wrapS : WebGLConstants.REPEAT,
            wrapT : WebGLConstants.REPEAT
        });
    }

    addBuffers(gltf, bufferState);
    return gltf;
}

function addBufferView(gltf, buffers, accessors, byteStride, target) {
    var length = buffers.length;
    if (length === 0) {
        return;
    }
    var bufferViewIndex = gltf.bufferViews.length;
    var previousBufferView = gltf.bufferViews[bufferViewIndex - 1];
    var byteOffset = defined(previousBufferView) ? previousBufferView.byteOffset + previousBufferView.byteLength : 0;
    var byteLength = 0;
    for (var i = 0; i < length; ++i) {
        var accessor = gltf.accessors[accessors[i]];
        accessor.bufferView = bufferViewIndex;
        accessor.byteOffset = byteLength;
        byteLength += buffers[i].length;
    }
    gltf.bufferViews.push({
        name : 'bufferView_' + bufferViewIndex,
        buffer : 0,
        byteLength : byteLength,
        byteOffset : byteOffset,
        byteStride : byteStride,
        target : target
    });
}

function addBuffers(gltf, bufferState) {
    // Positions and normals share the same byte stride so they can share the same bufferView
    var positionsAndNormalsAccessors = bufferState.positionAccessors.concat(bufferState.normalAccessors);
    var positionsAndNormalsBuffers = bufferState.positionBuffers.concat(bufferState.normalBuffers);
    addBufferView(gltf, positionsAndNormalsBuffers, positionsAndNormalsAccessors, 12, WebGLConstants.ARRAY_BUFFER);
    addBufferView(gltf, bufferState.uvBuffers, bufferState.uvAccessors, 8, WebGLConstants.ARRAY_BUFFER);
    addBufferView(gltf, bufferState.indexBuffers, bufferState.indexAccessors, undefined, WebGLConstants.ELEMENT_ARRAY_BUFFER);

    var buffers = [];
    buffers = buffers.concat(bufferState.positionBuffers, bufferState.normalBuffers, bufferState.uvBuffers, bufferState.indexBuffers);
    var buffer = getBufferPadded(Buffer.concat(buffers));

    gltf.buffers.push({
        name : 'buffer',
        byteLength : buffer.length,
        extras : {
            _obj2gltf : {
                source : buffer
            }
        }
    });
}

function getImage(images, imagePath, overridingImage) {
    if (defined(overridingImage)) {
        return overridingImage;
    }
    var imagesLength = images.length;
    for (var i = 0; i < imagesLength; ++i) {
        var image = images[i];
        if (image.path === imagePath) {
            return image;
        }
    }
    return undefined;
}

function getImageName(image) {
    return path.basename(image.path, image.extension);
}

function getTextureName(image) {
    return getImageName(image) + '_texture';
}

function addTexture(gltf, image) {
    var imageName = getImageName(image);
    var textureName = getTextureName(image);
    var imageIndex = gltf.images.length;
    var textureIndex = gltf.textures.length;

    gltf.images.push({
        name : imageName,
        extras : {
            _obj2gltf : image
        }
    });

    gltf.textures.push({
        name : textureName,
        sampler : 0,
        source : imageIndex
    });

    return textureIndex;
}

function getTexture(gltf, image) {
    if (!defined(image)) {
        return undefined;
    }

    var textureIndex;
    var name = getTextureName(image);
    var textures = gltf.textures;
    var length = textures.length;
    for (var i = 0; i < length; ++i) {
        if (textures[i].name === name) {
            textureIndex = i;
            break;
        }
    }

    if (!defined(textureIndex)) {
        textureIndex = addTexture(gltf, image);
    }

    return {
        index : textureIndex
    };
}

function addColors(left, right) {
    var red = Math.min(left[0] + right[0], 1.0);
    var green = Math.min(left[1] + right[1], 1.0);
    var blue = Math.min(left[2] + right[2], 1.0);
    return [red, green, blue];
}

function getEmissiveFactor(material) {
    // If ambient color is [1, 1, 1] assume it is a multiplier and instead change to [0, 0, 0]
    // Then add the ambient color to the emissive color to get the emissive factor.
    var ambientColor = material.ambientColor;
    var emissiveColor = material.emissiveColor;
    if (ambientColor[0] === 1.0 && ambientColor[1] === 1.0 && ambientColor[2] === 1.0) {
        ambientColor = [0.0, 0.0, 0.0, 1.0];
    }
    return addColors(ambientColor, emissiveColor);
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

function getImageChannel(image, index, targetWidth, targetHeight, targetChannel) {
    var pixels = image.decoded; // RGBA
    var sourceWidth = image.width;
    var sourceHeight = image.height;
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

function getMinimumDimensions(images, options) {
    var i;
    var image;
    var width = Number.POSITIVE_INFINITY;
    var height = Number.POSITIVE_INFINITY;

    var length = images.length;
    for (i = 0; i < length; ++i) {
        image = images[i];
        width = Math.min(image.width, width);
        height = Math.min(image.height, height);
    }

    for (i = 0; i < length; ++i) {
        image = images[i];
        if (image.width !== width || image.height !== height) {
            options.logger('Image ' + image.path + ' will be scaled from ' + image.width + 'x' + image.height + ' to ' + width + 'x' + height + '.');
        }
    }

    return [width, height];
}

function createMetallicRoughnessTexture(gltf, metallicImage, roughnessImage, occlusionImage, options) {
    var packMetallic = defined(metallicImage);
    var packRoughness = defined(roughnessImage);
    var packOcclusion = defined(occlusionImage) && options.packOcclusion;

    if (!packMetallic && !packRoughness) {
        return undefined;
    }

    if (packMetallic && !defined(metallicImage.decoded)) {
        options.logger('Could not get decoded image data for ' + metallicImage.path + '. The material will be created without a metallicRoughness texture.');
        return undefined;
    }

    if (packRoughness && !defined(roughnessImage.decoded)) {
        options.logger('Could not get decoded image data for ' + roughnessImage.path + '. The material will be created without a metallicRoughness texture.');
        return undefined;
    }

    if (packOcclusion && !defined(occlusionImage.decoded)) {
        options.logger('Could not get decoded image data for ' + occlusionImage.path + '. The occlusion texture will not be packed in the metallicRoughness texture.');
        return undefined;
    }

    var packedImages = [metallicImage, roughnessImage, occlusionImage].filter(function(image) {
        return defined(image) && defined(image.decoded);
    });

    var dimensions = getMinimumDimensions(packedImages, options);
    var width = dimensions[0];
    var height = dimensions[1];
    var pixelsLength = width * height;
    var pixels = Buffer.alloc(pixelsLength * 4, 0xFF); // Initialize with 4 channels, unused channels will be white
    var scratchChannel = Buffer.alloc(pixelsLength);

    if (packMetallic) {
        // Write into the B channel
        var metallicChannel = getImageChannel(metallicImage, 0, width, height, scratchChannel);
        writeChannel(pixels, metallicChannel, 2);
    }

    if (packRoughness) {
        // Write into the G channel
        var roughnessChannel = getImageChannel(roughnessImage, 0, width, height, scratchChannel);
        writeChannel(pixels, roughnessChannel, 1);
    }

    if (packOcclusion) {
        // Write into the R channel
        var occlusionChannel = getImageChannel(occlusionImage, 0, width, height, scratchChannel);
        writeChannel(pixels, occlusionChannel, 0);
    }

    var length = packedImages.length;
    var imageNames = new Array(length);
    for (var i = 0; i < length; ++i) {
        imageNames[i] = getImageName(packedImages[i]);
    }
    var imageName = imageNames.join('_');

    var image = new Image();
    image.extension = '.png';
    image.path = imageName;
    image.decoded = pixels;
    image.width = width;
    image.height = height;

    return getTexture(gltf, image);
}

function createSpecularGlossinessTexture(gltf, specularImage, glossinessImage, options) {
    var packSpecular = defined(specularImage);
    var packGlossiness = defined(glossinessImage);

    if (!packSpecular && !packGlossiness) {
        return undefined;
    }

    if (packSpecular && !defined(specularImage.decoded)) {
        options.logger('Could not get decoded image data for ' + specularImage.path + '. The material will be created without a specularGlossiness texture.');
        return undefined;
    }

    if (packGlossiness && !defined(glossinessImage.decoded)) {
        options.logger('Could not get decoded image data for ' + glossinessImage.path + '. The material will be created without a specularGlossiness texture.');
        return undefined;
    }

    var packedImages = [specularImage, glossinessImage].filter(function(image) {
        return defined(image) && defined(image.decoded);
    });

    var dimensions = getMinimumDimensions(packedImages, options);
    var width = dimensions[0];
    var height = dimensions[1];
    var pixelsLength = width * height;
    var pixels = Buffer.alloc(pixelsLength * 4, 0xFF); // Initialize with 4 channels, unused channels will be white
    var scratchChannel = Buffer.alloc(pixelsLength);

    if (packSpecular) {
        // Write into the R, G, B channels
        var redChannel = getImageChannel(specularImage, 0, width, height, scratchChannel);
        var greenChannel = getImageChannel(specularImage, 1, width, height, scratchChannel);
        var blueChannel = getImageChannel(specularImage, 2, width, height, scratchChannel);
        writeChannel(pixels, redChannel, 0);
        writeChannel(pixels, greenChannel, 1);
        writeChannel(pixels, blueChannel, 2);
    }

    if (packGlossiness) {
        // Write into the A channel
        var glossinessChannel = getImageChannel(glossinessImage, 0, width, height, scratchChannel);
        writeChannel(pixels, glossinessChannel, 3);
    }

    var length = packedImages.length;
    var imageNames = new Array(length);
    for (var i = 0; i < length; ++i) {
        imageNames[i] = getImageName(packedImages[i]);
    }
    var imageName = imageNames.join('_');

    var image = new Image();
    image.extension = '.png';
    image.path = imageName;
    image.decoded = pixels;
    image.width = width;
    image.height = height;

    return getTexture(gltf, image);
}

function createSpecularGlossinessMaterial(gltf, images, material, options) {
    var materialName = material.name;

    // The texture paths supplied in the .mtl may be overriden by the texture paths supplied in options
    var overridingImages = options.overridingImages;
    var emissiveImage = getImage(images, material.emissiveTexture, overridingImages.emissiveTexture, options);
    var normalImage = getImage(images, material.normalTexture, overridingImages.normalTexture, options);
    var occlusionImage = getImage(images, material.ambientTexture, overridingImages.occlusionTexture, options);
    var diffuseImage = getImage(images, material.diffuseTexture, overridingImages.baseColorTexture, options);
    var specularImage = getImage(images, material.specularTexture, overridingImages.specularGlossinessTexture, options);
    var glossinessImage = getImage(images, material.specularShininessTexture, overridingImages.specularGlossinessTexture, options);

    var emissiveTexture = getTexture(gltf, emissiveImage);
    var normalTexture = getTexture(gltf, normalImage);
    var occlusionTexture = getTexture(gltf, occlusionImage);
    var diffuseTexture = getTexture(gltf, diffuseImage);

    var specularGlossinessTexture;
    if (defined(overridingImages.specularGlossinessTexture)) {
        specularGlossinessTexture = getTexture(gltf, specularImage);
    } else {
        specularGlossinessTexture = createSpecularGlossinessTexture(gltf, specularImage, glossinessImage, options);
    }

    var emissiveFactor = getEmissiveFactor(material);
    var diffuseFactor = material.diffuseColor;
    var specularFactor = material.specularColor.slice(0, 3);
    var glossinessFactor = material.specularShininess;

    if (defined(emissiveTexture)) {
        emissiveFactor = [1.0, 1.0, 1.0];
    }

    if (defined(diffuseTexture)) {
        diffuseFactor = [1.0, 1.0, 1.0, 1.0];
    }

    if (defined(specularImage)) {
        specularFactor = [1.0, 1.0, 1.0];
    }

    if (defined(glossinessImage)) {
        glossinessFactor = 1.0;
    }

    var alpha = material.alpha;
    diffuseFactor[3] = alpha;

    var transparent = alpha < 1.0;
    if (defined(diffuseImage)) {
        transparent = transparent || diffuseImage.transparent;
    }

    var doubleSided = transparent;
    var alphaMode = transparent ? 'BLEND' : 'OPAQUE';

    gltf.extensionsUsed.push('KHR_materials_pbrSpecularGlossiness');
    gltf.extensionsRequired.push('KHR_materials_pbrSpecularGlossiness');

    return {
        name : materialName,
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

function createMetallicRoughnessMaterial(gltf, images, material, options) {
    var materialName = material.name;

    // The texture paths supplied in the .mtl may be over    var overridingImages = options.overridingImages;
    var overridingImages = options.overridingImages;
    var emissiveImage = getImage(images, material.emissiveTexture, overridingImages.emissiveTexture);
    var normalImage = getImage(images, material.normalTexture, overridingImages.normalTexture);
    var occlusionImage = getImage(images, material.ambientTexture, overridingImages.metallicRoughnessOcclusionTexture);
    var baseColorImage = getImage(images, material.diffuseTexture, overridingImages.baseColorTexture);
    var metallicImage = getImage(images, material.specularTexture, overridingImages.metallicRoughnessOcclusionTexture);
    var roughnessImage = getImage(images, material.specularShininessTexture, overridingImages.metallicRoughnessOcclusionTexture);

    var emissiveTexture = getTexture(gltf, emissiveImage);
    var normalTexture = getTexture(gltf, normalImage);
    var baseColorTexture = getTexture(gltf, baseColorImage);

    var metallicRoughnessTexture;
    if (defined(overridingImages.metallicRoughnessOcclusionTexture)) {
        metallicRoughnessTexture = getTexture(gltf, metallicImage);
    } else {
        metallicRoughnessTexture = createMetallicRoughnessTexture(gltf, metallicImage, roughnessImage, occlusionImage, options);
    }

    var packOcclusion = (defined(occlusionImage) && options.packOcclusion) || defined(overridingImages.metallicRoughnessOcclusionTexture);
    var occlusionTexture = packOcclusion ? metallicRoughnessTexture : getTexture(gltf, occlusionImage);

    var emissiveFactor = getEmissiveFactor(material);
    var baseColorFactor = material.diffuseColor;
    var metallicFactor = material.specularColor[0];
    var roughnessFactor = material.specularShininess;

    if (defined(emissiveTexture)) {
        emissiveFactor = [1.0, 1.0, 1.0];
    }

    if (defined(baseColorTexture)) {
        baseColorFactor = [1.0, 1.0, 1.0, 1.0];
    }

    if (defined(metallicImage)) {
        metallicFactor = 1.0;
    }

    if (defined(roughnessImage)) {
        roughnessFactor = 1.0;
    }

    var alpha = material.alpha;
    baseColorFactor[3] = alpha;

    var transparent = alpha < 1.0;
    if (defined(baseColorImage)) {
        transparent = transparent || baseColorImage.transparent;
    }

    var doubleSided = transparent;
    var alphaMode = transparent ? 'BLEND' : 'OPAQUE';

    return {
        name : materialName,
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
    // This does not convert textures
    var specularIntensity = luminance(material.specularColor);
    var specularShininess = material.specularShininess;

    // Transform from 0-1000 range to 0-1 range. Then invert.
    var roughnessFactor = specularShininess;
    roughnessFactor = roughnessFactor / 1000.0;
    roughnessFactor = 1.0 - roughnessFactor;
    roughnessFactor = CesiumMath.clamp(roughnessFactor, 0.0, 1.0);

    // Low specular intensity values should produce a rough material even if shininess is high.
    if (specularIntensity < 0.1) {
        roughnessFactor *= (1.0 - specularIntensity);
    }

    var metallicFactor = 0.0;

    material.specularTexture = undefined; // For now just ignore the specular texture
    material.specularColor = [metallicFactor, metallicFactor, metallicFactor, 1.0];
    material.specularShininess = roughnessFactor;
}

function createMaterialsCommonMaterial(gltf, images, material, hasNormals, options) {
    var materialName = material.name;

    var ambientImage = getImage(images, material.ambientTexture, undefined, options);
    var diffuseImage = getImage(images, material.diffuseTexture, undefined, options);
    var emissiveImage = getImage(images, material.emissiveTexture, undefined, options);
    var specularImage = getImage(images, material.specularTexture, undefined, options);

    var ambient = defaultValue(getTexture(gltf, ambientImage), material.ambientColor);
    var diffuse = defaultValue(getTexture(gltf, diffuseImage), material.diffuseColor);
    var emission = defaultValue(getTexture(gltf, emissiveImage), material.emissiveColor);
    var specular = defaultValue(getTexture(gltf, specularImage), material.specularColor);

    var alpha = material.alpha;
    var shininess = material.specularShininess;
    var hasSpecular = (shininess > 0.0) && (specular[0] > 0.0 || specular[1] > 0.0 || specular[2] > 0.0);

    var transparent;
    var transparency = 1.0;
    if (defined(diffuseImage)) {
        transparency = alpha;
        transparent = diffuseImage.transparent || (transparency < 1.0);
    } else {
        diffuse[3] = alpha;
        transparent = alpha < 1.0;
    }

    if (!defined(ambientImage)) {
        // If ambient color is [1, 1, 1] assume it is a multiplier and instead change to [0, 0, 0]
        if (ambient[0] === 1.0 && ambient[1] === 1.0 && ambient[2] === 1.0) {
            ambient = [0.0, 0.0, 0.0, 1.0];
        }
    }

    var doubleSided = transparent;

    if (!hasNormals) {
        // Constant technique only factors in ambient and emission sources - set emission to diffuse
        emission = diffuse;
    }

    var technique = hasNormals ? (hasSpecular ? 'PHONG' : 'LAMBERT') : 'CONSTANT';

    gltf.extensionsUsed.push('KHR_materials_common');
    gltf.extensionsRequired.push('KHR_materials_common');

    return {
        name : materialName,
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

function addMaterial(gltf, images, material, hasNormals, options) {
    var gltfMaterial;
    if (options.specularGlossiness) {
        gltfMaterial = createSpecularGlossinessMaterial(gltf, images, material, options);
    } else if (options.metallicRoughness) {
        gltfMaterial = createMetallicRoughnessMaterial(gltf, images, material, options);
    } else if (options.materialsCommon) {
        gltfMaterial = createMaterialsCommonMaterial(gltf, images, material, hasNormals, options);
    } else {
        convertTraditionalToMetallicRoughness(material);
        gltfMaterial = createMetallicRoughnessMaterial(gltf, images, material, options);
    }

    var materialIndex = gltf.materials.length;
    gltf.materials.push(gltfMaterial);
    return materialIndex;
}

function getMaterial(gltf, materials, images, materialName, hasNormals, options) {
    if (!defined(materialName)) {
        // Create a default material if the primitive does not specify one
        materialName = 'default';
    }

    var i;
    var material;
    var materialsLength = materials.length;
    for (i = 0; i < materialsLength; ++i) {
        if (materials[i].name === materialName) {
            material = materials[i];
            break;
        }
    }

    if (!defined(material)) {
        material = new Material();
        material.name = materialName;
    }

    var materialIndex;
    materialsLength = gltf.materials.length;
    for (i = 0; i < materialsLength; ++i) {
        if (gltf.materials[i].name === materialName) {
            materialIndex = i;
            break;
        }
    }

    if (!defined(materialIndex)) {
        materialIndex = addMaterial(gltf, images, material, hasNormals, options);
    }

    return materialIndex;
}

function addVertexAttribute(gltf, array, components, name) {
    var count = array.length / components;
    var minMax = array.getMinMax(components);
    var type = (components === 3 ? 'VEC3' : 'VEC2');

    var accessor = {
        name : name,
        componentType : WebGLConstants.FLOAT,
        count : count,
        min : minMax.min,
        max : minMax.max,
        type : type
    };

    var accessorIndex = gltf.accessors.length;
    gltf.accessors.push(accessor);
    return accessorIndex;
}

function addIndexArray(gltf, array, uint32Indices, name) {
    var componentType = uint32Indices ? WebGLConstants.UNSIGNED_INT : WebGLConstants.UNSIGNED_SHORT;
    var count = array.length;
    var minMax = array.getMinMax(1);

    var accessor = {
        name : name,
        componentType : componentType,
        count : count,
        min : minMax.min,
        max : minMax.max,
        type : 'SCALAR'
    };

    var accessorIndex = gltf.accessors.length;
    gltf.accessors.push(accessor);
    return accessorIndex;
}

function requiresUint32Indices(nodes) {
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        var meshes = nodes[i].meshes;
        var meshesLength = meshes.length;
        for (var j = 0; j < meshesLength; ++j) {
            // Reserve the 65535 index for primitive restart
            var vertexCount = meshes[j].positions.length / 3;
            if (vertexCount > 65534) {
                return true;
            }
        }
    }
    return false;
}

function addMesh(gltf, materials, images, bufferState, uint32Indices, mesh, options) {
    var hasPositions = mesh.positions.length > 0;
    var hasNormals = mesh.normals.length > 0;
    var hasUVs = mesh.uvs.length > 0;

    var accessorIndex;
    var attributes = {};
    if (hasPositions) {
        accessorIndex = addVertexAttribute(gltf, mesh.positions, 3, mesh.name + '_positions');
        attributes.POSITION = accessorIndex;
        bufferState.positionBuffers.push(mesh.positions.toFloatBuffer());
        bufferState.positionAccessors.push(accessorIndex);
    }
    if (hasNormals) {
        accessorIndex = addVertexAttribute(gltf, mesh.normals, 3, mesh.name + '_normals');
        attributes.NORMAL = accessorIndex;
        bufferState.normalBuffers.push(mesh.normals.toFloatBuffer());
        bufferState.normalAccessors.push(accessorIndex);
    }
    if (hasUVs) {
        accessorIndex = addVertexAttribute(gltf, mesh.uvs, 2, mesh.name + '_texcoords');
        attributes.TEXCOORD_0 = accessorIndex;
        bufferState.uvBuffers.push(mesh.uvs.toFloatBuffer());
        bufferState.uvAccessors.push(accessorIndex);
    }

    // Unload resources
    mesh.positions = undefined;
    mesh.normals = undefined;
    mesh.uvs = undefined;

    var gltfPrimitives = [];
    var primitives = mesh.primitives;
    var primitivesLength = primitives.length;
    for (var i = 0; i < primitivesLength; ++i) {
        var primitive = primitives[i];
        var indexAccessorIndex = addIndexArray(gltf, primitive.indices, uint32Indices, mesh.name + '_' + i + '_indices');
        var indexBuffer = uint32Indices ? primitive.indices.toUint32Buffer() : primitive.indices.toUint16Buffer();
        bufferState.indexBuffers.push(indexBuffer);
        bufferState.indexAccessors.push(indexAccessorIndex);

        primitive.indices = undefined; // Unload resources

        var materialIndex = getMaterial(gltf, materials, images, primitive.material, hasNormals, options);

        gltfPrimitives.push({
            attributes : attributes,
            indices : indexAccessorIndex,
            material : materialIndex,
            mode : WebGLConstants.TRIANGLES
        });
    }

    var gltfMesh = {
        name : mesh.name,
        primitives : gltfPrimitives
    };

    var meshIndex = gltf.meshes.length;
    gltf.meshes.push(gltfMesh);
    return meshIndex;
}

function addNode(gltf, name, meshIndex, parentIndex) {
    var node = {
        name : name,
        mesh : meshIndex
    };

    var nodeIndex = gltf.nodes.length;
    gltf.nodes.push(node);

    if (defined(parentIndex)) {
        var parentNode = gltf.nodes[parentIndex];
        if (!defined(parentNode.children)) {
            parentNode.children = [];
        }
        parentNode.children.push(nodeIndex);
    } else {
        gltf.scenes[gltf.scene].nodes.push(nodeIndex);
    }

    return nodeIndex;
}
