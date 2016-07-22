"use strict";
var Promise = require('bluebird');
var fs = require('fs-extra');
var defined = require('cesium').defined;

var fsReadFile = Promise.promisify(fs.readFile);

module.exports = {
    getDefault : getDefault,
    parse : parse
};

function createMaterial() {
    return {
        ambientColor : undefined,               // Ka
        emissionColor : undefined,              // Ke
        diffuseColor : undefined,               // Kd
        specularColor : undefined,              // Ks
        specularShininess : undefined,          // Ns
        alpha : undefined,                      // d / Tr
        ambientColorMap : undefined,            // map_Ka
        emissionColorMap : undefined,           // map_Ke
        diffuseColorMap : undefined,            // map_Kd
        specularColorMap : undefined,           // map_Ks
        specularShininessMap : undefined,       // map_Ns
        normalMap : undefined,                  // map_Bump
        alphaMap : undefined                    // map_d
    };
}

function getDefault() {
    var material = createMaterial();
    material.diffuseColor = [0.5, 0.5, 0.5, 1.0];
    return material;
}

function parse(mtlPath) {
    return fsReadFile(mtlPath, 'utf8')
        .then(function (contents) {
            var materials = {};
            var material;
            var values;
            var value;
            var lines = contents.split('\n');
            var length = lines.length;
            for (var i = 0; i < length; ++i) {
                var line = lines[i].trim();
                if (/^newmtl /i.test(line)) {
                    var name = line.substring(7).trim();
                    material = createMaterial();
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
                }  else if (/^Tr /i.test(line)) {
                    value = line.substring(3).trim();
                    material.alpha = parseFloat(value);
                } else if (/^map_Ka /i.test(line)) {
                    material.ambientColorMap = line.substring(7).trim();
                } else if (/^map_Ke /i.test(line)) {
                    material.emissionColorMap = line.substring(7).trim();
                } else if (/^map_Kd /i.test(line)) {
                    material.diffuseColorMap = line.substring(7).trim();
                } else if (/^map_Ks /i.test(line)) {
                    material.specularColorMap = line.substring(7).trim();
                } else if (/^map_Ns /i.test(line)) {
                    material.specularShininessMap = line.substring(7).trim();
                } else if (/^map_Bump /i.test(line)) {
                    material.normalMap = line.substring(9).trim();
                } else if (/^map_d /i.test(line)) {
                    material.alphaMap = line.substring(6).trim();
                }
            }
            if (defined(material.alpha)) {
                material.diffuseColor[3] = material.alpha;
            }
            return materials;
        })
        .catch(function() {
            console.log('Could not read material file at ' + mtlPath + '. Using default material instead.');
            return {};
        });
}
