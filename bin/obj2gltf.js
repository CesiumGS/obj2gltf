#!/usr/bin/env node
'use strict';
var Cesium = require('cesium');
var path = require('path');
var yargs = require('yargs');
var convert = require('../lib/convert');

var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;

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
            type: 'string',
            normalize: true
        },
        'output': {
            alias: 'o',
            describe: 'Path of the converted glTF file.',
            type: 'string',
            normalize: true
        },
        'binary': {
            alias: 'b',
            describe: 'Save as binary glTF.',
            type: 'boolean',
            default: false
        },
        'separate': {
            alias: 's',
            describe: 'Write separate geometry data files, shader files, and textures instead of embedding them in the glTF.',
            type: 'boolean',
            default: false
        },
        'separateTextures': {
            alias: 't',
            describe: 'Write out separate textures only.',
            type: 'boolean',
            default: false
        },
        'compress': {
            alias: 'c',
            describe: 'Quantize positions, compress texture coordinates, and oct-encode normals.',
            type: 'boolean',
            default: false
        },
        'optimize': {
            alias: 'z',
            describe: 'Use the optimization stages in the glTF pipeline.',
            type: 'boolean',
            default: false
        },
        'cesium': {
            describe: 'Optimize the glTF for Cesium by using the sun as a default light source.',
            type: 'boolean',
            default: false
        },
        'generateNormals': {
            alias: 'n',
            describe: 'Generate normals if they are missing.',
            type: 'boolean',
            default: false
        },
        'ao': {
            describe: 'Apply ambient occlusion to the converted model.',
            type: 'boolean',
            default: false
        },
        'bypassPipeline': {
            describe: 'Bypass the gltf-pipeline for debugging purposes. This option overrides many of the options above and will save the glTF with the KHR_materials_common extension.',
            type: 'boolean',
            default: false
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
    separate : argv.s,
    separateTextures : argv.t,
    compress : argv.c,
    optimize : argv.z,
    generateNormals : argv.n,
    ao : argv.ao,
    optimizeForCesium : argv.cesium,
    bypassPipeline : argv.bypassPipeline
};

console.time('Total');

convert(objPath, gltfPath, options)
    .then(function() {
        console.timeEnd('Total');
    });
