'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var fsExtra = require('fs-extra');
var path = require('path');

var fxExtraOutputFile = Promise.promisify(fsExtra.outputFile);

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = createGltf;

var sizeOfFloat32 = 4;
var sizeOfUint32 = 4;
var sizeOfUint16 = 2;

function createGltf(gltfPath, objData) {
    var nodes = objData.nodes;
    var materials = objData.materials;
    var images = objData.images;
    var sceneId = 'scene';

    var gltf = {
        accessors : {},
        asset : {},
        buffers : {},
        bufferViews : {},
        extensionsUsed : ['KHR_materials_common'],
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
        generator : 'obj2gltf',
        profile : {
            api : 'WebGL',
            version : '1.0'
        },
        version: '1.0'
    };

    gltf.scenes[sceneId] = {
        nodes : []
    };

    var samplerId = 'sampler';
    gltf.samplers[samplerId] = {
        magFilter : WebGLConstants.LINEAR,
        minFilter : WebGLConstants.LINEAR,
        wrapS : WebGLConstants.REPEAT,
        wrapT : WebGLConstants.REPEAT
    };

    function getImageId(imagePath) {
        return path.basename(imagePath, path.extname(imagePath));
    }

    function getTextureId(imagePath) {
        if (!defined(imagePath) || !defined(images[imagePath])) {
            return undefined;
        }
        return 'texture_' + getImageId(imagePath);
    }

    function createMaterial(material, hasNormals) {
        var ambient = defaultValue(defaultValue(getTextureId(material.ambientColorMap), material.ambientColor), [0.1, 0.1, 0.1, 1]);
        var diffuse = defaultValue(defaultValue(getTextureId(material.diffuseColorMap), material.diffuseColor), [0.5, 0.5, 0.5, 1]);
        var emission = defaultValue(defaultValue(getTextureId(material.emissionColorMap), material.emissionColor), [0, 0, 0, 1]);
        var specular = defaultValue(defaultValue(getTextureId(material.specularColorMap), material.specularColor), [0, 0, 0, 1]);
        var alpha = defaultValue(defaultValue(material.alpha), 1.0);
        var shininess = defaultValue(material.specularShininess, 0.0);
        var hasSpecular = (shininess > 0.0) && (specular[0] > 0.0 || specular[1] > 0.0 || specular[2] > 0.0);

        var transparent;
        var transparency = 1.0;
        if (typeof diffuse === 'string') {
            transparency = alpha;
            transparent = images[material.diffuseColorMap].transparent || (transparency < 1.0);
        } else {
            diffuse[3] = alpha;
            transparent = diffuse[3] < 1.0;
        }

        var doubleSided = transparent;

        if (!hasNormals) {
            // Constant technique only factors in ambient and emission sources - set emission to diffuse
            emission = diffuse;
        }

        var technique = hasNormals ? (hasSpecular ? 'PHONG' : 'LAMBERT') : 'CONSTANT';
        return {
            name : materialId,
            extensions : {
                KHR_materials_common : {
                    technique : technique,
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

    for (var imagePath in images) {
        if (images.hasOwnProperty(imagePath) && defined(images[imagePath])) {
            var image = images[imagePath];
            var imageId = getImageId(imagePath);
            var textureId = getTextureId(imagePath);

            gltf.images[imageId] = {
                name : imageId,
                uri : image.uri
            };
            gltf.textures[textureId] = {
                format : image.format,
                internalFormat : image.format,
                sampler : samplerId,
                source : imageId,
                target : WebGLConstants.TEXTURE_2D,
                type : WebGLConstants.UNSIGNED_BYTE
            };
        }
    }

    var bufferId = 'buffer';

    var vertexBufferViewId = 'bufferView_vertex';
    var vertexBuffers = [];
    var vertexByteOffset = 0;

    var indexUInt16BufferViewId = 'bufferView_index_uint16';
    var indexUInt16Buffers = [];
    var indexUint16ByteOffset = 0;

    var indexUInt32BufferViewId = 'bufferView_index_uint32';
    var indexUInt32Buffers = [];
    var indexUint32ByteOffset = 0;

    var accessorCount = 0;

    function addVertexAttribute(array, components) {
        var length = array.length;
        var min = new Array(components).fill(Number.POSITIVE_INFINITY);
        var max = new Array(components).fill(Number.NEGATIVE_INFINITY);
        var buffer = Buffer.alloc(length * sizeOfFloat32);
        var count = length / components;
        for (var i = 0; i < count; ++i) {
            for (var j = 0; j < components; ++j) {
                var index = i * components + j;
                var value = array[index];
                min[j] = Math.min(min[j], value);
                max[j] = Math.max(max[j], value);
                buffer.writeFloatLE(value, index * sizeOfFloat32);
            }
        }

        var type = (components === 3 ? 'VEC3' : 'VEC2');
        var accessor = {
            bufferView : vertexBufferViewId,
            byteOffset : vertexByteOffset,
            byteStride : 0,
            componentType : WebGLConstants.FLOAT,
            count : count,
            min : min,
            max : max,
            type : type
        };

        vertexByteOffset += buffer.length;
        vertexBuffers.push(buffer);
        var accessorId = 'accessor_' + accessorCount++;
        gltf.accessors[accessorId] = accessor;
        return accessorId;
    }

    function addIndexUInt16Array(array, min, max) {
        var length = array.length;
        var paddedLength = length + ((length % 2 === 0) ? 0 : 1); // Round to next multiple of 2
        buffer = Buffer.alloc(paddedLength * sizeOfUint16);
        for (var i = 0; i < length; ++i) {
            buffer.writeUInt16LE(array[i], i * sizeOfUint16);
        }
        var accessor = {
            bufferView : indexUInt16BufferViewId,
            byteOffset : indexUint16ByteOffset,
            byteStride : 0,
            componentType : WebGLConstants.UNSIGNED_SHORT,
            count : length,
            min : [min],
            max : [max],
            type : 'SCALAR'
        };

        indexUint16ByteOffset += buffer.length;
        indexUInt16Buffers.push(buffer);

        return accessor;
    }

    function addIndexUInt32Array(array, min, max) {
        var length = array.length;
        buffer = Buffer.alloc(length * sizeOfUint32);
        for (var i = 0; i < length; ++i) {
            buffer.writeUInt32LE(array[i], i * sizeOfUint32);
        }
        var accessor = {
            bufferView : indexUInt32BufferViewId,
            byteOffset : indexUint32ByteOffset,
            byteStride : 0,
            componentType : WebGLConstants.UNSIGNED_INT,
            count : length,
            min : [min],
            max : [max],
            type : 'SCALAR'
        };

        indexUint32ByteOffset += buffer.length;
        indexUInt32Buffers.push(buffer);

        return accessor;
    }

    function addIndexArray(array) {
        var length = array.length;
        var min = Number.POSITIVE_INFINITY;
        var max = Number.NEGATIVE_INFINITY;
        for (var i = 0; i < length; ++i) {
            var value = array[i];
            min = Math.min(min, value);
            max = Math.max(max, value);
        }

        // Reserve the 65535 index for primitive restart
        var accessor = (max < 65535) ? addIndexUInt16Array(array, min, max) : addIndexUInt32Array(array, min, max);
        var accessorId = 'accessor_' + accessorCount++;
        gltf.accessors[accessorId] = accessor;

        return accessorId;
    }

    var gltfSceneNodes = gltf.scenes[sceneId].nodes;
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        // Add node
        var node = nodes[i];
        var nodeId = node.name;
        gltfSceneNodes.push(nodeId);
        var gltfNodeMeshes = [];
        gltf.nodes[nodeId] = {
            name : nodeId,
            meshes : gltfNodeMeshes
        };

        // Add meshes to node
        var meshes = node.meshes;
        var meshesLength = meshes.length;
        for (var j = 0; j < meshesLength; ++j) {
            var mesh = meshes[j];
            var meshId = mesh.name;
            gltfNodeMeshes.push(meshId);

            var hasPositions = mesh.positions.length > 0;
            var hasNormals = mesh.normals.length > 0;
            var hasUVs = mesh.uvs.length > 0;

            var attributes = {};
            if (hasPositions) {
                attributes.POSITION = addVertexAttribute(mesh.positions, 3);
            }
            if (hasNormals) {
                attributes.NORMAL = addVertexAttribute(mesh.normals, 3);
            }
            if (hasUVs) {
                attributes.TEXCOORD_0 = addVertexAttribute(mesh.uvs, 2);
            }

            var gltfMeshPrimitives = [];
            gltf.meshes[meshId] = {
                name : meshId,
                primitives : gltfMeshPrimitives
            };

            // Add primitives to mesh
            var primitives = mesh.primitives;
            var primitivesLength = primitives.length;
            for (var k = 0; k < primitivesLength; ++k) {
                var primitive = primitives[k];
                var indexAccessorId = addIndexArray(primitive.indices);
                var materialId = primitive.material;

                if (!defined(materialId)) {
                    // Create a default material if the primitive does not specify one
                    materialId = 'default';
                }

                var material = defaultValue(materials[materialId], {});
                var gltfMaterial = gltf.materials[materialId];
                if (defined(gltfMaterial)) {
                    // Check if this material has already been added but with incompatible shading
                    var normalShading = (gltfMaterial.extensions.KHR_materials_common.technique !== 'CONSTANT');
                    if (hasNormals !== normalShading) {
                        materialId += (hasNormals ? '_shaded' : '_constant');
                        gltfMaterial = gltf.materials[materialId];
                    }
                }

                if (!defined(gltfMaterial)) {
                    gltf.materials[materialId] = createMaterial(material, hasNormals);
                }

                gltfMeshPrimitives.push({
                    attributes : attributes,
                    indices : indexAccessorId,
                    material : materialId,
                    mode : WebGLConstants.TRIANGLES
                });
            }
        }
    }

    var vertexBuffer = Buffer.concat(vertexBuffers);
    var indexUInt16Buffer = Buffer.concat(indexUInt16Buffers);
    var indexUInt32Buffer = Buffer.concat(indexUInt32Buffers);
    var buffer = Buffer.concat([vertexBuffer, indexUInt16Buffer, indexUInt32Buffer]);

    // Buffers larger than ~192MB cannot be base64 encoded due to a NodeJS limitation. Instead save the buffer to a .bin file. Source: https://github.com/nodejs/node/issues/4266
    var bufferUri;
    var bufferPath;
    if (buffer.length > 201326580) {
        var bufferName = path.basename(gltfPath, path.extname(gltfPath));
        bufferUri = bufferName + '.bin';
        bufferPath = path.join(path.dirname(gltfPath), bufferUri);
    } else {
        bufferUri = 'data:application/octet-stream;base64,' + buffer.toString('base64');
    }

    gltf.buffers[bufferId] = {
        byteLength : buffer.byteLength,
        uri : bufferUri
    };

    gltf.bufferViews[vertexBufferViewId] = {
        buffer : bufferId,
        byteLength : vertexBuffer.length,
        byteOffset : 0,
        target : WebGLConstants.ARRAY_BUFFER
    };

    if (indexUInt16Buffer.length > 0) {
        gltf.bufferViews[indexUInt16BufferViewId] = {
            buffer : bufferId,
            byteLength : indexUInt16Buffer.length,
            byteOffset : vertexBuffer.length,
            target : WebGLConstants.ELEMENT_ARRAY_BUFFER
        };
    }

    if (indexUInt32Buffer.length > 0) {
        gltf.bufferViews[indexUInt32BufferViewId] = {
            buffer : bufferId,
            byteLength : indexUInt32Buffer.length,
            byteOffset : vertexBuffer.length + indexUInt16Buffer.length,
            target : WebGLConstants.ELEMENT_ARRAY_BUFFER
        };
    }

    if (defined(bufferPath)) {
        return fxExtraOutputFile(bufferPath, buffer)
            .then(function() {
                return gltf;
            });
    }
    return gltf;
}
