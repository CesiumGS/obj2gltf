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

// TODO : assuming all paths in obj are relative, but should consider absolute paths
// TODO : add command line flag for y-up to z-up
// TODO : support zlib
// TODO : support binary export
// TODO : generate normals if they don't exist
if (process.argv.length < 3 || defined(argv.h) || defined(argv.help)) {
    console.log('Usage: ./bin/obj2gltf.js [INPUT] [OPTIONS]\n');
    console.log('  -i, --input             Path to obj file');
    console.log('  -o, --output            Directory or filename for the exported glTF file');
    console.log('  -b, --binary            Output binary glTF');
    console.log('  -c  --combine           Combine glTF resources into a single file');
    console.log('  -h, --help              Display this help');
    process.exit(0);
}

var objFile = defaultValue(argv._[0], defaultValue(argv.i, argv.input));
var outputPath = defaultValue(defaultValue(argv.o, argv.output));
var binary = defaultValue(defaultValue(argv.b, argv.binary), false);
var combine = defaultValue(defaultValue(argv.c, argv.combine), false);

if (!defined(objFile)) {
    console.error('-i or --input argument is required.  See --help for details.');
    process.exit(1);
}

if (!defined(outputPath)) {
    outputPath = path.dirname(objFile);
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
        createGltf(data, modelName, inputPath, outputPath, binary, combine, function() {
            console.timeEnd('Create glTF');
            console.timeEnd('Total');
        });
    });
});
