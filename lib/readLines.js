'use strict';
var eventStream = require('event-stream');
var fsExtra = require('fs-extra');
var Promise = require('bluebird');

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
    return new Promise(function(resolve, reject) {
        fsExtra.createReadStream(path)
            .on('error', reject)
            .on('end', resolve)
            .pipe(eventStream.split())
            .pipe(eventStream.mapSync(function (line) {
                callback(line);
            }));
    });
}
