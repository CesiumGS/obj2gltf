'use strict';
var Cesium = require('cesium');
var path = require('path');
var Material = require('./Material');

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = createGltf;

/**
 * Create a glTF from obj data.
 *
 * @param {Object} objData Output of obj.js, containing an array of nodes containing geometry information, materials, and images.
 * @returns {Object} A glTF asset with the KHR_materials_common extension.
 *
 * @private
 */
function createGltf(objData) {
    var nodes = objData.nodes;
    var materials = objData.materials;
    var images = objData.images;
    var sceneId = 'scene';
    var samplerId = 'sampler';
    var bufferId = 'buffer';
    var vertexBufferViewId = 'bufferView_vertex';
    var indexBufferViewId = 'bufferView_index';

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
        var ambient = defaultValue(defaultValue(getTextureId(material.ambientTexture), material.ambientColor));
        var diffuse = defaultValue(defaultValue(getTextureId(material.diffuseTexture), material.diffuseColor));
        var emission = defaultValue(defaultValue(getTextureId(material.emissionTexture), material.emissionColor));
        var specular = defaultValue(defaultValue(getTextureId(material.specularTexture), material.specularColor));
        var alpha = defaultValue(defaultValue(material.alpha), 1.0);
        var shininess = defaultValue(material.specularShininess, 0.0);
        var hasSpecular = (shininess > 0.0) && (specular[0] > 0.0 || specular[1] > 0.0 || specular[2] > 0.0);

        var transparent;
        var transparency = 1.0;
        if (typeof diffuse === 'string') {
            transparency = alpha;
            transparent = images[material.diffuseTexture].transparent || (transparency < 1.0);
        } else {
            diffuse[3] = alpha;
            transparent = diffuse[3] < 1.0;
        }

        if (Array.isArray(ambient)) {
            // If ambient color is [1, 1, 1] assume it is a multiplier and instead change to [0, 0, 0]
            if (ambient[0] === 1.0 && ambient[1] === 1.0 && ambient[2] === 1.0) {
                ambient = [0.0, 0.0, 0.0, 1.0];
            }
        }

        var doubleSided = transparent;

        if (!hasNormals) {
            // Constant technique only factors in ambient and emission sources - set emission to diffuse
            emission = diffuse;
            diffuse = [0, 0, 0, 1];
        }

        var technique = hasNormals ? (hasSpecular ? 'PHONG' : 'LAMBERT') : 'CONSTANT';
        return {
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

    if (Object.keys(images).length > 0) {
        gltf.samplers[samplerId] = {
            magFilter : WebGLConstants.LINEAR,
            minFilter : WebGLConstants.LINEAR,
            wrapS : WebGLConstants.REPEAT,
            wrapT : WebGLConstants.REPEAT
        };
    }

    for (var imagePath in images) {
        if (images.hasOwnProperty(imagePath)) {
            var image = images[imagePath];
            var imageId = getImageId(imagePath);
            var textureId = getTextureId(imagePath);

            gltf.images[imageId] = {
                name : imageId,
                extras : {
                    _obj2gltf : {
                        source : image.source,
                        extension : image.extension
                    }
                }
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

    var vertexBuffers = [];
    var vertexBufferByteOffset = 0;
    var indexBuffers = [];
    var indexBufferByteOffset = 0;
    var accessorCount = 0;

    function addVertexAttribute(array, components) {
        var count = array.length / components;
        var buffer = array.toFloatBuffer();
        var minMax = array.getMinMax(components);

        var type = (components === 3 ? 'VEC3' : 'VEC2');
        var accessor = {
            bufferView : vertexBufferViewId,
            byteOffset : vertexBufferByteOffset,
            byteStride : 0,
            componentType : WebGLConstants.FLOAT,
            count : count,
            min : minMax.min,
            max : minMax.max,
            type : type
        };

        vertexBufferByteOffset += buffer.length;
        vertexBuffers.push(buffer);
        var accessorId = 'accessor_' + accessorCount++;
        gltf.accessors[accessorId] = accessor;
        return accessorId;
    }

    function addIndexArray(array, uint32Indices) {
        var buffer = uint32Indices ? array.toUint32Buffer() : array.toUint16Buffer();
        var componentType = uint32Indices ? WebGLConstants.UNSIGNED_INT : WebGLConstants.UNSIGNED_SHORT;
        var length = array.length;
        var minMax = array.getMinMax(1);
        var accessor = {
            bufferView : indexBufferViewId,
            byteOffset : indexBufferByteOffset,
            byteStride : 0,
            componentType : componentType,
            count : length,
            min : minMax.min,
            max : minMax.max,
            type : 'SCALAR'
        };

        indexBufferByteOffset += buffer.length;
        indexBuffers.push(buffer);

        var accessorId = 'accessor_' + accessorCount++;
        gltf.accessors[accessorId] = accessor;
        return accessorId;
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

    var uint32Indices = requiresUint32Indices(nodes);
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

            // Unload resources
            mesh.positions = undefined;
            mesh.normals = undefined;
            mesh.uvs = undefined;

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
                var indexAccessorId = addIndexArray(primitive.indices, uint32Indices);
                primitive.indices = undefined; // Unload resources
                var materialId = primitive.material;

                if (!defined(materialId)) {
                    // Create a default material if the primitive does not specify one
                    materialId = 'default';
                }

                var material = materials[materialId];
                material = defined(material) ? material : new Material();
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

    var buffers = [];
    buffers = buffers.concat(vertexBuffers, indexBuffers);
    var buffer = Buffer.concat(buffers);

    gltf.buffers[bufferId] = {
        byteLength : buffer.byteLength,
        extras : {
            _obj2gltf : {
                source : buffer
            }
        }
    };

    gltf.bufferViews[vertexBufferViewId] = {
        buffer : bufferId,
        byteLength : vertexBufferByteOffset,
        byteOffset : 0,
        target : WebGLConstants.ARRAY_BUFFER
    };

    gltf.bufferViews[indexBufferViewId] = {
        buffer : bufferId,
        byteLength : indexBufferByteOffset,
        byteOffset : vertexBufferByteOffset,
        target : WebGLConstants.ELEMENT_ARRAY_BUFFER
    };

    return gltf;
}
