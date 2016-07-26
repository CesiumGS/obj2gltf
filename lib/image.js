"use strict";
var Promise = require('bluebird');
var fs = require('fs-extra');
var path = require('path');

var fsReadFile = Promise.promisify(fs.readFile);

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

function loadImage(imagePath) {
    return fsReadFile(imagePath)
        .then(function(data) {
            var extension = path.extname(imagePath).slice(1);
            var uriType = getUriType(extension);
            var uri = uriType + ';base64,' + data.toString('base64');

            var info = {
                transparent: false,
                channels: 3,
                data: data,
                uri: uri
            };

            if (path.extname(imagePath) === 'png') {
                // Color type is encoded in the 25th bit of the png
                var colorType = data[25];
                var channels = getChannels(colorType);
                info.channels = channels;
                info.transparent = (channels === 4);
            }
            return info;
    });
}
