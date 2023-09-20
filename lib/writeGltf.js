"use strict";
const Cesium = require("cesium");
const mime = require("mime");
const PNG = require("pngjs").PNG;
const Promise = require("bluebird");
const getBufferPadded = require("./getBufferPadded");
const gltfToGlb = require("./gltfToGlb");

const defined = Cesium.defined;
const RuntimeError = Cesium.RuntimeError;

module.exports = writeGltf;

/**
 * Write glTF resources as embedded data uris or external files.
 *
 * @param {Object} gltf The glTF asset.
 * @param {Object} options The options object passed along from lib/obj2gltf.js
 * @returns {Promise} A promise that resolves to the glTF JSON or glb buffer.
 *
 * @private
 */
function writeGltf(gltf, options) {
  return encodeTextures(gltf).then(function () {
    const binary = options.binary;
    const separate = options.separate;
    const separateTextures = options.separateTextures;

    const promises = [];
    if (separateTextures) {
      promises.push(writeSeparateTextures(gltf, options));
    } else {
      writeEmbeddedTextures(gltf);
    }

    if (separate) {
      promises.push(writeSeparateBuffers(gltf, options));
    } else if (!binary) {
      writeEmbeddedBuffers(gltf);
    }

    const binaryBuffer = gltf.buffers[0].extras._obj2gltf.source;

    return Promise.all(promises).then(function () {
      deleteExtras(gltf);
      removeEmpty(gltf);
      if (binary) {
        return gltfToGlb(gltf, binaryBuffer);
      }
      return gltf;
    });
  });
}

function encodePng(texture) {
  // Constants defined by pngjs
  const rgbColorType = 2;
  const rgbaColorType = 6;

  const png = new PNG({
    width: texture.width,
    height: texture.height,
    colorType: texture.transparent ? rgbaColorType : rgbColorType,
    inputColorType: rgbaColorType,
    inputHasAlpha: true,
  });

  png.data = texture.pixels;

  return new Promise(function (resolve, reject) {
    const chunks = [];
    const stream = png.pack();
    stream.on("data", function (chunk) {
      chunks.push(chunk);
    });
    stream.on("end", function () {
      resolve(Buffer.concat(chunks));
    });
    stream.on("error", reject);
  });
}

function encodeTexture(texture) {
  if (
    !defined(texture.source) &&
    defined(texture.pixels) &&
    texture.extension === ".png"
  ) {
    return encodePng(texture).then(function (encoded) {
      texture.source = encoded;
    });
  }
}

function encodeTextures(gltf) {
  // Dynamically generated PBR textures need to be encoded to png prior to being saved
  const encodePromises = [];
  const images = gltf.images;
  const length = images.length;
  for (let i = 0; i < length; ++i) {
    encodePromises.push(encodeTexture(images[i].extras._obj2gltf));
  }
  return Promise.all(encodePromises);
}

function deleteExtras(gltf) {
  const buffers = gltf.buffers;
  const buffersLength = buffers.length;
  for (let i = 0; i < buffersLength; ++i) {
    delete buffers[i].extras;
  }

  const images = gltf.images;
  const imagesLength = images.length;
  for (let i = 0; i < imagesLength; ++i) {
    delete images[i].extras;
  }
}

function removeEmpty(json) {
  Object.keys(json).forEach(function (key) {
    if (
      !defined(json[key]) ||
      (Array.isArray(json[key]) && json[key].length === 0)
    ) {
      delete json[key]; // Delete values that are undefined or []
    } else if (typeof json[key] === "object") {
      removeEmpty(json[key]);
    }
  });
}

function writeSeparateBuffers(gltf, options) {
  const buffers = gltf.buffers;
  return Promise.map(
    buffers,
    function (buffer) {
      const source = buffer.extras._obj2gltf.source;
      const bufferUri = `${buffer.name}.bin`;
      buffer.uri = bufferUri;
      return options.writer(bufferUri, source);
    },
    { concurrency: 10 }
  );
}

function writeSeparateTextures(gltf, options) {
  const images = gltf.images;
  return Promise.map(
    images,
    function (image) {
      const texture = image.extras._obj2gltf;
      const imageUri = image.name + texture.extension;
      image.uri = imageUri;
      return options.writer(imageUri, texture.source);
    },
    { concurrency: 10 }
  );
}

function writeEmbeddedBuffers(gltf) {
  const buffersLength = gltf.buffers.length;
  for (let i = 0; i < buffersLength; ++i) {
    const buffer = gltf.buffers[i];
    const source = buffer.extras._obj2gltf.source;

    // Buffers larger than ~192MB cannot be base64 encoded due to a NodeJS limitation. Source: https://github.com/nodejs/node/issues/4266
    if (source.length > 201326580) {
      throw new RuntimeError(
        "Buffer is too large to embed in the glTF. Use the --separate flag instead."
      );
    }

    buffer.uri = `data:application/octet-stream;base64,${source.toString(
      "base64"
    )}`;
  }
}

function writeEmbeddedTextures(gltf) {
  const buffer = gltf.buffers[0];
  const bufferExtras = buffer.extras._obj2gltf;
  const bufferSource = bufferExtras.source;
  const images = gltf.images;
  const imagesLength = images.length;
  const sources = [bufferSource];
  let byteOffset = bufferSource.length;

  for (let i = 0; i < imagesLength; ++i) {
    const image = images[i];
    const texture = image.extras._obj2gltf;
    const textureSource = texture.source;
    const textureByteLength = textureSource.length;

    image.mimeType = mime.getType(texture.extension);
    image.bufferView = gltf.bufferViews.length;
    gltf.bufferViews.push({
      buffer: 0,
      byteOffset: byteOffset,
      byteLength: textureByteLength,
    });
    byteOffset += textureByteLength;
    sources.push(textureSource);
  }

  const source = getBufferPadded(Buffer.concat(sources));
  bufferExtras.source = source;
  buffer.byteLength = source.length;
}
