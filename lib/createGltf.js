'use strict';
var Cesium = require('cesium');
var getBufferPadded = require('./getBufferPadded');
var getDefaultMaterial = require('./loadMtl').getDefaultMaterial;
var Texture = require('./Texture');

var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = createGltf;

/**
 * Create a glTF from obj data.
 *
 * @param {Object} objData An object containing an array of nodes containing geometry information and an array of materials.
 * @param {Object} options The options object passed along from lib/obj2gltf.js
 * @returns {Object} A glTF asset.
 *
 * @private
 */
function createGltf(objData, options) {
    var nodes = objData.nodes;
    var materials = objData.materials;
    var name = objData.name;

    // Split materials used by primitives with different types of attributes
    materials = splitIncompatibleMaterials(nodes, materials, options);

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
            meshIndex = addMesh(gltf, materials, bufferState, uint32Indices, meshes[0]);
            addNode(gltf, node.name, meshIndex, undefined);
        } else {
            // Add meshes as child nodes
            var parentIndex = addNode(gltf, node.name);
            for (var j = 0; j < meshesLength; ++j) {
                var mesh = meshes[j];
                meshIndex = addMesh(gltf, materials, bufferState, uint32Indices, mesh);
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

    addBuffers(gltf, bufferState, name);

    if (options.specularGlossiness) {
        gltf.extensionsUsed.push('KHR_materials_pbrSpecularGlossiness');
        gltf.extensionsRequired.push('KHR_materials_pbrSpecularGlossiness');
    } else if (options.materialsCommon) {
        gltf.extensionsUsed.push('KHR_materials_common');
        gltf.extensionsRequired.push('KHR_materials_common');
    }

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

function addBuffers(gltf, bufferState, name) {
    addBufferView(gltf, bufferState.positionBuffers, bufferState.positionAccessors, 12, WebGLConstants.ARRAY_BUFFER);
    addBufferView(gltf, bufferState.normalBuffers, bufferState.normalAccessors, 12, WebGLConstants.ARRAY_BUFFER);
    addBufferView(gltf, bufferState.uvBuffers, bufferState.uvAccessors, 8, WebGLConstants.ARRAY_BUFFER);
    addBufferView(gltf, bufferState.indexBuffers, bufferState.indexAccessors, undefined, WebGLConstants.ELEMENT_ARRAY_BUFFER);

    var buffers = [];
    buffers = buffers.concat(bufferState.positionBuffers, bufferState.normalBuffers, bufferState.uvBuffers, bufferState.indexBuffers);
    var buffer = getBufferPadded(Buffer.concat(buffers));

    gltf.buffers.push({
        name : name,
        byteLength : buffer.length,
        extras : {
            _obj2gltf : {
                source : buffer
            }
        }
    });
}

function addTexture(gltf, texture) {
    var imageName = texture.name;
    var textureName = texture.name;
    var imageIndex = gltf.images.length;
    var textureIndex = gltf.textures.length;

    gltf.images.push({
        name : imageName,
        extras : {
            _obj2gltf : texture
        }
    });

    gltf.textures.push({
        name : textureName,
        sampler : 0,
        source : imageIndex
    });

    return textureIndex;
}

function getTexture(gltf, texture) {
    var textureIndex;
    var name = texture.name;
    var textures = gltf.textures;
    var length = textures.length;
    for (var i = 0; i < length; ++i) {
        if (textures[i].name === name) {
            textureIndex = i;
            break;
        }
    }

    if (!defined(textureIndex)) {
        textureIndex = addTexture(gltf, texture);
    }

    return {
        index : textureIndex
    };
}

function cloneMaterial(material, removeTextures) {
    if (typeof material !== 'object') {
        return material;
    } else if (material instanceof Texture) {
        if (removeTextures) {
            return undefined;
        }
        return material;
    } else if (Array.isArray(material)) {
        var length = material.length;
        var clonedArray = new Array(length);
        for (var i = 0; i < length; ++i) {
            clonedArray[i] = cloneMaterial(material[i], removeTextures);
        }
        return clonedArray;
    }
    var clonedObject = {};
    for (var name in material) {
        if (material.hasOwnProperty(name)) {
            clonedObject[name] = cloneMaterial(material[name], removeTextures);
        }
    }
    return clonedObject;
}

function resolveTextures(gltf, material) {
    for (var name in material) {
        if (material.hasOwnProperty(name)) {
            var property = material[name];
            if (property instanceof Texture) {
                material[name] = getTexture(gltf, property);
            } else if (!Array.isArray(property) && (typeof property === 'object')) {
                resolveTextures(gltf, property);
            }
        }
    }
}

function addGltfMaterial(gltf, material) {
    resolveTextures(gltf, material);
    var materialIndex = gltf.materials.length;
    gltf.materials.push(material);
    return materialIndex;
}

function getMaterialByName(materials, materialName) {
    var materialsLength = materials.length;
    for (var i = 0; i < materialsLength; ++i) {
        if (materials[i].name === materialName) {
            return materials[i];
        }
    }
}

function getMaterialIndex(materials, materialName) {
    var materialsLength = materials.length;
    for (var i = 0; i < materialsLength; ++i) {
        if (materials[i].name === materialName) {
            return i;
        }
    }
}

function getOrCreateGltfMaterial(gltf, materials, materialName) {
    var material = getMaterialByName(materials, materialName);
    var materialIndex = getMaterialIndex(gltf.materials, materialName);

    if (!defined(materialIndex)) {
        materialIndex = addGltfMaterial(gltf, material);
    }

    return materialIndex;
}

function primitiveInfoMatch(a, b) {
    return a.hasUvs === b.hasUvs &&
           a.hasNormals === b.hasNormals;
}

function getSplitMaterialName(originalMaterialName, primitiveInfo, primitiveInfoByMaterial) {
    var splitMaterialName = originalMaterialName;
    var suffix = 2;
    while (defined(primitiveInfoByMaterial[splitMaterialName])) {
        if (primitiveInfoMatch(primitiveInfo, primitiveInfoByMaterial[splitMaterialName])) {
            break;
        }
        splitMaterialName = originalMaterialName + '-' + suffix++;
    }
    return splitMaterialName;
}

function splitIncompatibleMaterials(nodes, materials, options) {
    var splitMaterials = [];
    var primitiveInfoByMaterial = {};
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        var meshes = nodes[i].meshes;
        var meshesLength = meshes.length;
        for (var j = 0; j < meshesLength; ++j) {
            var primitives = meshes[j].primitives;
            var primitivesLength = primitives.length;
            for (var k = 0; k < primitivesLength; ++k) {
                var primitive = primitives[k];
                var hasUvs = primitive.uvs.length > 0;
                var hasNormals = primitive.normals.length > 0;
                var primitiveInfo = {
                    hasUvs : hasUvs,
                    hasNormals :  hasNormals
                };
                var originalMaterialName = defaultValue(primitive.material, 'default');
                var splitMaterialName = getSplitMaterialName(originalMaterialName, primitiveInfo, primitiveInfoByMaterial);
                primitive.material = splitMaterialName;
                primitiveInfoByMaterial[splitMaterialName] = primitiveInfo;

                var splitMaterial = getMaterialByName(splitMaterials, splitMaterialName);
                if (defined(splitMaterial)) {
                    continue;
                }

                var originalMaterial = getMaterialByName(materials, originalMaterialName);
                if (defined(originalMaterial)) {
                    splitMaterial = cloneMaterial(originalMaterial, !hasUvs);
                } else {
                    splitMaterial = getDefaultMaterial(options);
                }
                splitMaterial.name = splitMaterialName;
                splitMaterials.push(splitMaterial);
            }
        }
    }
    return splitMaterials;
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
            var primitives = meshes[j].primitives;
            var primitivesLength = primitives.length;
            for (var k = 0; k < primitivesLength; ++k) {
                // Reserve the 65535 index for primitive restart
                var vertexCount = primitives[k].positions.length / 3;
                if (vertexCount > 65534) {
                    return true;
                }
            }
        }
    }
    return false;
}

