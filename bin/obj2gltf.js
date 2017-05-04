#!/usr/bin/env node
'use strict';
var Cesium = require('cesium');
var path = require('path');
var yargs = require('yargs');
var obj2gltf = require('../lib/obj2gltf');

var defined = Cesium.defined;

var defaults = obj2gltf.defaults;

var args = process.argv;

var argv = yargs
    .usage('Usage: node $0 -i inputPath -o outputPath')
    .example('node $0 -i ./specs/data/box/box.obj -o box.gltf')
    .help('h')
    .alias('h', 'help')
    .options({
        input : {
            alias: 'i',
            describe: 'Path to the obj file.',
            type: 'string',
            normalize: true,
            demandOption: true
        },
        output : {
            alias: 'o',
            describe: 'Path of the converted glTF file.',
            type: 'string',
            normalize: true
        },
        binary : {
            alias: 'b',
            describe: 'Save as binary glTF.',
            type: 'boolean',
            default: defaults.binary
        },
        separate : {
            alias: 's',
            describe: 'Write separate geometry data files, shader files, and textures instead of embedding them in the glTF.',
            type: 'boolean',
            default: defaults.separate
        },
        separateTextures : {
            alias: 't',
            describe: 'Write out separate textures only.',
            type: 'boolean',
            default: defaults.separateTextures
        },
        compress : {
            alias: 'c',
            describe: 'Quantize positions, compress texture coordinates, and oct-encode normals.',
            type: 'boolean',
            default: defaults.compress
        },
        optimize : {
            alias: 'z',
            describe: 'Optimize the glTF for size and runtime performance.',
            type: 'boolean',
            default: defaults.optimize
        },
        optimizeForCesium : {
            describe: 'Optimize the glTF for Cesium by using the sun as a default light source.',
            type: 'boolean',
            default: defaults.optimizeForCesium
        },
        generateNormals : {
            alias: 'n',
            describe: 'Generate normals if they are missing.',
            type: 'boolean',
            default: defaults.generateNormals
        },
        ao : {
            describe: 'Apply ambient occlusion to the converted model.',
            type: 'boolean',
            default: defaults.ao
        },
        bypassPipeline : {
            describe: 'Bypass the gltf-pipeline for debugging purposes. This option overrides many of the options above.',
            type: 'boolean',
            default: defaults.bypassPipeline
        },
        checkTransparency : {
            describe: 'Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel. By default textures are considered to be opaque.',
            type: 'boolean',
            default: defaults.checkTransparency
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
        },
        packOcclusion : {
            describe: 'Pack the occlusion texture in the red channel of metallic-roughness texture.',
            type: 'boolean',
            default: defaults.packOcclusion
        },
        metallicRoughness : {
            describe: 'The values in the mtl file are already metallic-roughness PBR values and no conversion step should be applied. Metallic is stored in the Ks and map_Ks slots and roughness is stored in the Ns and map_Ns slots.',
            type: 'boolean',
            default: defaults.metallicRoughness
        },
        specularGlossiness : {
            describe: 'The values in the mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the KHR_materials_pbrSpecularGlossiness extension.',
            type: 'boolean',
            default: defaults.specularGlossiness
        },
        materialsCommon : {
            describe: 'The glTF will be saved with the KHR_materials_common extension.',
            type: 'boolean',
            default: defaults.materialsCommon
        }
    }).parse(args);

var objPath = argv.i;
var gltfPath = argv.o;

if (!defined(gltfPath)) {
    var extension = argv.b ? '.glb' : '.gltf';
    var modelName = path.basename(objPath, path.extname(objPath));
    gltfPath = path.join(path.dirname(objPath), modelName + extension);
}

var options = {
    binary : argv.binary,
    separate : argv.separate,
    separateTextures : argv.separateTextures,
    compress : argv.compress,
    optimize : argv.optimize,
    optimizeForCesium : argv.optimizeForCesium,
    generateNormals : argv.generateNormals,
    ao : argv.ao,
    bypassPipeline : argv.bypassPipeline,
    checkTransparency : argv.checkTransparency,
    secure : argv.secure,
    inputUpAxis : argv.inputUpAxis,
    outputUpAxis : argv.outputUpAxis,
    packOcclusion : argv.packOcclusion,
    metallicRoughness : argv.metallicRoughness,
    specularGlossiness : argv.specularGlossiness
};

console.time('Total');

obj2gltf(objPath, gltfPath, options)
    .then(function() {
        console.timeEnd('Total');
    })
    .catch(function(error) {
        console.log(error);
    });
