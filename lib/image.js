'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var path = require('path');
var PNG = require('pngjs').PNG;
var Promise = require('bluebird');

var fsExtraReadFile = Promise.promisify(fsExtra.readFile);

var defaultValue = Cesium.defaultValue;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = loadImage;

/**
 * Load an image file and get information about it.
 *
 * @param {String} imagePath Path to the image file.
 * @param {Object} [options] An object with the following properties:
 * @param {Boolean} [options.hasTransparency=false] Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @returns {Promise} A promise resolving to the image information, or undefined if the file doesn't exist.
 *
 * @private
 */
function loadImage(imagePath, options) {
    options = defaultValue(options, defaultValue.EMPTY_OBJECT);
    var hasTransparency = defaultValue(options.hasTransparency, false);

    return fsExtraReadFile(imagePath)
        .then(function(data) {
            var extension = path.extname(imagePath);

            var info = {
                transparent : false,
                format : getFormat(3),
                source : data,
                extension : extension
            };

            if (extension === '.png') {
                // Color type is encoded in the 25th bit of the png
                var colorType = data[25];
                var channels = getChannels(colorType);
                info.format = getFormat(channels);

                if (channels === 4) {
                    info.transparent = true;
                    if (hasTransparency) {
                        return isTransparent(data)
                            .then(function(transparent) {
                                info.transparent = transparent;
                                return info;
                            });
                    }
                }
            }

            return info;
        });
}

function isTransparent(data) {
    return new Promise(function(resolve, reject) {
        new PNG().parse(data, function(error, data) {
            if (error) {
                reject(error);
                return;
            }
            var pixels = data.data;
            var pixelsLength = data.width * data.height;
            for (var i = 0; i < pixelsLength; ++i) {
                if (pixels[i * 4 + 3] < 255) {
                    resolve(true);
                    return;
                }
            }
            resolve(false);
        });
    });
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

function getFormat(channels) {
    switch (channels) {
        case 1:
            return WebGLConstants.ALPHA;
        case 2:
            return WebGLConstants.LUMINANCE_ALPHA;
        case 3:
            return WebGLConstants.RGB;
        case 4:
            return WebGLConstants.RGBA;
    }
}
