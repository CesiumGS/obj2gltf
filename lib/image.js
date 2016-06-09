"use strict";
var fs = require('fs-extra');
var path = require('path');

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

function loadImage(imagePath, done) {
    fs.readFile(imagePath, function(error, data) {
        if (error) {
            throw(error);
        }

        var info = {
            transparent : false,
            channels : 3,
            data : data
        };

        if (path.extname(imagePath) === '.png') {
            // Color type is encoded in the 25th bit of the png
            var colorType = data[25];
            var channels = getChannels(colorType);
            info.channels = channels;
            info.transparent = (channels === 4);
        }

        done(info);
    });
}
