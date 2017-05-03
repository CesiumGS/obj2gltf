'use strict';
var Cesium = require('cesium');
var path = require('path');
var PNG = require('pngjs').PNG;
var Material = require('./Material');

var CesiumMath = Cesium.Math;
var defined = Cesium.defined;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = createGltf;

/**
 * Create a glTF from obj data.
 *
 * @param {Object} objData Output of obj.js, containing an array of nodes containing geometry information, materials, and images.
 * @param {Object} options An object with the following properties:
 * @param {Boolean} [options.packOcclusion=false] Pack the occlusion texture in the red channel of metallic-roughness texture.
 * @param {Boolean} [options.inputMetallicRoughness=false] The values in the mtl file are already metallic-roughness PBR values and no conversion step should be applied. Metallic is stored in the Ks and map_Ks slots and roughness is stored in the Ns and map_Ns slots.
 * @param {Boolean} [options.inputSpecularGlossiness=false] The values in the mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the KHR_materials_pbrSpecularGlossiness extension.
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
        vertexBuffers : [],
        vertexBufferByteOffset : 0,
        vertexBufferViewIndex : 0,
        indexBuffers : [],
        indexBufferByteOffset : 0,
        indexBufferViewIndex : 1
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
            minFilter : WebGLConstants.LINEAR,
            wrapS : WebGLConstants.REPEAT,
            wrapT : WebGLConstants.REPEAT
        });
    }

    addBuffers(gltf, bufferState);

    return gltf;
}

function addBuffers(gltf, bufferState) {
    var bufferName = 'buffer';
    var vertexBufferViewName = 'bufferView_vertex';
    var indexBufferViewName = 'bufferView_index';

    var vertexBuffers = bufferState.vertexBuffers;
    var indexBuffers = bufferState.indexBuffers;
    var vertexBufferByteLength = bufferState.vertexBufferByteOffset;
    var indexBufferByteLength = bufferState.indexBufferByteOffset;

    var buffers = [];
    buffers = buffers.concat(vertexBuffers, indexBuffers);
    var buffer = Buffer.concat(buffers);

    gltf.buffers.push({
        name : bufferName,
        byteLength : buffer.byteLength,
        extras : {
            _obj2gltf : {
                source : buffer
            }
        }
    });

    gltf.bufferViews.push({
        name : vertexBufferViewName,
        buffer : 0,
        byteLength : vertexBufferByteLength,
        byteOffset : 0,
        target : WebGLConstants.ARRAY_BUFFER
    });

    gltf.bufferViews.push({
        name : indexBufferViewName,
        buffer : 0,
        byteLength : indexBufferByteLength,
        byteOffset : vertexBufferByteLength,
        target : WebGLConstants.ELEMENT_ARRAY_BUFFER
    });
}

function getImage(images, imagePath) {
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
    return getImageName(image);
}

function addTexture(gltf, image) {
    var imageName = getImageName(image);
    var textureName = getTextureName(image);
    var imageIndex = gltf.images.length;
    var textureIndex = gltf.textures.length;

    gltf.images.push({
        name : imageName,
        extras : {
            _obj2gltf : {
                source : image.source,
                extension : image.extension
            }
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
    return textureIndex;
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

function resizeChannel(sourcePixels, sourceWidth, sourceHeight, targetWidth, targetHeight) {
    // Nearest neighbor sampling
    var targetPixels = Buffer.alloc(targetWidth * targetHeight);
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

function getImageChannel(image, index, targetWidth, targetHeight) {
    var pixels = image.decoded; // RGBA
    var width = image.width;
    var height = image.height;
    var pixelsLength = width * height;
    var channel = Buffer.alloc(pixelsLength);
    for (var i = 0; i < pixelsLength; ++i) {
        var value = pixels.readUInt8(i * 4 + index);
        channel.writeUInt8(value, i);
    }
    if (width !== targetWidth || height !== targetHeight) {
        channel = resizeChannel(channel, width, height, targetWidth, targetHeight);
    }
    return channel;
}

function writeChannel(pixels, channel, index, width, height) {
    var pixelsLength = width * height;
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
        if (defined(image)) {
            width = Math.min(image.width, width);
            height = Math.min(image.height, height);
        }
    }

    for (i = 0; i < length; ++i) {
        image = images[i];
        if (defined(image)) {
            if (image.width !== width || image.height !== height) {
                options.logger('Image ' + image.path + ' will be scaled from ' + image.width + 'x' + image.height + ' to ' + width + 'x' + height + '.');
            }
        }
    }

    return [width, height];
}

function encodePng(pixels, width, height, inputChannels, outputChannels) {
    var pngInput = {
        data : pixels,
        width : width,
        height : height
    };

    // Constants defined by pngjs
    var rgbColorType = 2;
    var rgbaColorType = 4;

    var colorType = outputChannels === 4 ? rgbaColorType : rgbColorType;
    var inputColorType = inputChannels === 4 ? rgbaColorType : rgbColorType;
    var inputHasAlpha = inputChannels === 4;

    var pngOptions = {
        width : width,
        height : height,
        colorType : colorType,
        inputColorType : inputColorType,
        inputHasAlpha : inputHasAlpha
    };

    return PNG.sync.write(pngInput, pngOptions);
}

function createMetallicRoughnessTexture(gltf, materialName, metallicImage, roughnessImage, occlusionImage, options) {
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

    var dimensions = getMinimumDimensions([metallicImage, roughnessImage, occlusionImage], options);
    var width = dimensions[0];
    var height = dimensions[1];
    var pixelsLength = width * height;
    var pixels = Buffer.alloc(pixelsLength * 4, 0xFF); // Initialize with 4 channels, unused channels will be white

    if (packMetallic) {
        // Write into the B channel
        var metallicChannel = getImageChannel(metallicImage, 0, width, height);
        writeChannel(pixels, metallicChannel, 2, width, height);
    }

    if (packRoughness) {
        // Write into the G channel
        var roughnessChannel = getImageChannel(roughnessImage, 0, width, height);
        writeChannel(pixels, roughnessChannel, 1, width, height);
    }

    if (packOcclusion) {
        // Write into the R channel
        var occlusionChannel = getImageChannel(occlusionImage, 0, width, height);
        writeChannel(pixels, occlusionChannel, 0, width, height);
    }

    var imageName = materialName + '-' + 'MetallicRoughness';
    if (packOcclusion) {
        imageName += 'Occlusion';
    }

    var pngSource = encodePng(pixels, width, height, 4, 3);

    var image = {
        transparent : false,
        source : pngSource,
        path : imageName,
        extension : '.png'
    };

    return addTexture(gltf, image);
}

function createSpecularGlossinessTexture(gltf, materialName, specularImage, glossinessImage, options) {
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

    var dimensions = getMinimumDimensions([specularImage, glossinessImage], options);
    var width = dimensions[0];
    var height = dimensions[1];
    var pixelsLength = width * height;
    var pixels = Buffer.alloc(pixelsLength * 4, 0xFF); // Initialize with 4 channels, unused channels will be white

    if (packSpecular) {
        // Write into the R, G, B channels
        var redChannel = getImageChannel(specularImage, 0, width, height);
        var greenChannel = getImageChannel(specularImage, 1, width, height);
        var blueChannel = getImageChannel(specularImage, 2, width, height);
        writeChannel(pixels, redChannel, 0, width, height);
        writeChannel(pixels, greenChannel, 1, width, height);
        writeChannel(pixels, blueChannel, 2, width, height);
    }

    if (packGlossiness) {
        // Write into the A channel
        var glossinessChannel = getImageChannel(glossinessImage, 0, width, height);
        writeChannel(pixels, glossinessChannel, 3, width, height);
    }

    var imageName = materialName + '-' + 'SpecularGlossiness';

    var pngSource = encodePng(pixels, width, height, 4, 4);

    var image = {
        transparent : false,
        source : pngSource,
        path : imageName,
        extension : '.png'
    };

    return addTexture(gltf, image);
}

function createSpecularGlossinessMaterial(gltf, images, material, options) {
    var materialName = material.name;

    var emissiveImage = getImage(images, material.emissiveTexture);
    var normalImage = getImage(images, material.normalTexture);
    var occlusionImage = getImage(images, material.ambientTexture);
    var diffuseImage = getImage(images, material.diffuseTexture);
    var specularImage = getImage(images, material.specularTexture);
    var glossinessImage = getImage(images, material.specularShininessTexture);

    var emissiveTexture = getTexture(gltf, emissiveImage);
    var normalTexture = getTexture(gltf, normalImage);
    var occlusionTexture = getTexture(gltf, occlusionImage);
    var diffuseTexture = getTexture(gltf, diffuseImage);
    var specularGlossinessTexture = createSpecularGlossinessTexture(gltf, materialName, specularImage, glossinessImage, options);

    var emissiveFactor = getEmissiveFactor(material);
    var diffuseFactor = material.diffuseColor;
    var specularFactor = material.specularColor;
    var glossinessFactor = material.specularShininess;

    if (defined(emissiveTexture)) {
        emissiveFactor = [1.0, 1.0, 1.0];
    }

    if (defined(diffuseTexture)) {
        diffuseFactor = [1.0, 1.0, 1.0, 1.0];
    }

    if (defined(specularImage)) {
        specularFactor = 1.0;
    }

    if (defined(glossinessImage)) {
        glossinessFactor = 1.0;
    }

    var alpha = material.alpha;
    diffuseFactor[3] = alpha;

    var transparent = alpha < 1.0;
    if (defined(diffuseImage)) {
        transparent |= diffuseImage.transparent;
    }

    var doubleSided = transparent;
    var alphaMode = transparent ? 'BLEND' : 'OPAQUE';

    var gltfMaterial = {
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

    return gltfMaterial;
}

function createMetallicRoughnessMaterial(gltf, images, material, options) {
    var materialName = material.name;

    var emissiveImage = getImage(images, material.emissiveTexture);
    var normalImage = getImage(images, material.normalTexture);
    var occlusionImage = getImage(images, material.ambientTexture);
    var baseColorImage = getImage(images, material.diffuseTexture);
    var metallicImage = getImage(images, material.specularTexture);
    var roughnessImage = getImage(images, material.specularShininessTexture);

    var emissiveTexture = getTexture(gltf, emissiveImage);
    var normalTexture = getTexture(gltf, normalImage);
    var baseColorTexture = getTexture(gltf, baseColorImage);
    var metallicRoughnessTexture = createMetallicRoughnessTexture(gltf, materialName, metallicImage, roughnessImage, occlusionImage, options);

    var packOcclusion = defined(occlusionImage) || options.packOcclusion;
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
        transparent |= baseColorImage.transparent;
    }

    var doubleSided = transparent;
    var alphaMode = transparent ? 'BLEND' : 'OPAQUE';

    var gltfMaterial = {
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

    return gltfMaterial;
}

function convertTraditionalToMetallicRoughness(material) {
    // Translate the blinn-phong model to the pbr metallic-roughness model
    // Roughness factor is a combination of specular intensity and shininess
    // Metallic factor is 0.0
    var specularIntensity = material.specularColor[0];
    var specularShininess = material.specularShininess;

    // Transform from 0-1000 range to 0-1 range. Then invert.
    var roughnessFactor = specularShininess;
    roughnessFactor = roughnessFactor / 1000.0;
    roughnessFactor = 1.0 - roughnessFactor;
    roughnessFactor = CesiumMath.clamp(roughnessFactor, 0.0, 1.0);

    // Low specular intensity values should produce a rough material even if shininess is high.
    if (specularIntensity < 0.1) {
        roughnessFactor *= specularIntensity;
    }

    var metallicFactor = 0.0;

    material.specularColor = [metallicFactor, metallicFactor, metallicFactor, 1.0];
    material.specularShiness = roughnessFactor;
}

function addMaterial(gltf, images, material, options) {
    var gltfMaterial;
    if (options.inputSpecularGlossiness) {
        gltfMaterial = createSpecularGlossinessMaterial(gltf, images, material, options);
    } else if (options.inputMetallicRoughness) {
        gltfMaterial = createMetallicRoughnessMaterial(gltf, images, material, options);
    } else {
        convertTraditionalToMetallicRoughness(material);
        gltfMaterial = createMetallicRoughnessMaterial(gltf, images, material, options);
    }

    var materialIndex = gltf.materials.length;
    gltf.materials.push(gltfMaterial);
    return materialIndex;
}

function getMaterialIndex(gltf, materialName) {
    var materials = gltf.materials;
    var length = materials.length;
    for (var i = 0; i < length; ++i) {
        if (materials[i].name === materialName) {
            return i;
        }
    }
    return undefined;
}

function getMaterial(gltf, materials, images, materialName, options) {
    if (!defined(materialName)) {
        // Create a default material if the primitive does not specify one
        materialName = 'default';
    }

    var material;
    var materialsLength = materials.length;
    for (var i = 0; i < materialsLength; ++i) {
        if (materials[i].name === materialName) {
            material = materials[i];
        }
    }

    if (!defined(material)) {
        material = new Material();
        material.name = materialName;
    }

    var materialIndex = getMaterialIndex(gltf, materialName);

    if (!defined(materialIndex)) {
        materialIndex = addMaterial(gltf, images, material, options);
    }

    return materialIndex;
}

function addVertexAttribute(gltf, bufferState, array, components) {
    var buffer = array.toFloatBuffer();
    var count = array.length / components;
    var minMax = array.getMinMax(components);
    var type = (components === 3 ? 'VEC3' : 'VEC2');

    var accessor = {
        bufferView : bufferState.vertexBufferViewIndex,
        byteOffset : bufferState.vertexBufferByteOffset,
        componentType : WebGLConstants.FLOAT,
        count : count,
        min : minMax.min,
        max : minMax.max,
        type : type
    };

    bufferState.vertexBufferByteOffset += buffer.length;
    bufferState.vertexBuffers.push(buffer);

    var accessorIndex = gltf.accessors.length;
    gltf.accessors.push(accessor);
    return accessorIndex;
}

function addIndexArray(gltf, bufferState, array, uint32Indices) {
    var buffer = uint32Indices ? array.toUint32Buffer() : array.toUint16Buffer();
    var componentType = uint32Indices ? WebGLConstants.UNSIGNED_INT : WebGLConstants.UNSIGNED_SHORT;
    var count = array.length;
    var minMax = array.getMinMax(1);

    var accessor = {
        bufferView : bufferState.indexBufferViewIndex,
        byteOffset : bufferState.indexBufferByteOffset,
        componentType : componentType,
        count : count,
        min : minMax.min,
        max : minMax.max,
        type : 'SCALAR'
    };

    bufferState.indexBufferByteOffset += buffer.length;
    bufferState.indexBuffers.push(buffer);

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

    var attributes = {};
    if (hasPositions) {
        attributes.POSITION = addVertexAttribute(gltf, bufferState, mesh.positions, 3);
    }
    if (hasNormals) {
        attributes.NORMAL = addVertexAttribute(gltf, bufferState, mesh.normals, 3);
    }
    if (hasUVs) {
        attributes.TEXCOORD_0 = addVertexAttribute(gltf, bufferState, mesh.uvs, 2);
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
        var indexAccessorIndex = addIndexArray(gltf, bufferState, primitive.indices, uint32Indices);
        primitive.indices = undefined; // Unload resources

        var materialIndex = getMaterial(gltf, materials, images, primitive.material, options);

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
