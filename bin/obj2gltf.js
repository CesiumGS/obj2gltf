#!/usr/bin/env node
"use strict";
var argv = require('yargs').argv;
var Cesium = require('cesium');
var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var convert = require('../lib/convert');

if (process.argv.length < 3 || defined(argv.h) || defined(argv.help)) {
    console.log('Usage: ./bin/obj2gltf.js [INPUT] [OPTIONS]');
    console.log('  -i, --input             Path to obj file');
    console.log('  -o, --output            Directory or filename for the exported glTF file');
    console.log('  -b, --binary            Output binary glTF');
    console.log('  -s --separate           Writes out separate geometry/animation data files, shader files, and textures instead of embedding them in the glTF file.');
    console.log('  -t --separateImage      Write out separate textures only.');
    console.log('  -h, --help              Display this help');
    console.log('      --ao                Apply ambient occlusion to the converted model');
    process.exit(0);
}

var objFile = defaultValue(argv._[0], defaultValue(argv.i, argv.input));
var outputPath = defaultValue(argv._[1], defaultValue(argv.o, argv.output));
var binary = defaultValue(defaultValue(argv.b, argv.binary), false);
var separate = defaultValue(defaultValue(argv.s, argv.separate), false);
var separateImage = defaultValue(defaultValue(argv.t, argv.separateImage), false);
var quantize = defaultValue(defaultValue(argv.q, argv.quantize), false); // Undocumented option
var ao = defaultValue(argv.ao, false);

if (!defined(objFile)) {
    throw new Error('-i or --input argument is required. See --help for details.');
}

console.time('Total');

var options = {
    binary : binary,
    embed : !separate,
    embedImage : !separateImage,
    quantize : quantize,
    ao : ao
};

convert(objFile, outputPath, options)
    .then(function() {
        console.timeEnd('Total');
    });
