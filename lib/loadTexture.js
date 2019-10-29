'use strict';
const Cesium = require('cesium');
const fsExtra = require('fs-extra');
const jpeg = require('jpeg-js');
const path = require('path');
const PNG = require('pngjs').PNG;
const Promise = require('bluebird');
const Texture = require('./Texture');

const defaultValue = Cesium.defaultValue;
const defined = Cesium.defined;

module.exports = loadTexture;

/**
 * Load a texture file.
 *
 * @param {String} texturePath Path to the texture file.
 * @param {Object} [options] An object with the following properties:
 * @param {Boolean} [options.checkTransparency=false] Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @param {Boolean} [options.decode=false] Whether to decode the texture.
 * @param {Boolean} [options.keepSource=false] Whether to keep the source image contents in memory.
 * @returns {Promise} A promise resolving to a Texture object.
 *
 * @private
 */
function loadTexture(texturePath, options) {
    options = defaultValue(options, {});
    options.checkTransparency = defaultValue(options.checkTransparency, false);
    options.decode = defaultValue(options.decode, false);
    options.keepSource = defaultValue(options.keepSource, false);

    return fsExtra.readFile(texturePath)
        .then(function(source) {
            const name = path.basename(texturePath, path.extname(texturePath));
            const extension = path.extname(texturePath).toLowerCase();
            const texture = new Texture();
            texture.source = source;
            texture.name = name;
            texture.extension = extension;
            texture.path = texturePath;

            let decodePromise;
            if (extension === '.png') {
                decodePromise = decodePng(texture, options);
            } else if (extension === '.jpg' || extension === '.jpeg') {
                decodePromise = decodeJpeg(texture, options);
            }

            if (defined(decodePromise)) {
                return decodePromise
                    .then(function() {
                        return texture;
                    });
            }

            return texture;
        });
}

function hasTransparency(pixels) {
    const pixelsLength = pixels.length / 4;
    for (let i = 0; i < pixelsLength; ++i) {
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
    const source = texture.source;
    const colorType = source[25];
    const channels = getChannels(colorType);

    const checkTransparency = (channels === 4 && options.checkTransparency);
    const decode = options.decode || checkTransparency;

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
                    if (!options.keepSource) {
                        texture.source = undefined; // Unload resources
                    }
                }
            });
    }
}

function decodeJpeg(texture, options) {
    if (options.decode) {
        const source = texture.source;
        const decodedResults = jpeg.decode(source);
        texture.pixels = decodedResults.data;
        texture.width = decodedResults.width;
        texture.height = decodedResults.height;
        if (!options.keepSource) {
            texture.source = undefined; // Unload resources
        }
    }
}
