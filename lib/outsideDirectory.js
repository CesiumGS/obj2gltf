'use strict';
var path = require('path');

module.exports = outsideDirectory;

/**
 * Checks if a file is outside of a directory.
 *
 * @param {String} file Path to the file.
 * @param {String} directory Path to the directory.
 * @returns {Boolean} Whether the file is outside of the directory.
 */
function outsideDirectory(file, directory) {
    return (path.relative(directory, file).indexOf('..') === 0);
}
