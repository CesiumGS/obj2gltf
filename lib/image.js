'use strict';
var Cesium = require('cesium');
var fs = require('fs-extra');
var path = require('path');
var PNG = require('pngjs').PNG;
var Promise = require('bluebird');

var fsReadFile = Promise.promisify(fs.readFile);

var WebGLConstants = Cesium.WebGLConstants;

module.exports = loadImage;

/**
 * Load an image file and get information about it.
 *
 * @param {String} imagePath Path to the image file.
 * @returns {Promise} A promise resolving to the image information, or undefined if the file doesn't exist.
 *
 * @private
 */
function loadImage(imagePath) {
    return fsReadFile(imagePath)
        .then(function(data) {
            var extension = path.extname(imagePath);
            var uriType = getUriType(extension);
            var uri = uriType + ';base64,' + data.toString('base64');

            var info = {
                transparent : false,
                data : data,
                uri : uri,
                format : getFormat(3),
                extension : extension
            };

            if (extension === '.png') {
                // Color type is encoded in the 25th bit of the png
                var colorType = data[25];
                var channels = getChannels(colorType);
                info.format = getFormat(channels);

                if (channels === 4) {
                    // Need to do a finer grained check over the pixels to see if the image is actually transparent
                    info.transparent = isTransparent(data);
                }
            }

            return info;
        })
        .catch(function() {
            console.log('Could not read image file at ' + imagePath + '. Material will ignore this image.');
            return undefined;
        });
}

function isTransparent(data) {
    var decoded = PNG.sync.read(data);
    var pixels = decoded.data;
    var pixelsLength = decoded.width * decoded.height;
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

function getUriType(extension) {
    switch (extension) {
        case '.png':
            return 'data:image/png';
        case '.jpg':
        case '.jpeg':
            return 'data:image/jpeg';
        case '.gif':
            return 'data:image/gif';
        default:
            return 'data:image/' + extension.slice(1);
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
