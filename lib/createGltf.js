'use strict';
const BUFFER_MAX_BYTE_LENGTH = require('buffer').constants.MAX_LENGTH;
const Cesium = require('cesium');
const getBufferPadded = require('./getBufferPadded');
const getDefaultMaterial = require('./loadMtl').getDefaultMaterial;
const Texture = require('./Texture');

const defaultValue = Cesium.defaultValue;
const defined = Cesium.defined;
const WebGLConstants = Cesium.WebGLConstants;

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
    const nodes = objData.nodes;
    let materials = objData.materials;
    const name = objData.name;

    // Split materials used by primitives with different types of attributes
    materials = splitIncompatibleMaterials(nodes, materials, options);

    const gltf = {
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

    const bufferState = {
        positionBuffers : [],
        normalBuffers : [],
        uvBuffers : [],
        indexBuffers : [],
        positionAccessors : [],
        normalAccessors : [],
        uvAccessors : [],
        indexAccessors : []
    };

    const uint32Indices = requiresUint32Indices(nodes);

    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        const node = nodes[i];
        const meshes = node.meshes;
        const meshesLength = meshes.length;

        if (meshesLength === 1) {
            const meshIndex = addMesh(gltf, materials, bufferState, uint32Indices, meshes[0], options);
            addNode(gltf, node.name, meshIndex, undefined);
        } else {
            // Add meshes as child nodes
            const parentIndex = addNode(gltf, node.name);
            for (let j = 0; j < meshesLength; ++j) {
                const mesh = meshes[j];
                const meshIndex = addMesh(gltf, materials, bufferState, uint32Indices, mesh, options);
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

    addBuffers(gltf, bufferState, name, options.separate);

    if (options.specularGlossiness) {
        gltf.extensionsUsed.push('KHR_materials_pbrSpecularGlossiness');
        gltf.extensionsRequired.push('KHR_materials_pbrSpecularGlossiness');
    }

    if (options.unlit) {
        gltf.extensionsUsed.push('KHR_materials_unlit');
        gltf.extensionsRequired.push('KHR_materials_unlit');
    }

    return gltf;
}

function addCombinedBufferView(gltf, buffers, accessors, byteStride, target) {
    const length = buffers.length;
    if (length === 0) {
        return;
    }
    const bufferViewIndex = gltf.bufferViews.length;
    const previousBufferView = gltf.bufferViews[bufferViewIndex - 1];
    const byteOffset = defined(previousBufferView) ? previousBufferView.byteOffset + previousBufferView.byteLength : 0;
    let byteLength = 0;
    for (let i = 0; i < length; ++i) {
        const accessor = gltf.accessors[accessors[i]];
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

function addCombinedBuffers(gltf, bufferState, name) {
    addCombinedBufferView(gltf, bufferState.positionBuffers, bufferState.positionAccessors, 12, WebGLConstants.ARRAY_BUFFER);
    addCombinedBufferView(gltf, bufferState.normalBuffers, bufferState.normalAccessors, 12, WebGLConstants.ARRAY_BUFFER);
    addCombinedBufferView(gltf, bufferState.uvBuffers, bufferState.uvAccessors, 8, WebGLConstants.ARRAY_BUFFER);
    addCombinedBufferView(gltf, bufferState.indexBuffers, bufferState.indexAccessors, undefined, WebGLConstants.ELEMENT_ARRAY_BUFFER);

    let buffers = [];
    buffers = buffers.concat(bufferState.positionBuffers, bufferState.normalBuffers, bufferState.uvBuffers, bufferState.indexBuffers);
    const buffer = getBufferPadded(Buffer.concat(buffers));

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

function addSeparateBufferView(gltf, buffer, accessor, byteStride, target, name) {
    const bufferIndex = gltf.buffers.length;
    const bufferViewIndex = gltf.bufferViews.length;

    gltf.buffers.push({
        name : name + '_' + bufferIndex,
        byteLength : buffer.length,
        extras : {
            _obj2gltf : {
                source : buffer
            }
        }
    });

    gltf.bufferViews.push({
        buffer : bufferIndex,
        byteLength : buffer.length,
        byteOffset : 0,
        byteStride : byteStride,
        target : target
    });

    gltf.accessors[accessor].bufferView = bufferViewIndex;
    gltf.accessors[accessor].byteOffset = 0;
}

function addSeparateBufferViews(gltf, buffers, accessors, byteStride, target, name) {
    const length = buffers.length;
    for (let i = 0; i < length; ++i) {
        addSeparateBufferView(gltf, buffers[i], accessors[i], byteStride, target, name);
    }
}

function addSeparateBuffers(gltf, bufferState, name) {
    addSeparateBufferViews(gltf, bufferState.positionBuffers, bufferState.positionAccessors, 12, WebGLConstants.ARRAY_BUFFER, name);
    addSeparateBufferViews(gltf, bufferState.normalBuffers, bufferState.normalAccessors, 12, WebGLConstants.ARRAY_BUFFER, name);
    addSeparateBufferViews(gltf, bufferState.uvBuffers, bufferState.uvAccessors, 8, WebGLConstants.ARRAY_BUFFER, name);
    addSeparateBufferViews(gltf, bufferState.indexBuffers, bufferState.indexAccessors, undefined, WebGLConstants.ELEMENT_ARRAY_BUFFER, name);
}

function addBuffers(gltf, bufferState, name, separate) {
    const buffers = bufferState.positionBuffers.concat(bufferState.normalBuffers, bufferState.uvBuffers, bufferState.indexBuffers);
    const buffersLength = buffers.length;
    let buffersByteLength = 0;
    for (let i = 0; i < buffersLength; ++i) {
        buffersByteLength += buffers[i].length;
    }

    if (separate && (buffersByteLength > createGltf._getBufferMaxByteLength())) {
        // Don't combine buffers if the combined buffer will exceed the Node limit.
        addSeparateBuffers(gltf, bufferState, name);
    } else {
        addCombinedBuffers(gltf, bufferState, name);
    }
}

function addTexture(gltf, texture) {
    const imageName = texture.name;
    const textureName = texture.name;
    const imageIndex = gltf.images.length;
    const textureIndex = gltf.textures.length;

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
    let textureIndex;
    const name = texture.name;
    const textures = gltf.textures;
    const length = textures.length;
    for (let i = 0; i < length; ++i) {
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
        const length = material.length;
        const clonedArray = new Array(length);
        for (let i = 0; i < length; ++i) {
            clonedArray[i] = cloneMaterial(material[i], removeTextures);
        }
        return clonedArray;
    }
    const clonedObject = {};
    for (const name in material) {
        if (material.hasOwnProperty(name)) {
            clonedObject[name] = cloneMaterial(material[name], removeTextures);
        }
    }
    return clonedObject;
}

function resolveTextures(gltf, material) {
    for (const name in material) {
        if (material.hasOwnProperty(name)) {
            const property = material[name];
            if (property instanceof Texture) {
                material[name] = getTexture(gltf, property);
            } else if (!Array.isArray(property) && (typeof property === 'object')) {
                resolveTextures(gltf, property);
            }
        }
    }
}

function addGltfMaterial(gltf, material, options) {
    resolveTextures(gltf, material);
    const materialIndex = gltf.materials.length;
    if (options.unlit) {
        if (!defined(material.extensions)) {
            material.extensions = {};
        }
        material.extensions.KHR_materials_unlit = {};
    }
    gltf.materials.push(material);
    return materialIndex;
}

function getMaterialByName(materials, materialName) {
    const materialsLength = materials.length;
    for (let i = 0; i < materialsLength; ++i) {
        if (materials[i].name === materialName) {
            return materials[i];
        }
    }
}

function getMaterialIndex(materials, materialName) {
    const materialsLength = materials.length;
    for (let i = 0; i < materialsLength; ++i) {
        if (materials[i].name === materialName) {
            return i;
        }
    }
}

function getOrCreateGltfMaterial(gltf, materials, materialName, options) {
    const material = getMaterialByName(materials, materialName);
    let materialIndex = getMaterialIndex(gltf.materials, materialName);

    if (!defined(materialIndex)) {
        materialIndex = addGltfMaterial(gltf, material, options);
    }

    return materialIndex;
}

function primitiveInfoMatch(a, b) {
    return a.hasUvs === b.hasUvs &&
           a.hasNormals === b.hasNormals;
}

function getSplitMaterialName(originalMaterialName, primitiveInfo, primitiveInfoByMaterial) {
    let splitMaterialName = originalMaterialName;
    let suffix = 2;
    while (defined(primitiveInfoByMaterial[splitMaterialName])) {
        if (primitiveInfoMatch(primitiveInfo, primitiveInfoByMaterial[splitMaterialName])) {
            break;
        }
        splitMaterialName = originalMaterialName + '-' + suffix++;
    }
    return splitMaterialName;
}

function splitIncompatibleMaterials(nodes, materials, options) {
    const splitMaterials = [];
    const primitiveInfoByMaterial = {};
    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        const meshes = nodes[i].meshes;
        const meshesLength = meshes.length;
        for (let j = 0; j < meshesLength; ++j) {
            const primitives = meshes[j].primitives;
            const primitivesLength = primitives.length;
            for (let k = 0; k < primitivesLength; ++k) {
                const primitive = primitives[k];
                const hasUvs = primitive.uvs.length > 0;
                const hasNormals = primitive.normals.length > 0;
                const primitiveInfo = {
                    hasUvs : hasUvs,
                    hasNormals :  hasNormals
                };
                const originalMaterialName = defaultValue(primitive.material, 'default');
                const splitMaterialName = getSplitMaterialName(originalMaterialName, primitiveInfo, primitiveInfoByMaterial);
                primitive.material = splitMaterialName;
                primitiveInfoByMaterial[splitMaterialName] = primitiveInfo;

                let splitMaterial = getMaterialByName(splitMaterials, splitMaterialName);
                if (defined(splitMaterial)) {
                    continue;
                }

                const originalMaterial = getMaterialByName(materials, originalMaterialName);
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
    const count = array.length / components;
    const minMax = array.getMinMax(components);
    const type = (components === 3 ? 'VEC3' : 'VEC2');

    const accessor = {
        name : name,
        componentType : WebGLConstants.FLOAT,
        count : count,
        min : minMax.min,
        max : minMax.max,
        type : type
    };

    const accessorIndex = gltf.accessors.length;
    gltf.accessors.push(accessor);
    return accessorIndex;
}

function addIndexArray(gltf, array, uint32Indices, name) {
    const componentType = uint32Indices ? WebGLConstants.UNSIGNED_INT : WebGLConstants.UNSIGNED_SHORT;
    const count = array.length;
    const minMax = array.getMinMax(1);

    const accessor = {
        name : name,
        componentType : componentType,
        count : count,
        min : minMax.min,
        max : minMax.max,
        type : 'SCALAR'
    };

    const accessorIndex = gltf.accessors.length;
    gltf.accessors.push(accessor);
    return accessorIndex;
}

function requiresUint32Indices(nodes) {
    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        const meshes = nodes[i].meshes;
        const meshesLength = meshes.length;
        for (let j = 0; j < meshesLength; ++j) {
            const primitives = meshes[j].primitives;
            const primitivesLength = primitives.length;
            for (let k = 0; k < primitivesLength; ++k) {
                // Reserve the 65535 index for primitive restart
                const vertexCount = primitives[k].positions.length / 3;
                if (vertexCount > 65534) {
                    return true;
                }
            }
        }
    }
    return false;
}

function addPrimitive(gltf, materials, bufferState, uint32Indices, mesh, primitive, index, options) {
    const hasPositions = primitive.positions.length > 0;
    const hasNormals = primitive.normals.length > 0;
    const hasUVs = primitive.uvs.length > 0;

    const attributes = {};
    if (hasPositions) {
        const accessorIndex = addVertexAttribute(gltf, primitive.positions, 3, mesh.name + '_' + index + '_positions');
        attributes.POSITION = accessorIndex;
        bufferState.positionBuffers.push(primitive.positions.toFloatBuffer());
        bufferState.positionAccessors.push(accessorIndex);
    }
    if (hasNormals) {
        const accessorIndex = addVertexAttribute(gltf, primitive.normals, 3, mesh.name + '_' + index + '_normals');
        attributes.NORMAL = accessorIndex;
        bufferState.normalBuffers.push(primitive.normals.toFloatBuffer());
        bufferState.normalAccessors.push(accessorIndex);
    }
    if (hasUVs) {
        const accessorIndex = addVertexAttribute(gltf, primitive.uvs, 2, mesh.name + '_' + index + '_texcoords');
        attributes.TEXCOORD_0 = accessorIndex;
        bufferState.uvBuffers.push(primitive.uvs.toFloatBuffer());
        bufferState.uvAccessors.push(accessorIndex);
    }

    const indexAccessorIndex = addIndexArray(gltf, primitive.indices, uint32Indices, mesh.name + '_' + index + '_indices');
    const indexBuffer = uint32Indices ? primitive.indices.toUint32Buffer() : primitive.indices.toUint16Buffer();
    bufferState.indexBuffers.push(indexBuffer);
    bufferState.indexAccessors.push(indexAccessorIndex);

    // Unload resources
    primitive.positions = undefined;
    primitive.normals = undefined;
    primitive.uvs = undefined;
    primitive.indices = undefined;

    const materialIndex = getOrCreateGltfMaterial(gltf, materials, primitive.material, options);

    return {
        attributes : attributes,
        indices : indexAccessorIndex,
        material : materialIndex,
        mode : WebGLConstants.TRIANGLES
    };
}

function addMesh(gltf, materials, bufferState, uint32Indices, mesh, options) {
    const gltfPrimitives = [];
    const primitives = mesh.primitives;
    const primitivesLength = primitives.length;
    for (let i = 0; i < primitivesLength; ++i) {
        gltfPrimitives.push(addPrimitive(gltf, materials, bufferState, uint32Indices, mesh, primitives[i], i, options));
    }

    const gltfMesh = {
        name : mesh.name,
        primitives : gltfPrimitives
    };

    const meshIndex = gltf.meshes.length;
    gltf.meshes.push(gltfMesh);
    return meshIndex;
}

function addNode(gltf, name, meshIndex, parentIndex) {
    const node = {
        name : name,
        mesh : meshIndex
    };

    const nodeIndex = gltf.nodes.length;
    gltf.nodes.push(node);

    if (defined(parentIndex)) {
        const parentNode = gltf.nodes[parentIndex];
        if (!defined(parentNode.children)) {
            parentNode.children = [];
        }
        parentNode.children.push(nodeIndex);
    } else {
        gltf.scenes[gltf.scene].nodes.push(nodeIndex);
    }

    return nodeIndex;
}

// Exposed for testing
createGltf._getBufferMaxByteLength = function() {
    return BUFFER_MAX_BYTE_LENGTH;
};
