'use strict';
var Cesium = require('cesium');
var ArrayStorage = require('./ArrayStorage');

var defaultValue = Cesium.defaultValue;

module.exports = clone;

/**
 * Clones an object, returning a new object containing the same properties.
 * Modified from Cesium.clone to support typed arrays, buffers, and the ArrayStorage class.
 *
 * @param {Object} object The object to clone.
 * @param {Boolean} [deep=false] If true, all properties will be deep cloned recursively.
 * @returns {Object} The cloned object.
 *
 * @private
 */
function clone(object, deep) {
    if (object === null || typeof object !== 'object') {
        return object;
    }

    deep = defaultValue(deep, false);

    var isBuffer = Buffer.isBuffer(object);
    var isTypedArray = Object.prototype.toString.call(object.buffer) === '[object ArrayBuffer]';
    var isArrayStorage = object instanceof ArrayStorage;

    var result;
    if (isBuffer) {
        result = Buffer.from(object);
        return result;
    } else if (isTypedArray) {
        result = object.slice();
        return result;
    } else if (isArrayStorage) {
        result = new ArrayStorage(object.componentDatatype);
    } else {
        result = new object.constructor();
    }

    for (var propertyName in object) {
        if (object.hasOwnProperty(propertyName)) {
            var value = object[propertyName];
            if (deep) {
                value = clone(value, deep);
            }
            result[propertyName] = value;
        }
    }

    return result;
}
