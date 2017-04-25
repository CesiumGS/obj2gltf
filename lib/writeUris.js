'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var mime = require('mime');
var path = require('path');
var Promise = require('bluebird');

var fsExtraOutputFile = Promise.promisify(fsExtra.outputFile);

var RuntimeError = Cesium.RuntimeError;

module.exports = writeUris;

/**
 * Write glTF resources as embedded data uris or external files.
 *
 * @param {Object} gltf The glTF asset.
 * @param {String} gltfPath Path where the glTF will be saved.
 * @param {String} resourcesDirectory Path where separate resources will be saved.
 * @param {Object} options An object with the following properties:
 * @param {Boolean} options.separate Writes out separate buffers.
 * @param {Boolean} options.separateTextures Write out separate textures only.
 * @returns {Promise} A promise that resolves to the glTF asset.
 *
 * @private
 */
function writeUris(gltf, gltfPath, resourcesDirectory, options) {
    var separate = options.separate;
    var separateTextures = options.separateTextures;

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

    if (exceedsMaximum && !separate) {
        return Promise.reject(new RuntimeError('Buffers and textures are too large to encode in the glTF. Use the --separate flag instead.'));
    }

    var name = path.basename(gltfPath, path.extname(gltfPath));

    if (separate) {
        promises.push(writeSeparateBuffer(gltf, resourcesDirectory, name));
    } else {
        writeEmbeddedBuffer(gltf);
    }

    if (separateTextures) {
        promises.push(writeSeparateTextures(gltf, resourcesDirectory));
    } else {
        writeEmbeddedTextures(gltf);
    }

    return Promise.all(promises)
        .then(function() {
            deleteExtras(gltf);
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

function writeSeparateBuffer(gltf, resourcesDirectory, name) {
    var buffer = gltf.buffers[Object.keys(gltf.buffers)[0]];
    var source = buffer.extras._obj2gltf.source;
    var bufferUri = name + '.bin';
    buffer.uri = bufferUri;
    var bufferPath = path.join(resourcesDirectory, bufferUri);
    return writeUris._outputFile(bufferPath, source);
}

function writeSeparateTextures(gltf, resourcesDirectory) {
    var images = gltf.images;
    return Promise.map(Object.keys(images), function(id) {
        var image = images[id];
        var extras = image.extras._obj2gltf;
        var imageUri = image.name + extras.extension;
        image.uri = imageUri;
        var imagePath = path.join(resourcesDirectory, imageUri);
        return writeUris._outputFile(imagePath, extras.source);
    }, {concurrency : 10});
}

function writeEmbeddedBuffer(gltf) {
    var buffer = gltf.buffers[Object.keys(gltf.buffers)[0]];
    var source = buffer.extras._obj2gltf.source;
    buffer.uri = 'data:application/octet-stream;base64,' + source.toString('base64');
}

function writeEmbeddedTextures(gltf) {
    var images = gltf.images;
    for (var id in images) {
        if (images.hasOwnProperty(id)) {
            var image = images[id];
            var extras = image.extras._obj2gltf;
            image.uri = 'data:' + mime.lookup(extras.extension) + ';base64,' + extras.source.toString('base64');
        }
    }
}

/**
 * Exposed for testing.
 *
 * @private
 */
writeUris._outputFile = fsExtraOutputFile;
