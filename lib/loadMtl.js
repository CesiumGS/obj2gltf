'use strict';
var path = require('path');
var Material = require('./Material');
var readLines = require('./readLines');

module.exports = loadMtl;

/**
 * Parse an mtl file.
 *
 * @param {String} mtlPath Path to the mtl file.
 * @returns {Promise} A promise resolving to the materials.
 *
 * @private
 */
function loadMtl(mtlPath) {
    var material;
    var values;
    var value;
    var mtlDirectory = path.dirname(mtlPath);
    var materials = {};

    function parseLine(line) {
        line = line.trim();
        if (/^newmtl /i.test(line)) {
            var name = line.substring(7).trim();
            material = new Material();
            materials[name] = material;
        } else if (/^Ka /i.test(line)) {
            values = line.substring(3).trim().split(' ');
            material.ambientColor = [
                parseFloat(values[0]),
                parseFloat(values[1]),
                parseFloat(values[2]),
                1.0
            ];
        } else if (/^Ke /i.test(line)) {
            values = line.substring(3).trim().split(' ');
            material.emissionColor = [
                parseFloat(values[0]),
                parseFloat(values[1]),
                parseFloat(values[2]),
                1.0
            ];
        } else if (/^Kd /i.test(line)) {
            values = line.substring(3).trim().split(' ');
            material.diffuseColor = [
                parseFloat(values[0]),
                parseFloat(values[1]),
                parseFloat(values[2]),
                1.0
            ];
        } else if (/^Ks /i.test(line)) {
            values = line.substring(3).trim().split(' ');
            material.specularColor = [
                parseFloat(values[0]),
                parseFloat(values[1]),
                parseFloat(values[2]),
                1.0
            ];
        } else if (/^Ns /i.test(line)) {
            value = line.substring(3).trim();
            material.specularShininess = parseFloat(value);
        } else if (/^d /i.test(line)) {
            value = line.substring(2).trim();
            material.alpha = parseFloat(value);
        } else if (/^Tr /i.test(line)) {
            value = line.substring(3).trim();
            material.alpha = 1.0 - parseFloat(value);
        } else if (/^map_Ka /i.test(line)) {
            material.ambientTexture = normalizeTexturePath(line.substring(7).trim(), mtlDirectory);
        } else if (/^map_Ke /i.test(line)) {
            material.emissionTexture = normalizeTexturePath(line.substring(7).trim(), mtlDirectory);
        } else if (/^map_Kd /i.test(line)) {
            material.diffuseTexture = normalizeTexturePath(line.substring(7).trim(), mtlDirectory);
        } else if (/^map_Ks /i.test(line)) {
            material.specularTexture = normalizeTexturePath(line.substring(7).trim(), mtlDirectory);
        } else if (/^map_Ns /i.test(line)) {
            material.specularShininessMap = normalizeTexturePath(line.substring(7).trim(), mtlDirectory);
        } else if (/^map_Bump /i.test(line)) {
            material.normalMap = normalizeTexturePath(line.substring(9).trim(), mtlDirectory);
        } else if (/^map_d /i.test(line)) {
            material.alphaMap = normalizeTexturePath(line.substring(6).trim(), mtlDirectory);
        }
    }

    return readLines(mtlPath, parseLine)
        .then(function() {
            return materials;
        });
}

function normalizeTexturePath(texturePath, mtlDirectory) {
    // Removes texture options from texture name
    // Assumes no spaces in texture name
    var re = /-(bm|t|s|o|blendu|blendv|boost|mm|texres|clamp|imfchan|type)/;
    if (re.test(texturePath)) {
        texturePath = texturePath.split(/\s+/).pop();
    }
    texturePath = texturePath.replace(/\\/g, '/');
    return path.normalize(path.join(mtlDirectory, texturePath));
}
