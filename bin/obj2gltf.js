#!/usr/bin/env node
'use strict';
var Cesium = require('cesium');
var path = require('path');
var yargs = require('yargs');
var convert = require('../lib/convert');

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;

var args = process.argv;
args = args.slice(2, args.length);

var argv = yargs
    .usage('Usage: node $0 -i inputPath -o outputPath')
    .example('node $0 -i ./specs/data/box/box.obj -o box.gltf')
    .help('h')
    .alias('h', 'help')
    .options({
        'input': {
            alias: 'i',
            describe: 'Path to the obj file.',
            normalize: true,
            type: 'string'
        },
        'output': {
            alias: 'o',
            describe: 'Path of the converted gltf file.',
            normalize: true,
            type: 'string'
        },
        'binary': {
            alias: 'b',
            describe: 'Write binary glTF file using KHR_binary_glTF extension.',
            type: 'boolean'
        },
        'separate': {
            alias: 's',
            describe: 'Write separate geometry/animation data files, shader files, and textures instead of embedding them in the glTF.',
            type: 'boolean'
        },
        'separateImage': {
            alias: 't',
            describe: 'Write out separate textures, but embeds geometry/animation data files and shader files in the glTF.',
            type: 'boolean'
        },
        'compress': {
            alias: 'c',
            describe: 'Quantize positions, compress texture coordinates, and oct-encode normals.',
            type: 'boolean'
        },
        'cesium': {
            describe: 'Optimize the glTF for Cesium by using the sun as a default light source.',
            type: 'boolean'
        },
        'ao': {
            describe: 'Apply ambient occlusion to the converted model',
            type: 'boolean'
        },
        'generateNormals': {
            alias: 'n',
            describe: 'Generate normals if they are missing',
            type: 'boolean'
        }
    }).parse(args);

var objPath = defaultValue(argv.i, argv._[0]);
var gltfPath = defaultValue(argv.o, argv._[1]);

if (!defined(objPath)) {
    yargs.showHelp();
    return;
}

if (!defined(gltfPath)) {
    var extension = argv.b ? '.glb' : '.gltf';
    var modelName = path.basename(objPath, path.extname(objPath));
    gltfPath = path.join(path.dirname(objPath), modelName + extension);
}

var options = {
    binary : argv.b,
    embed : !argv.s,
    embedImage : !argv.t,
    compress : argv.c,
    ao : argv.ao,
    generateNormals : argv.generateNormals,
    optimizeForCesium : argv.cesium
};

console.time('Total');

convert(objPath, gltfPath, options)
    .then(function() {
        console.timeEnd('Total');
    })
    .catch(function(error) {
        console.log(error);
    });
