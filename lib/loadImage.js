'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var jpeg = require('jpeg-js');
var path = require('path');
var PNG = require('pngjs').PNG;
var Promise = require('bluebird');
var Image = require('./Image');

var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;

module.exports = loadImage;

/**
 * Load an image file.
 *
 * @param {String} imagePath Path to the image file.
 * @param {Object} options An object with the following properties:
 * @param {Boolean} [options.checkTransparency=false] Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel.
 * @param {Boolean} [options.decode=false] Decode image.
 * @returns {Promise} A promise resolving to an Image object.
 *
 * @private
 */
function loadImage(imagePath, options) {
    options = defaultValue(options, {});
    options.checkTransparency = defaultValue(options.checkTransparency, false);
    options.decode = defaultValue(options.decode, false);

    return fsExtra.readFile(imagePath)
        .then(function(data) {
            var extension = path.extname(imagePath).toLowerCase();
            var image = new Image();
            image.source = data;
            image.extension = extension;
            image.path = imagePath;

            var decodePromise;
            if (extension === '.png') {
                decodePromise = decodePng(image, options);
            } else if (extension === '.jpg' || extension === '.jpeg') {
                decodePromise = decodeJpeg(image, options);
            }

            if (defined(decodePromise)) {
                return decodePromise.thenReturn(image);
            }

            return image;
        });
}

function hasTransparency(image) {
    var pixels = image.decoded;
    var pixelsLength = image.width * image.height;
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

function decodePng(image, options) {
    // Color type is encoded in the 25th bit of the png
    var source = image.source;
    var colorType = source[25];
    var channels = getChannels(colorType);

    var checkTransparency = (channels === 4 && options.checkTransparency);
    var decode = options.decode || checkTransparency;

    if (decode) {
        return parsePng(source)
            .then(function(decodedResults) {
                image.decoded = decodedResults.data;
                image.width = decodedResults.width;
                image.height = decodedResults.height;
                if (checkTransparency) {
                    image.transparent = hasTransparency(image);
                }
            });
    }
}

function decodeJpeg(image, options) {
    if (options.decode) {
        var source = image.source;
        var decodedResults = jpeg.decode(source);
        image.decoded = decodedResults.data;
        image.width = decodedResults.width;
        image.height = decodedResults.height;
    }
}
