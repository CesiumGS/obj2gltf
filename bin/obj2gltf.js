#!/usr/bin/env node
'use strict';
const Cesium = require('cesium');
const fsExtra = require('fs-extra');
const path = require('path');
const yargs = require('yargs');
const obj2gltf = require('../lib/obj2gltf');

const defaultValue = Cesium.defaultValue;
const defined = Cesium.defined;

const defaults = obj2gltf.defaults;

const args = process.argv;

const argv = yargs
    .usage('Usage: node $0 -i inputPath -o outputPath')
    .example('node $0 -i ./specs/data/box/box.obj -o box.gltf')
    .help('h')
    .alias('h', 'help')
    .options({
        input : {
            alias : 'i',
            describe : 'Path to the obj file.',
            type : 'string',
            demandOption : true,
            coerce : function (p) {
                if (p.length === 0) {
                    throw new Error('Input path must be a file name');
                }
                return path.resolve(p);
            }
        },
        output : {
            alias : 'o',
            describe : 'Path of the converted glTF or glb file.',
            type : 'string',
            coerce : function (p) {
                if (p.length === 0) {
                    throw new Error('Output path must be a file name');
                }
                return path.resolve(p);
            }
        },
        binary : {
            alias : 'b',
            describe : 'Save as binary glTF (.glb)',
            type : 'boolean',
            default : defaults.binary
        },
        separate : {
            alias : 's',
            describe : 'Write separate buffers and textures instead of embedding them in the glTF.',
            type : 'boolean',
            default : defaults.separate
        },
        separateTextures : {
            alias : 't',
            describe : 'Write out separate textures only.',
            type : 'boolean',
            default : defaults.separateTextures
        },
        checkTransparency : {
            describe : 'Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel. By default textures are considered to be opaque.',
            type : 'boolean',
            default : defaults.checkTransparency
        },
        secure : {
            describe: 'Prevent the converter from reading image or mtl files outside of the input obj directory.',
            type: 'boolean',
            default: defaults.secure
        },
        inputUpAxis : {
            describe: 'Up axis of the obj.',
            choices: ['X', 'Y', 'Z'],
            type: 'string',
            default: 'Y'
        },
        outputUpAxis : {
            describe: 'Up axis of the converted glTF.',
            choices: ['X', 'Y', 'Z'],
            type: 'string',
            default: 'Y'
        }
    }).parse(args);

if (argv.metallicRoughness + argv.specularGlossiness > 1) {
    console.error('Only one material type may be set from [--metallicRoughness, --specularGlossiness].');
    process.exit(1);
}

if (defined(argv.metallicRoughnessOcclusionTexture) && defined(argv.specularGlossinessTexture)) {
    console.error('--metallicRoughnessOcclusionTexture and --specularGlossinessTexture cannot both be set.');
    process.exit(1);
}

const objPath = argv.input;
let gltfPath = argv.output;

const filename = defaultValue(gltfPath, objPath);
const name = path.basename(filename, path.extname(filename));
const outputDirectory = path.dirname(filename);
const binary = argv.binary || path.extname(filename).toLowerCase() === '.glb';
const extension = binary ? '.glb' : '.gltf';

gltfPath = path.join(outputDirectory, name + extension);

const overridingTextures = {
    metallicRoughnessOcclusionTexture : argv.metallicRoughnessOcclusionTexture,
    specularGlossinessTexture : argv.specularGlossinessTexture,
    occlusionTexture : argv.occlusionTexture,
    normalTexture : argv.normalTexture,
    baseColorTexture : argv.baseColorTexture,
    emissiveTexture : argv.emissiveTexture,
    alphaTexture : argv.alphaTexture
};

const options = {
    binary : binary,
    separate : argv.separate,
    separateTextures : argv.separateTextures,
    checkTransparency : argv.checkTransparency,
    secure : argv.secure,
    inputUpAxis : argv.inputUpAxis,
    outputUpAxis : argv.outputUpAxis
};

console.time('Total');

obj2gltf(objPath, options)
    .then(function(gltf) {
        if (binary) {
            // gltf is a glb buffer
            return fsExtra.outputFile(gltfPath, gltf);
        }
        const jsonOptions = {
            spaces : 2
        };
        return fsExtra.outputJson(gltfPath, gltf, jsonOptions);
    })
    .then(function() {
        console.timeEnd('Total');
    })
    .catch(function(error) {
        console.log(error.message);
        process.exit(1);
    });
