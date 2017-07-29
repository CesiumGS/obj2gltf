'use strict';
var Cesium = require('cesium');

var ComponentDatatype = Cesium.ComponentDatatype;

module.exports = ArrayStorage;

var initialLength = 1024; // 2^10
var doublingThreshold = 33554432; // 2^25 (~134 MB for a Float32Array)
var fixedExpansionLength = 33554432; // 2^25 (~134 MB for a Float32Array)

/**
 * Provides expandable typed array storage for geometry data. This is preferable to JS arrays which are
 * stored with double precision. The resizing mechanism is similar to std::vector.
 *
 * @param {ComponentDatatype} componentDatatype The data type.
 *
 * @private
 */
function ArrayStorage(componentDatatype) {
    this.componentDatatype = componentDatatype;
    this.typedArray = ComponentDatatype.createTypedArray(componentDatatype, 0);
    this.length = 0;
}

function resize(storage, length) {
    var typedArray = ComponentDatatype.createTypedArray(storage.componentDatatype, length);
    typedArray.set(storage.typedArray);
    storage.typedArray = typedArray;
}

ArrayStorage.prototype.push = function(value) {
    var length = this.length;
    var typedArrayLength = this.typedArray.length;

    if (length === 0) {
        resize(this, initialLength);
    } else if (length === typedArrayLength) {
        if (length < doublingThreshold) {
            resize(this, typedArrayLength * 2);
        } else {
            resize(this, typedArrayLength + fixedExpansionLength);
        }
    }

    this.typedArray[this.length++] = value;
};

ArrayStorage.prototype.get = function(index) {
    return this.typedArray[index];
};

var sizeOfUint16 = 2;
var sizeOfUint32 = 4;
var sizeOfFloat = 4;

ArrayStorage.prototype.toUint16Buffer = function() {
    var length = this.length;
    var typedArray = this.typedArray;
    var paddedLength = length + ((length % 2 === 0) ? 0 : 1); // Round to next multiple of 2
    var buffer = Buffer.alloc(paddedLength * sizeOfUint16);
    for (var i = 0; i < length; ++i) {
        buffer.writeUInt16LE(typedArray[i], i * sizeOfUint16);
    }
    return buffer;
};

ArrayStorage.prototype.toUint32Buffer = function() {
    var length = this.length;
    var typedArray = this.typedArray;
    var buffer = Buffer.alloc(length * sizeOfUint32);
    for (var i = 0; i < length; ++i) {
        buffer.writeUInt32LE(typedArray[i], i * sizeOfUint32);
    }
    return buffer;
};

ArrayStorage.prototype.toFloatBuffer = function() {
    var length = this.length;
    var typedArray = this.typedArray;
    var buffer = Buffer.alloc(length * sizeOfFloat);
    for (var i = 0; i < length; ++i) {
        buffer.writeFloatLE(typedArray[i], i * sizeOfFloat);
    }
    return buffer;
};

ArrayStorage.prototype.getMinMax = function(components) {
    var length = this.length;
    var typedArray = this.typedArray;
    var count = length / components;
    var min = new Array(components).fill(Number.POSITIVE_INFINITY);
    var max = new Array(components).fill(Number.NEGATIVE_INFINITY);
    for (var i = 0; i < count; ++i) {
        for (var j = 0; j < components; ++j) {
            var index = i * components + j;
            var value = typedArray[index];
            min[j] = Math.min(min[j], value);
            max[j] = Math.max(max[j], value);
        }
    }
    return {
        min : min,
        max : max
    };
};