function addPrimitive(gltf, materials, bufferState, uint32Indices, mesh, primitive, index) {
    var hasPositions = primitive.positions.length > 0;
    var hasNormals = primitive.normals.length > 0;
    var hasUVs = primitive.uvs.length > 0;

    var accessorIndex;
    var attributes = {};
    if (hasPositions) {
        accessorIndex = addVertexAttribute(gltf, primitive.positions, 3, mesh.name + '_' + index + '_positions');
        attributes.POSITION = accessorIndex;
        bufferState.positionBuffers.push(primitive.positions.toFloatBuffer());
        bufferState.positionAccessors.push(accessorIndex);
    }
    if (hasNormals) {
        accessorIndex = addVertexAttribute(gltf, primitive.normals, 3, mesh.name + '_' + index + '_normals');
        attributes.NORMAL = accessorIndex;
        bufferState.normalBuffers.push(primitive.normals.toFloatBuffer());
        bufferState.normalAccessors.push(accessorIndex);
    }
    if (hasUVs) {
        accessorIndex = addVertexAttribute(gltf, primitive.uvs, 2, mesh.name + '_' + index + '_texcoords');
        attributes.TEXCOORD_0 = accessorIndex;
        bufferState.uvBuffers.push(primitive.uvs.toFloatBuffer());
        bufferState.uvAccessors.push(accessorIndex);
    }

    var indexAccessorIndex = addIndexArray(gltf, primitive.indices, uint32Indices, mesh.name + '_' + index + '_indices');
    var indexBuffer = uint32Indices ? primitive.indices.toUint32Buffer() : primitive.indices.toUint16Buffer();
    bufferState.indexBuffers.push(indexBuffer);
    bufferState.indexAccessors.push(indexAccessorIndex);

    // Unload resources
    primitive.positions = undefined;
    primitive.normals = undefined;
    primitive.uvs = undefined;
    primitive.indices = undefined;

    var materialIndex = getOrCreateGltfMaterial(gltf, materials, primitive.material);

    return {
        attributes : attributes,
        indices : indexAccessorIndex,
        material : materialIndex,
        mode : WebGLConstants.TRIANGLES
    };
}

function addMesh(gltf, materials, bufferState, uint32Indices, mesh) {
    var gltfPrimitives = [];
    var primitives = mesh.primitives;
    var primitivesLength = primitives.length;
    for (var i = 0; i < primitivesLength; ++i) {
        gltfPrimitives.push(addPrimitive(gltf, materials, bufferState, uint32Indices, mesh, primitives[i], i));
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
