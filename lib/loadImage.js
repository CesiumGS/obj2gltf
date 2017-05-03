'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var jpeg = require('jpeg-js');
var path = require('path');
var PNG = require('pngjs').PNG;
var Promise = require('bluebird');

var fsExtraReadFile = Promise.promisify(fsExtra.readFile);

var defaultValue = Cesium.defaultValue;

module.exports = loadImage;

/**
 * Load an image file and get information about it.
 *
 * @param {String} imagePath Path to the image file.
 * @param {Object} options An object with the following properties:
 * @param {Boolean} [options.checkTransparency=false] Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @param {Boolean} [options.decode=false] Decode image.
 * @returns {Promise} A promise resolving to the image information, or undefined if the file doesn't exist.
 *
 * @private
 */
function loadImage(imagePath, options) {
    options = defaultValue(options, {});
    options.checkTransparency = defaultValue(options.checkTransparency, false);
    options.decode = defaultValue(options.decode, false);

    return fsExtraReadFile(imagePath)
        .then(function(data) {
            var extension = path.extname(imagePath).toLowerCase();

            var info = {
                transparent : false,
                source : data,
                extension : extension,
                path : imagePath,
                decoded : undefined,
                width : undefined,
                height : undefined
            };

            if (extension === '.png') {
                return getPngInfo(data, info, options);
            } else if (extension === '.jpg' || extension === '.jpeg') {
                return getJpegInfo(data, info, options);
            }

            return info;
        });
}

function hasTransparency(info) {
    var pixels = info.decoded;
    var pixelsLength = info.width * info.height;
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

function getPngInfo(data, info, options) {
    // Color type is encoded in the 25th bit of the png
    var colorType = data[25];
    var channels = getChannels(colorType);

    var checkTransparency = (channels === 4 && options.checkTransparency);
    var decode = options.decode || checkTransparency;

    if (decode) {
        var decodedResults = PNG.sync.read(data);
        info.decoded = decodedResults.data;
        info.width = decodedResults.width;
        info.height = decodedResults.height;
        if (checkTransparency) {
            info.transparent = hasTransparency(info);
        }
    }
    return info;
}

function getJpegInfo(data, info, options) {
    if (options.decode) {
        var decodedResults = jpeg.decode(data);
        info.decoded = decodedResults.data;
        info.width = decodedResults.width;
        info.height = decodedResults.height;
    }
    return info;
}
