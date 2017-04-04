'use strict';
var path = require('path');
var readLines = require('./readLines');

module.exports = loadMtl;

function Material() {
    this.ambientColor = undefined;               // Ka
    this.emissionColor = undefined;              // Ke
    this.diffuseColor = undefined;               // Kd
    this.specularColor = undefined;              // Ks
    this.specularShininess = undefined;          // Ns
    this.alpha = undefined;                      // d / Tr
    this.ambientColorMap = undefined;            // map_Ka
    this.emissionColorMap = undefined;           // map_Ke
    this.diffuseColorMap = undefined;            // map_Kd
    this.specularColorMap = undefined;           // map_Ks
    this.specularShininessMap = undefined;       // map_Ns
    this.normalMap = undefined;                  // map_Bump
    this.alphaMap = undefined;                   // map_d
}

/**
 * Parse an mtl file.
 *
 * @param {String} mtlPath Path to the mtl file.
 * @returns {Promise} A promise resolving to the materials, or an empty object if the mtl file doesn't exist.
 *
 * @private
 */
function loadMtl(mtlPath) {
    var material;
    var values;
    var value;
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
            material.alpha = parseFloat(value);
        } else if (/^map_Ka /i.test(line)) {
            material.ambientColorMap = getAbsolutePath(line.substring(7).trim(), mtlPath);
        } else if (/^map_Ke /i.test(line)) {
            material.emissionColorMap = getAbsolutePath(line.substring(7).trim(), mtlPath);
        } else if (/^map_Kd /i.test(line)) {
            material.diffuseColorMap = getAbsolutePath(line.substring(7).trim(), mtlPath);
        } else if (/^map_Ks /i.test(line)) {
            material.specularColorMap = getAbsolutePath(line.substring(7).trim(), mtlPath);
        } else if (/^map_Ns /i.test(line)) {
            material.specularShininessMap = getAbsolutePath(line.substring(7).trim(), mtlPath);
        } else if (/^map_Bump /i.test(line)) {
            material.normalMap = getAbsolutePath(line.substring(9).trim(), mtlPath);
        } else if (/^map_d /i.test(line)) {
            material.alphaMap = getAbsolutePath(line.substring(6).trim(), mtlPath);
        }
    }

    return readLines(mtlPath, parseLine)
        .then(function() {
            return materials;
        });
}

function getAbsolutePath(imagePath, mtlPath) {
    if (!path.isAbsolute(imagePath)) {
        imagePath = path.join(path.dirname(mtlPath), imagePath);
    }
    return imagePath;
}
