"use strict";
module.exports = {
    defined : defined,
    defaultValue : defaultValue
};

function defined(value) {
    return value !== undefined;
}

function defaultValue(a, b) {
    if (a !== undefined) {
        return a;
    }
    return b;
}
