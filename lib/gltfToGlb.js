"use strict";
const Cesium = require("cesium");
const getJsonBufferPadded = require("./getJsonBufferPadded");

const defined = Cesium.defined;

module.exports = gltfToGlb;

/**
 * Convert a glTF to binary glTF.
 *
 * The glTF is expected to have a single buffer and all embedded resources stored in bufferViews.
 *
 * @param {Object} gltf The glTF asset.
 * @param {Buffer} binaryBuffer The binary buffer.
 * @returns {Buffer} The glb buffer.
 *
 * @private
 */
function gltfToGlb(gltf, binaryBuffer) {
  const buffer = gltf.buffers[0];
  if (defined(buffer.uri)) {
    binaryBuffer = Buffer.alloc(0);
  }

  // Create padded binary scene string
  const jsonBuffer = getJsonBufferPadded(gltf);

  // Allocate buffer (Global header) + (JSON chunk header) + (JSON chunk) + (Binary chunk header) + (Binary chunk)
  const glbLength = 12 + 8 + jsonBuffer.length + 8 + binaryBuffer.length;
  const glb = Buffer.alloc(glbLength);

  // Write binary glTF header (magic, version, length)
  let byteOffset = 0;
  glb.writeUInt32LE(0x46546c67, byteOffset);
  byteOffset += 4;
  glb.writeUInt32LE(2, byteOffset);
  byteOffset += 4;
  glb.writeUInt32LE(glbLength, byteOffset);
  byteOffset += 4;

  // Write JSON Chunk header (length, type)
  glb.writeUInt32LE(jsonBuffer.length, byteOffset);
  byteOffset += 4;
  glb.writeUInt32LE(0x4e4f534a, byteOffset); // JSON
  byteOffset += 4;

  // Write JSON Chunk
  jsonBuffer.copy(glb, byteOffset);
  byteOffset += jsonBuffer.length;

  // Write Binary Chunk header (length, type)
  glb.writeUInt32LE(binaryBuffer.length, byteOffset);
  byteOffset += 4;
  glb.writeUInt32LE(0x004e4942, byteOffset); // BIN
  byteOffset += 4;

  // Write Binary Chunk
  binaryBuffer.copy(glb, byteOffset);
  return glb;
}
