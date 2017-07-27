'use strict';
var Cesium = require('cesium');
var getJsonBufferPadded = require('./getJsonBufferPadded');

var isDataUri = Cesium.isDataUri;

module.exports = gltfToGlb;

/**
 * Convert a glTF to binary glTF.
 *
 * The glTF is expected to have all resources embedded as bufferViews and a single buffer whose content is stored in a data uri.
 *
 * @param {Object} gltf A javascript object containing a glTF asset.
 * @returns {Promise} A promise that resolves to a buffer containing the binary glTF.
 *
 * @private
 */
function gltfToGlb(gltf) {
    var buffer = gltf.buffers[0];
    var binaryBuffer;
    if (isDataUri(buffer.uri)) {
        binaryBuffer = dataUriToBuffer(buffer.uri);
        delete buffer.uri;
    } else {
        binaryBuffer = Buffer.alloc(0);
    }

    // Create padded binary scene string
    var jsonBuffer = getJsonBufferPadded(gltf);

    // Allocate buffer (Global header) + (JSON chunk header) + (JSON chunk) + (Binary chunk header) + (Binary chunk)
    var glbLength = 12 + 8 + jsonBuffer.length + 8 + binaryBuffer.length;
    var glb = Buffer.alloc(glbLength);

    // Write binary glTF header (magic, version, length)
    var byteOffset = 0;
    glb.writeUInt32LE(0x46546C67, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(2, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(glbLength, byteOffset);
    byteOffset += 4;

    // Write JSON Chunk header (length, type)
    glb.writeUInt32LE(jsonBuffer.length, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(0x4E4F534A, byteOffset); // JSON
    byteOffset += 4;

    // Write JSON Chunk
    jsonBuffer.copy(glb, byteOffset);
    byteOffset += jsonBuffer.length;

    // Write Binary Chunk header (length, type)
    glb.writeUInt32LE(binaryBuffer.length, byteOffset);
    byteOffset += 4;
    glb.writeUInt32LE(0x004E4942, byteOffset); // BIN
    byteOffset += 4;

    // Write Binary Chunk
    binaryBuffer.copy(glb, byteOffset);
    return glb;
}

function dataUriToBuffer(dataUri) {
    var data = dataUri.slice(dataUri.indexOf(','));
    return Buffer.from(data, 'base64');
}
