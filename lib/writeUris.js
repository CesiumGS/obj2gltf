'use strict';
var fsExtra = require('fs-extra');
var mime = require('mime');
var path = require('path');
var Promise = require('bluebird');

var fsExtraOutputFile = Promise.promisify(fsExtra.outputFile);

module.exports = writeUris;

/**
 * Write glTF resources as embedded data uris or external files.
 *
 * @param {Object} gltf The glTF asset.
 * @param {String} gltfPath Path where the glTF will be saved.
 * @param {Boolean} separateBuffers Writes out separate buffers.
 * @param {Boolean} separateTextures Writes out separate textures.
 * @returns {Promise} A promise that resolves to the glTF asset.
 *
 * @private
 */
function writeUris(gltf, gltfPath, separateBuffers, separateTextures) {
    var promises = [];

    var buffer = gltf.buffers[Object.keys(gltf.buffers)[0]];
    var bufferByteLength = buffer.extras._obj2gltf.source.length;

    var texturesByteLength = 0;
    var images = gltf.images;
    for (var id in images) {
        if (images.hasOwnProperty(id)) {
            texturesByteLength += images[id].extras._obj2gltf.source.length;
        }
    }

    // Buffers larger than ~192MB cannot be base64 encoded due to a NodeJS limitation. Source: https://github.com/nodejs/node/issues/4266
    var exceedsMaximum = (texturesByteLength + bufferByteLength > 201326580);

    if (exceedsMaximum) {
        console.log('Buffers and textures are too large to encode in the glTF, saving as separate resources.');
    }

    if (separateBuffers || exceedsMaximum) {
        promises.push(writeSeparateBuffer(gltf, gltfPath));
    } else {
        writeEmbeddedBuffer(gltf);
    }

    if (separateTextures || exceedsMaximum) {
        promises.push(writeSeparateTextures(gltf, gltfPath));
    } else {
        writeEmbeddedTextures(gltf);
    }

    deleteExtras(gltf);

    return Promise.all(promises)
        .then(function() {
            return gltf;
        });
}

function deleteExtras(gltf) {
    var buffer = gltf.buffers[Object.keys(gltf.buffers)[0]];
    delete buffer.extras;

    var images = gltf.images;
    for (var id in images) {
        if (images.hasOwnProperty(id)) {
            var image = images[id];
            delete image.extras;
        }
    }
}

function writeSeparateBuffer(gltf, gltfPath) {
    var buffer = gltf.buffers[Object.keys(gltf.buffers)[0]];
    var source = buffer.extras._obj2gltf.source;
    var bufferName = path.basename(gltfPath, path.extname(gltfPath));
    var bufferUri = bufferName + '.bin';
    buffer.uri = bufferUri;
    var bufferPath = path.join(path.dirname(gltfPath), bufferUri);
    return writeUris._outputFile(bufferPath, source);
}

function writeSeparateTextures(gltf, gltfPath) {
    var promises = [];
    var images = gltf.images;
    for (var id in images) {
        if (images.hasOwnProperty(id)) {
            var image = images[id];
            var extras = image.extras._obj2gltf;
            var imageUri = image.name + extras.extension;
            image.uri = imageUri;
            var imagePath = path.join(path.dirname(gltfPath), imageUri);
            promises.push(writeUris._outputFile(imagePath, extras.source));
        }
    }
    return Promise.all(promises);
}

function writeEmbeddedBuffer(gltf) {
    var buffer = gltf.buffers[Object.keys(gltf.buffers)[0]];
    var source = buffer.extras._obj2gltf.source;
    buffer.uri = 'data:application/octet-stream;base64,' + source.toString('base64');
}

function writeEmbeddedTextures(gltf) {
    var promises = [];
    var images = gltf.images;
    for (var id in images) {
        if (images.hasOwnProperty(id)) {
            var image = images[id];
            var extras = image.extras._obj2gltf;
            image.uri = 'data:' + mime.lookup(extras.extension) + ';base64,' + extras.source.toString('base64');
        }
    }
    return Promise.all(promises);
}

/**
 * Exposed for testing
 *
 * @private
 */
writeUris._outputFile = fsExtraOutputFile;
