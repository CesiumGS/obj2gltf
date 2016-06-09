"use strict";
var path = require('path');
var Cesium = require('cesium');
var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = createGltf;

function createGltf(data, modelName, done) {
    var vertexCount = data.vertexCount;
    var vertexArray = data.vertexArray;
    var positionMin = data.positionMin;
    var positionMax = data.positionMax;
    var hasUVs = data.hasUVs;
    var hasNormals = data.hasNormals;
    var materialGroups = data.materialGroups;
    var materials = data.materials;
    var images = data.images;

    var i, j, name;

    var sizeOfFloat32 = 4;
    var sizeOfUint32 = 4;
    var sizeOfUint16 = 2;

    var indexComponentType;
    var indexComponentSize;

    // Reserve the 65535 index for primitive restart
    if (vertexCount < 65535) {
        indexComponentType = WebGLConstants.UNSIGNED_SHORT;
        indexComponentSize = sizeOfUint16;
    } else {
        indexComponentType = WebGLConstants.UNSIGNED_INT;
        indexComponentSize = sizeOfUint32;
    }

    // Create primitives
    var primitives = [];
    var indexArrayLength = 0;
    var indexArray;
    var indexCount;
    for (name in materialGroups) {
        if (materialGroups.hasOwnProperty(name)) {
            indexArray = materialGroups[name];
            indexCount = indexArray.length;
            primitives.push({
                indexArray : indexArray,
                indexOffset : indexArrayLength,
                indexCount : indexCount,
                material : name
            });
            indexArrayLength += indexCount;
        }
    }

    // Create buffer to store vertex and index data
    var indexArrayByteLength = indexArrayLength * indexComponentSize;
    var vertexArrayLength = vertexArray.length; // In floats
    var vertexArrayByteLength = vertexArrayLength * sizeOfFloat32;
    var bufferByteLength = vertexArrayByteLength + indexArrayByteLength;
    var buffer = new Buffer(bufferByteLength);

    // Write vertex data
    var byteOffset = 0;
    for (i = 0; i < vertexArrayLength; ++i) {
        buffer.writeFloatLE(vertexArray[i], byteOffset);
        byteOffset += sizeOfFloat32;
    }

    // Write index data
    var primitivesLength = primitives.length;
    for (i = 0; i < primitivesLength; ++i) {
        indexArray = primitives[i].indexArray;
        indexCount = indexArray.length;
        for (j = 0; j < indexCount; ++j) {
            if (indexComponentSize === sizeOfUint16) {
                buffer.writeUInt16LE(indexArray[j], byteOffset);
            } else {
                buffer.writeUInt32LE(indexArray[j], byteOffset);
            }
            byteOffset += indexComponentSize;
        }
    }

    var positionByteOffset = 0;
    var normalByteOffset = 0;
    var uvByteOffset = 0;
    var vertexByteStride = 0;

    if (hasNormals && hasUVs) {
        normalByteOffset = sizeOfFloat32 * 3;
        uvByteOffset = sizeOfFloat32 * 6;
        vertexByteStride = sizeOfFloat32 * 8;
    } else if (hasNormals && !hasUVs) {
        normalByteOffset = sizeOfFloat32 * 3;
        vertexByteStride = sizeOfFloat32 * 6;
    } else if (!hasNormals && hasUVs) {
        uvByteOffset = sizeOfFloat32 * 3;
        vertexByteStride = sizeOfFloat32 * 5;
    } else if (!hasNormals && !hasUVs) {
        vertexByteStride = sizeOfFloat32 * 3;
    }

    var bufferId = 'buffer_' + modelName;
    var bufferViewVertexId = 'bufferView_vertex';
    var bufferViewIndexId = 'bufferView_index';
    var accessorPositionId = 'accessor_position';
    var accessorUVId = 'accessor_uv';
    var accessorNormalId = 'accessor_normal';
    var meshId = 'mesh_' + modelName;
    var sceneId = 'scene_' + modelName;
    var nodeId = 'node_' + modelName;
    var samplerId = 'sampler_0';

    function getAccessorIndexId(i) {
        return 'accessor_index_' + i;
    }

    function getMaterialId(material) {
        return 'material_' + material;
    }

    function getTextureId(image) {
        if (!defined(image)) {
            return undefined;
        }
        return 'texture_' + path.basename(image).substr(0, image.lastIndexOf('.'));
    }

    function getImageId(image) {
        return 'image_' + path.basename(image).substr(0, image.lastIndexOf('.'));
    }

    var gltf = {
        accessors : {},
        asset : {},
        buffers : {},
        bufferViews : {},
        images : {},
        materials : {},
        meshes : {},
        nodes : {},
        samplers : {},
        scene : sceneId,
        scenes : {},
        textures : {}
    };

    gltf.asset = {
        "generator": "OBJ2GLTF",
        "premultipliedAlpha": true,
        "profile": {
            "api": "WebGL",
            "version": "1.0"
        },
        "version": 1
    };

    gltf.scenes[sceneId] = {
        nodes : [nodeId]
    };

    gltf.nodes[nodeId] = {
        children : [],
        matrix : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        meshes : [meshId],
        name : modelName
    };

    gltf.samplers[samplerId] = {}; // Use default values

    var bufferUri = 'data:application/octet-stream;base64,' + buffer.toString('base64');

    gltf.buffers[bufferId] = {
        byteLength : bufferByteLength,
        type : 'arraybuffer',
        uri : bufferUri
    };

    gltf.bufferViews[bufferViewVertexId] = {
        buffer : bufferId,
        byteLength : vertexArrayByteLength,
        byteOffset : 0,
        target : WebGLConstants.ARRAY_BUFFER
    };
    gltf.bufferViews[bufferViewIndexId] = {
        buffer : bufferId,
        byteLength : indexArrayByteLength,
        byteOffset : vertexArrayByteLength,
        target : WebGLConstants.ELEMENT_ARRAY_BUFFER
    };

    for (i = 0; i < primitivesLength; ++i) {
        var primitive = primitives[i];
        gltf.accessors[getAccessorIndexId(i)] = {
            bufferView : bufferViewIndexId,
            byteOffset : primitive.indexOffset * indexComponentSize,
            byteStride : 0,
            componentType : indexComponentType,
            count : primitive.indexCount,
            type : 'SCALAR'
        };
    }

    gltf.accessors[accessorPositionId] = {
        bufferView : bufferViewVertexId,
        byteOffset : positionByteOffset,
        byteStride : vertexByteStride,
        componentType : WebGLConstants.FLOAT,
        count : vertexCount,
        min : positionMin,
        max : positionMax,
        type : 'VEC3'
    };

    if (hasNormals) {
        gltf.accessors[accessorNormalId] = {
            bufferView : bufferViewVertexId,
            byteOffset : normalByteOffset,
            byteStride : vertexByteStride,
            componentType : WebGLConstants.FLOAT,
            count : vertexCount,
            type : 'VEC3'
        };
    }

    if (hasUVs) {
        gltf.accessors[accessorUVId] = {
            bufferView : bufferViewVertexId,
            byteOffset : uvByteOffset,
            byteStride : vertexByteStride,
            componentType : WebGLConstants.FLOAT,
            count : vertexCount,
            type : 'VEC2'
        };
    }

    var gltfPrimitives = [];
    gltf.meshes[meshId] = {
        name : modelName,
        primitives : gltfPrimitives
    };

    var gltfAttributes = {};
    gltfAttributes.POSITION = accessorPositionId;
    if (hasNormals) {
        gltfAttributes.NORMAL = accessorNormalId;
    }
    if (hasUVs) {
        gltfAttributes.TEXCOORD_0 = accessorUVId;
    }

    for (i = 0; i < primitivesLength; ++i) {
        gltfPrimitives.push({
            attributes : gltfAttributes,
            indices : getAccessorIndexId(i),
            material : getMaterialId(primitives[i].material),
            mode : WebGLConstants.TRIANGLES
        });
    }

    for (name in materials) {
        if (materials.hasOwnProperty(name)) {
            var material = materials[name];
            var materialId = getMaterialId(name);
            var values = {
                ambient : defaultValue(defaultValue(getTextureId(material.ambientColorMap), material.ambientColor), [0, 0, 0, 1]),
                diffuse : defaultValue(defaultValue(getTextureId(material.diffuseColorMap), material.diffuseColor), [0, 0, 0, 1]),
                emission : defaultValue(defaultValue(getTextureId(material.emissionColorMap), material.emissionColor), [0, 0, 0, 1]),
                specular : defaultValue(defaultValue(getTextureId(material.specularColorMap), material.specularColor), [0, 0, 0, 1]),
                shininess : defaultValue(material.specularShininess, 0.0)
            };

            gltf.materials[materialId] = {
                name: name,
                values: values
            };
        }
    }

    for (name in images) {
        if (images.hasOwnProperty(name)) {
            var image = images[name];
            var imageId = getImageId(name);
            var textureId = getTextureId(name);
            var format;
            var channels = image.channels;
            switch (channels) {
                case 1:
                    format = WebGLConstants.ALPHA;
                    break;
                case 2:
                    format = WebGLConstants.LUMINANCE_ALPHA;
                    break;
                case 3:
                    format = WebGLConstants.RGB;
                    break;
                case 4:
                    format = WebGLConstants.RGBA;
                    break;
            }

            gltf.images[imageId] = {
                uri : image.uri
            };
            gltf.textures[textureId] = {
                format : format,
                internalFormat : format,
                sampler : samplerId,
                source : imageId,
                target : WebGLConstants.TEXTURE_2D,
                type : WebGLConstants.UNSIGNED_BYTE
            };
        }
    }

    done(gltf);
}
