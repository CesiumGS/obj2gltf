#!/usr/bin/env node
'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
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
            alias : 'i',
            describe : 'Path to the obj file.',
            type : 'string',
            normalize : true,
            demandOption : true
        },
        output : {
            alias : 'o',
            describe : 'Path of the converted glTF or glb file.',
            type : 'string',
            normalize : true
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
            describe : 'Prevent the converter from reading textures or mtl files outside of the input obj directory.',
            type : 'boolean',
            default : defaults.secure
        },
        packOcclusion : {
            describe : 'Pack the occlusion texture in the red channel of metallic-roughness texture.',
            type : 'boolean',
            default : defaults.packOcclusion
        },
        metallicRoughness : {
            describe : 'The values in the .mtl file are already metallic-roughness PBR values and no conversion step should be applied. Metallic is stored in the Ks and map_Ks slots and roughness is stored in the Ns and map_Ns slots.',
            type : 'boolean',
            default : defaults.metallicRoughness
        },
        specularGlossiness : {
            describe : 'The values in the .mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the KHR_materials_pbrSpecularGlossiness extension.',
            type : 'boolean',
            default : defaults.specularGlossiness
        },
        materialsCommon : {
            describe : 'The glTF will be saved with the KHR_materials_common extension.',
            type : 'boolean',
            default : defaults.materialsCommon
        },
        metallicRoughnessOcclusionTexture : {
            describe : 'Path to the metallic-roughness-occlusion texture that should override textures in the .mtl file, where occlusion is stored in the red channel, roughness is stored in the green channel, and metallic is stored in the blue channel. The model will be saved with a pbrMetallicRoughness material. This is often convenient in workflows where the .mtl does not exist or is not set up to use PBR materials. Intended for models with a single material',
            type : 'string',
            normalize : true
        },
        specularGlossinessTexture : {
            describe : 'Path to the specular-glossiness texture that should override textures in the .mtl file, where specular color is stored in the red, green, and blue channels and specular glossiness is stored in the alpha channel. The model will be saved with a material using the KHR_materials_pbrSpecularGlossiness extension.',
            type : 'string',
            normalize : true
        },
        occlusionTexture : {
            describe : 'Path to the occlusion texture that should override textures in the .mtl file.',
            type : 'string',
            normalize : true
        },
        normalTexture : {
            describe : 'Path to the normal texture that should override textures in the .mtl file.',
            type : 'string',
            normalize : true
        },
        baseColorTexture : {
            describe : 'Path to the baseColor/diffuse texture that should override textures in the .mtl file.',
            type : 'string',
            normalize : true
        },
        emissiveTexture : {
            describe : 'Path to the emissive texture that should override textures in the .mtl file.',
            type : 'string',
            normalize : true
        }
    }).parse(args);

if (argv.metallicRoughness + argv.specularGlossiness + argv.materialsCommon > 1) {
    console.error('Only one material type may be set from [--metallicRoughness, --specularGlossiness, --materialsCommon].');
    process.exit(1);
}

if (defined(argv.metallicRoughnessOcclusionTexture) && defined(argv.specularGlossinessTexture)) {
    console.error('--metallicRoughnessOcclusionTexture and --specularGlossinessTexture cannot both be set.');
    process.exit(1);
}

var objPath = argv.input;
var gltfPath = argv.output;
var name = path.basename(objPath, path.extname(objPath));

if (!defined(gltfPath)) {
    gltfPath = path.join(path.dirname(objPath), name + '.gltf');
}

var outputDirectory = path.dirname(gltfPath);
var extension = path.extname(gltfPath).toLowerCase();
if (argv.binary || extension === '.glb') {
    argv.binary = true;
    extension = '.glb';
}
gltfPath = path.join(outputDirectory, name + extension);

var overridingTextures = {
    metallicRoughnessOcclusionTexture : argv.metallicRoughnessOcclusionTexture,
    specularGlossinessTexture : argv.specularGlossinessTexture,
    occlusionTexture : argv.occlusionTexture,
    normalTexture : argv.normalTexture,
    baseColorTexture : argv.baseColorTexture,
    emissiveTexture : argv.emissiveTexture
};

var options = {
    binary : argv.binary,
    separate : argv.separate,
    separateTextures : argv.separateTextures,
    checkTransparency : argv.checkTransparency,
    secure : argv.secure,
    packOcclusion : argv.packOcclusion,
    metallicRoughness : argv.metallicRoughness,
    specularGlossiness : argv.specularGlossiness,
    materialsCommon : argv.materialsCommon,
    overridingTextures : overridingTextures,
    outputDirectory : outputDirectory
};

console.time('Total');

obj2gltf(objPath, options)
    .then(function(gltf) {
        if (argv.binary) {
            // gltf is a glb buffer
            return fsExtra.outputFile(gltfPath, gltf);
        }
        var jsonOptions = {
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
