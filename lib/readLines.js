'use strict';
var fsExtra = require('fs-extra');
var Promise = require('bluebird');
var readline = require('readline');

module.exports = readLines;

/**
 * Read a file line-by-line.
 *
 * @param {String} path Path to the file.
 * @param {Function} callback Function to call when reading each line.
 * @returns {Promise} A promise when the reader is finished.
 *
 * @private
 */
function readLines(path, callback) {
    return new Promise(function (resolve, reject) {
        var stream = fsExtra.createReadStream(path);
        stream.on('error', reject);
        stream.on('end', resolve);

        var lineReader = readline.createInterface({
            input: stream
        });
        lineReader.on('line', callback);
    });
}
