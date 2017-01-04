'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var fs = require('fs-extra');
var path = require('path');

var fsReadFile = Promise.promisify(fs.readFile);

var WebGLConstants = Cesium.WebGLConstants;

module.exports = loadImage;

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
        case 'png':
            return 'data:image/png';
        case 'jpg':
            return 'data:image/jpeg';
        case 'jpeg':
            return 'data:image/jpeg';
        case 'gif':
            return 'data:image/gif';
        default:
            return 'data:image/' + extension;
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

function loadImage(imagePath) {
    return fsReadFile(imagePath)
        .then(function(data) {
            var extension = path.extname(imagePath).slice(1);
            var uriType = getUriType(extension);
            var uri = uriType + ';base64,' + data.toString('base64');

            var info = {
                transparent : false,
                channels : 3,
                data : data,
                uri : uri,
                format : getFormat(3)
            };

            if (extension === 'png') {
                // Color type is encoded in the 25th bit of the png
                var colorType = data[25];
                var channels = getChannels(colorType);
                info.channels = channels;
                info.transparent = (channels === 4);
                info.format = getFormat(channels);
            }

            return info;
    }).catch(function() {
        console.log('Could not read image file at ' + imagePath + '. Material will ignore this image.');
        return undefined;
    });
}
