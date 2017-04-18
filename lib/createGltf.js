'use strict';
var Cesium = require('cesium');
var path = require('path');
var PNG = require('pngjs').PNG;
var Material = require('./Material');

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = createGltf;

/**
 * Create a glTF from obj data.
 *
 * @param {Object} objData Output of obj.js, containing an array of nodes containing geometry information, materials, and images.
 * @param {Object} options An object with the following properties:
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

    if (Object.keys(gltf.images).length > 0) {
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
    if (!defined(imagePath) || !defined(images[imagePath])) {
        return undefined;
    }
    return images[imagePath];
}

function getImageName(imagePath) {
    return path.basename(imagePath, path.extname(imagePath));
}

function getTextureName(imagePath) {
    return getImageName(imagePath);
}

function addTexture(gltf, image, imagePath) {
    var imageName = getImageName(imagePath);
    var textureName = getTextureName(imagePath);
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

function getTextureIndex(gltf, imagePath) {
    var name = getTextureName(imagePath);
    var textures = gltf.textures;
    var length = textures.length;
    for (var i = 0; i < length; ++i) {
        if (textures[i].name === name) {
            return i;
        }
    }
}

function getTexture(gltf, images, imagePath) {
    var image = getImage(images, imagePath);
    if (!defined(image)) {
        return undefined;
    }
    var textureIndex = getTextureIndex(gltf, imagePath);
    if (!defined(textureIndex)) {
        textureIndex = addTexture(gltf, image, imagePath);
    }
    return textureIndex;
}

function luminance(color) {
    var value = 0.2125 * color[0] + 0.7154 * color[1] + 0.0721 * color[2];
    return Math.min(value, 1.0); // Clamp just to handle edge cases
}

function addColors(left, right) {
    var red = Math.min(left[0] + right[0], 1.0);
    var green = Math.min(left[1] + right[1], 1.0);
    var blue = Math.min(left[2] + right[2], 1.0);
    return [red, green, blue];
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

var scratchColor = new Array(3);

function getGrayscaleChannel(image, targetWidth, targetHeight) {
    var pixels = image.decoded; // RGBA
    var width = image.width;
    var height = image.height;
    var pixelsLength = width * height;
    var grayPixels = Buffer.alloc(pixelsLength);
    for (var i = 0; i < pixelsLength; ++i) {
        scratchColor[0] = pixels.readUInt8(i * 4);
        scratchColor[1] = pixels.readUInt8(i * 4 + 1);
        scratchColor[2] = pixels.readUInt8(i * 4 + 2);
        var value = luminance(scratchColor) * 255;
        grayPixels.writeUInt8(value, i);
    }
    if (width !== targetWidth || height !== targetHeight) {
        grayPixels = resizeChannel(grayPixels, width, height, targetWidth, targetHeight);
    }
    return grayPixels;
}

function writeChannel(pixels, channel, index, width, height) {
    var pixelsLength = width * height;
    for (var i = 0; i < pixelsLength; ++i) {
        var value = channel.readUInt8(i);
        pixels.writeUInt8(value, i * 4 + index);
    }
}

function createMetallicRoughnessTexture(gltf, materialName, metallicImage, roughnessImage, options) {
    if (!defined(metallicImage) && !defined(roughnessImage)) {
        return undefined;
    }

    if (defined(metallicImage) && !defined(metallicImage.decoded)) {
        options.logger('Could not get decoded image data for ' + metallicImage + '. The material will be created without a metallicRoughness texture.');
        return undefined;
    }

    if (defined(roughnessImage) && !defined(roughnessImage.decoded)) {
        options.logger('Could not get decoded image data for ' + roughnessImage + '. The material will be created without a metallicRoughness texture.');
        return undefined;
    }

    var width;
    var height;

    if (defined(metallicImage) && defined(roughnessImage)) {
        width = Math.min(metallicImage.width, roughnessImage.width);
        height = Math.min(metallicImage.height, roughnessImage.height);
    } else if (defined(metallicImage)) {
        width = metallicImage.width;
        height = metallicImage.height;
    } else if (defined(roughnessImage)) {
        width = roughnessImage.width;
        height = roughnessImage.height;
    }

    var pixelsLength = width * height;
    var pixels = Buffer.alloc(pixelsLength * 4, 0xFF); // Initialize with 4 channels, unused channels will be white

    if (defined(metallicImage)) {
        // Write into the B channel
        var metallicChannel = getGrayscaleChannel(metallicImage, width, height);
        writeChannel(pixels, metallicChannel, 2, width, height);
    }

    if (defined(roughnessImage)) {
        // Write into the G channel
        var roughnessChannel = getGrayscaleChannel(roughnessImage, width, height);
        writeChannel(pixels, roughnessChannel, 1, width, height);
    }

    var pngInput = {
        data : pixels,
        width : width,
        height : height
    };

    var pngOptions = {
        width : width,
        height : height,
        colorType : 2, // RGB
        inputHasAlpha : true
    };

    var encoded = PNG.sync.write(pngInput, pngOptions);

    var image = {
        transparent : false,
        source : encoded,
        extension : '.png'
    };

    var imageName = materialName + '-' + 'MetallicRoughness';
    return addTexture(gltf, image, imageName);
}

function addMaterial(gltf, images, material, name, hasNormals, options) {
    // Translate the traditional diffuse/specular material to pbr metallic roughness.
    // Specular intensity is extracted from the specular color and treated as the metallic factor.
    // Specular shininess is typically an exponent from 0 to 1000, and is converted to a 0-1 range as the roughness factor.
    var ambientTexture = getTexture(gltf, images, material.ambientTexture);
    var emissiveTexture = getTexture(gltf, images, material.emissiveTexture);
    var baseColorTexture = getTexture(gltf, images, material.diffuseTexture);
    var normalTexture = getTexture(gltf, images, material.normalTexture);

    // Emissive and ambient represent roughly the same concept, so chose whichever is defined.
    emissiveTexture = defaultValue(emissiveTexture, ambientTexture);

    var metallicImage = getImage(images, material.specularTexture);
    var roughnessImage = getImage(images, material.specularShininessTexture);
    var metallicRoughnessTexture = createMetallicRoughnessTexture(gltf, name, metallicImage, roughnessImage, options);

    var baseColorFactor = [1.0, 1.0, 1.0, 1.0];
    var metallicFactor = 1.0;
    var roughnessFactor = 1.0;
    var emissiveFactor = [1.0, 1.0, 1.0];

    if (!defined(baseColorTexture)) {
        baseColorFactor = material.diffuseColor;
    }

    if (!defined(metallicImage)) {
        metallicFactor = luminance(material.specularColor);
    }

    if (!defined(roughnessImage)) {
        var specularShininess = material.specularShininess;
        if (specularShininess > 1.0) {
            specularShininess /= 1000.0;
        }
        roughnessFactor = specularShininess;
    }

    if (!defined(emissiveTexture)) {
        // If ambient color is [1, 1, 1] assume it is a multiplier and instead change to [0, 0, 0]
        var ambientColor = material.ambientColor;
        if (ambientColor[0] === 1.0 && ambientColor[1] === 1.0 && ambientColor[2] === 1.0) {
            ambientColor = [0.0, 0.0, 0.0, 1.0];
        }
        emissiveFactor = addColors(material.emissiveColor, ambientColor);
    }

    var alpha = material.alpha;
    baseColorFactor[3] = alpha;

    var transparent = alpha < 1.0;
    if (defined(material.diffuseTexture)) {
        transparent |= images[material.diffuseTexture].transparent;
    }

    var doubleSided = transparent;
    var alphaMode = transparent ? 'BLEND' : 'OPAQUE';

    if (!hasNormals) {
        // TODO : what is the lighting like for models that don't have normals? Can pbrMetallicRoughness just be undefined? Is setting the baseColor to black a good approach here?
        emissiveTexture = baseColorTexture;
        emissiveFactor = baseColorFactor.slice(0, 3);
        baseColorTexture = undefined;
        baseColorFactor = [0.0, 0.0, 0.0, baseColorFactor[3]];
        metallicRoughnessTexture = undefined;
        metallicFactor = 0.0;
        roughnessFactor = 0.0;
        normalTexture = undefined;
    }

    var gltfMaterial = {
        name : name,
        pbrMetallicRoughness : {
            baseColorTexture : baseColorTexture,
            baseColorFactor : baseColorFactor,
            metallicFactor : metallicFactor,
            roughnessFactor : roughnessFactor,
            metallicRoughnessTexture : metallicRoughnessTexture
        },
        normalTexture : normalTexture,
        emissiveTexture : emissiveTexture,
        emissiveFactor : emissiveFactor,
        alphaMode : alphaMode,
        doubleSided : doubleSided,
        extras : {
            _obj2gltf : {
                hasNormals : hasNormals
            }
        }
    };

    var materialIndex = gltf.materials.length;
    gltf.materials.push(gltfMaterial);
    return materialIndex;
}


function getMaterialIndex(gltf, name) {
    var materials = gltf.materials;
    var length = materials.length;
    for (var i = 0; i < length; ++i) {
        if (materials[i].name === name) {
            return i;
        }
    }
    return undefined;
}

function getMaterial(gltf, materials, images, materialName, hasNormals, options) {
    if (!defined(materialName)) {
        // Create a default material if the primitive does not specify one
        materialName = 'default';
    }

    var material = materials[materialName];
    material = defined(material) ? material : new Material();
    var materialIndex = getMaterialIndex(gltf, materialName);

    // Check if this material has already been added but with incompatible shading
    if (defined(materialIndex)) {
        var gltfMaterial = gltf.materials[materialIndex];
        var normalShading = gltfMaterial.extras._obj2gltf.hasNormals;
        if (hasNormals !== normalShading) {
            materialName += (hasNormals ? '_shaded' : '_constant');
            materialIndex = getMaterialIndex(gltf, materialName);
        }
    }

    if (!defined(materialIndex)) {
        materialIndex = addMaterial(gltf, images, material, materialName, hasNormals, options);
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
