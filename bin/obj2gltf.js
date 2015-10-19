#!/usr/bin/env node
"use strict";
var fs = require('fs');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));
var parseObj = require('../lib/obj');
var createGltf = require('../lib/gltf');
var util = require('../lib/util');
var defined = util.defined;
var defaultValue = util.defaultValue;

// TODO : support zlib
// TODO : support binary export
if (process.argv.length < 3 || defined(argv.h) || defined(argv.help)) {
    console.log('Usage: ./bin/obj2gltf.js [INPUT] [OPTIONS]\n');
    console.log('  -i, --input             Path to obj file');
    console.log('  -o, --output            Directory or filename for the exported glTF file');
    console.log('  -b, --binary            Output binary glTF');
    console.log('  -c, --combine           Combine glTF resources into a single file');
    console.log('  -t, --technique         Shading technique. Possible values are lambert, phong, blinn, constant');
    console.log('  -h, --help              Display this help');
    process.exit(0);
}

var objFile = defaultValue(argv._[0], defaultValue(argv.i, argv.input));
var outputPath = defaultValue(argv._[1], defaultValue(argv.o, argv.output));
var binary = defaultValue(defaultValue(argv.b, argv.binary), false);
var combine = defaultValue(defaultValue(argv.c, argv.combine), false);
var technique = defaultValue(argv.t, argv.technique);

if (!defined(objFile)) {
    console.error('-i or --input argument is required. See --help for details.');
    process.exit(1);
}

if (!defined(outputPath)) {
    outputPath = path.dirname(objFile);
}

if (defined(technique)) {
    technique = technique.toUpperCase();
    if ((technique !== 'LAMBERT') && (technique !== 'PHONG') && (technique !== 'BLINN') && (technique !== 'CONSTANT')) {
        console.log('Unrecognized technique \'' + technique + '\'. Using default instead.');
    }
}

var inputPath = path.dirname(objFile);
var modelName = path.basename(objFile, '.obj');

var outputIsGltf = /.gltf$/.test(outputPath);
if (outputIsGltf) {
    modelName = path.basename(outputPath, '.gltf');
    outputPath = path.dirname(outputPath);
}

fs.mkdir(outputPath, function(){
    console.time('Total');
    console.time('Parse Obj');
    parseObj(objFile, inputPath, function(data) {
        console.timeEnd('Parse Obj');
        console.time('Create glTF');
        createGltf(data, modelName, inputPath, outputPath, binary, combine, technique, function() {
            console.timeEnd('Create glTF');
            console.timeEnd('Total');
        });
    });
});
