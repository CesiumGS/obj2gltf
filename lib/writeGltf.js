'use strict';
var Cesium = require('cesium');
var mime = require('mime');
var PNG = require('pngjs').PNG;
var Promise = require('bluebird');
var getBufferPadded = require('./getBufferPadded');
var gltfToGlb = require('./gltfToGlb');

var defined = Cesium.defined;
var RuntimeError = Cesium.RuntimeError;

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
    return encodeTextures(gltf)
        .then(function() {
            var binary = options.binary;
            var separate = options.separate;
            var separateTextures = options.separateTextures;

            var promises = [];
            if (separateTextures) {
                promises.push(writeSeparateTextures(gltf, options));
            } else {
                writeEmbeddedTextures(gltf);
            }

            if (separate) {
                promises.push(writeSeparateBuffer(gltf, options));
            } else if (!binary) {
                writeEmbeddedBuffer(gltf);
            }

            var binaryBuffer = gltf.buffers[0].extras._obj2gltf.source;

            return Promise.all(promises)
                .then(function() {
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
    var rgbColorType = 2;
    var rgbaColorType = 6;

    var png = new PNG({
        width : texture.width,
        height : texture.height,
        colorType : texture.transparent ? rgbaColorType : rgbColorType,
        inputColorType : rgbaColorType,
        inputHasAlpha : true
    });

    png.data = texture.pixels;

    return new Promise(function(resolve, reject) {
        var chunks = [];
        var stream = png.pack();
        stream.on('data', function(chunk) {
            chunks.push(chunk);
        });
        stream.on('end', function() {
            resolve(Buffer.concat(chunks));
        });
        stream.on('error', reject);
    });
}

function encodeTexture(texture) {
    if (!defined(texture.source) && defined(texture.pixels) && texture.extension === '.png') {
        return encodePng(texture)
            .then(function(encoded) {
                texture.source = encoded;
            });
    }
}

function encodeTextures(gltf) {
    // Dynamically generated PBR textures need to be encoded to png prior to being saved
    var encodePromises = [];
    var images = gltf.images;
    var length = images.length;
    for (var i = 0; i < length; ++i) {
        encodePromises.push(encodeTexture(images[i].extras._obj2gltf));
    }
    return Promise.all(encodePromises);
}

function deleteExtras(gltf) {
    var buffer = gltf.buffers[0];
    delete buffer.extras;

    var images = gltf.images;
    var imagesLength = images.length;
    for (var i = 0; i < imagesLength; ++i) {
        delete images[i].extras;
    }
}

function removeEmpty(json) {
    Object.keys(json).forEach(function(key) {
        if (!defined(json[key]) || (Array.isArray(json[key]) && json[key].length === 0)) {
            delete json[key]; // Delete values that are undefined or []
        } else if (typeof json[key] === 'object') {
            removeEmpty(json[key]);
        }
    });
}

function writeSeparateBuffer(gltf, options) {
    var buffer = gltf.buffers[0];
    var source = buffer.extras._obj2gltf.source;
    var bufferUri = buffer.name + '.bin';
    buffer.uri = bufferUri;
    return options.writer(bufferUri, source);
}

function writeSeparateTextures(gltf, options) {
    var images = gltf.images;
    return Promise.map(images, function(image) {
        var texture = image.extras._obj2gltf;
        var imageUri = image.name + texture.extension;
        image.uri = imageUri;
        return options.writer(imageUri, texture.source);
    }, {concurrency : 10});
}

function writeEmbeddedBuffer(gltf) {
    var buffer = gltf.buffers[0];
    var source = buffer.extras._obj2gltf.source;

    // Buffers larger than ~192MB cannot be base64 encoded due to a NodeJS limitation. Source: https://github.com/nodejs/node/issues/4266
    if (source.length > 201326580) {
        throw new RuntimeError('Buffer is too large to embed in the glTF. Use the --separate flag instead.');
    }

    buffer.uri = 'data:application/octet-stream;base64,' + source.toString('base64');
}

function writeEmbeddedTextures(gltf) {
    var buffer = gltf.buffers[0];
    var bufferExtras = buffer.extras._obj2gltf;
    var bufferSource = bufferExtras.source;
    var images = gltf.images;
    var imagesLength = images.length;
    var sources = [bufferSource];
    var byteOffset = bufferSource.length;

    for (var i = 0; i < imagesLength; ++i) {
        var image = images[i];
        var texture = image.extras._obj2gltf;
        var textureSource = texture.source;
        var textureByteLength = textureSource.length;

        image.mimeType = mime.lookup(texture.extension);
        image.bufferView = gltf.bufferViews.length;
        gltf.bufferViews.push({
            buffer : 0,
            byteOffset : byteOffset,
            byteLength : textureByteLength
        });
        byteOffset += textureByteLength;
        sources.push(textureSource);
    }

    var source = getBufferPadded(Buffer.concat(sources));
    bufferExtras.source = source;
    buffer.byteLength = source.length;
}
