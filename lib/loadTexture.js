'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var jpeg = require('jpeg-js');
var path = require('path');
var PNG = require('pngjs').PNG;
var Promise = require('bluebird');
var Texture = require('./Texture');

var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;

module.exports = loadTexture;

/**
 * Load a texture file.
 *
 * @param {String} texturePath Path to the texture file.
 * @param {Object} [options] An object with the following properties:
 * @param {Boolean} [options.checkTransparency=false] Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @param {Boolean} [options.decode=false] Whether to decode the texture.
 * @returns {Promise} A promise resolving to a Texture object.
 *
 * @private
 */
function loadTexture(texturePath, options) {
    options = defaultValue(options, {});
    options.checkTransparency = defaultValue(options.checkTransparency, false);
    options.decode = defaultValue(options.decode, false);

    return fsExtra.readFile(texturePath)
        .then(function(source) {
            var name = path.basename(texturePath, path.extname(texturePath));
            var extension = path.extname(texturePath).toLowerCase();
            var texture = new Texture();
            texture.source = source;
            texture.name = name;
            texture.extension = extension;
            texture.path = texturePath;

            var decodePromise;
            if (extension === '.png') {
                decodePromise = decodePng(texture, options);
            } else if (extension === '.jpg' || extension === '.jpeg') {
                decodePromise = decodeJpeg(texture, options);
            }

            if (defined(decodePromise)) {
                return decodePromise.thenReturn(texture);
            }

            return texture;
        });
}

function hasTransparency(pixels) {
    var pixelsLength = pixels.length / 4;
    for (var i = 0; i < pixelsLength; ++i) {
        if (pixels[i * 4 + 3] < 255) {
            return true;
        }
    }
    return false;
}

function getChannels(colorType) {
    switch (colorType) {
        case 0: // greyscale
            return 1;
        case 2: // RGB
            return  3;
        case 4: // greyscale + alpha
            return 2;
        case 6: // RGB + alpha
            return 4;
        default:
            return 3;
    }
}

function parsePng(data) {
    return new Promise(function(resolve, reject) {
        new PNG().parse(data, function(error, decodedResults) {
            if (defined(error)) {
                reject(error);
                return;
            }
            resolve(decodedResults);
        });
    });
}

function decodePng(texture, options) {
    // Color type is encoded in the 25th bit of the png
    var source = texture.source;
    var colorType = source[25];
    var channels = getChannels(colorType);

    var checkTransparency = (channels === 4 && options.checkTransparency);
    var decode = options.decode || checkTransparency;

    if (decode) {
        return parsePng(source)
            .then(function(decodedResults) {
                if (options.checkTransparency) {
                    texture.transparent = hasTransparency(decodedResults.data);
                }
                if (options.decode) {
                    texture.pixels = decodedResults.data;
                    texture.width = decodedResults.width;
                    texture.height = decodedResults.height;
                    texture.source = undefined; // Unload resources
                }
            });
    }
}

function decodeJpeg(texture, options) {
    if (options.decode) {
        var source = texture.source;
        var decodedResults = jpeg.decode(source);
        texture.pixels = decodedResults.data;
        texture.width = decodedResults.width;
        texture.height = decodedResults.height;
        texture.source = undefined; // Unload resources
    }
}
