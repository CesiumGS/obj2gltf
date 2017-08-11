# OBJ2GLTF

Convert OBJ assets to [glTF](https://www.khronos.org/gltf) 2.0.

## Getting Started

Install [Node.js](https://nodejs.org/en/) if you don't already have it, and then:
```
npm install --save obj2gltf
```

### Using obj2gltf as a command-line tool:

`node bin/obj2gltf.js -i model.obj`

`node bin/obj2gltf.js -i model.obj -o model.gltf`

`node bin/obj2gltf.js -i model.obj -o model.glb`

### Using obj2gltf as a library:

#### Converting an obj model to gltf:

```javascript
var obj2gltf = require('obj2gltf');
obj2gltf('model.obj')
    .then(function(gltf) {
        console.log(gltf.asset);
    });
```

#### Converting an obj model to glb

```javascript
var obj2gltf = require('obj2gltf');
var options = {
    binary : true
}
obj2gltf('model.obj', options)
    .then(function(glb) {
        console.log(glb.length);
    });
```

## Material types

Traditionally the .mtl file format describes the Blinn-Phong shading model. Meanwhile glTF 2.0 introduces physically-based
materials.

There are three shading models supported by `obj2gltf`:

* Metallic roughness PBR
* Specular glossiness PBR (via `KHR_materials_pbrSpecularGlossiness` extension)
* Materials common (via `KHR_materials_common` extension)

If the material type is known in advance, it should be specified with either the `metallicRoughness`, `specularGlossiness`, or `materialsCommon` flag.

In general, if a model is authored with traditional diffuse, specular, and shininess textures the `materialsCommon` flag should be passed in.
The glTF will be saved with the `KHR_materials_common` extension and the Blinn-Phong shading model will be used.

However if the model is created with PBR textures, either the `metallicRoughness` or `specularGlossiness` flag should be passed in.
See the command line flags below for more information about how to specify PBR values inside the .mtl file.

If none of these flags are provided, the .mtl is assumed to contain traditional Blinn-Phong materials which will be converted to metallic-roughness PBR.
There may be some quality loss as traditional materials do not map perfectly to PBR materials.

Commonly in PBR workflows the the .mtl file may not exist or its values may be outdated or incorrect.
As a convenience the PBR textures may be supplied directly to the command line. See the options below.

## Usage

### Command line flags:

|Flag|Description|Required|
|----|-----------|--------|
|`-h`, `--help`|Display help.|No|
|`-i`, `--input`|Path to the obj file.| :white_check_mark: Yes|
|`-o`, `--output`|Path of the converted glTF or glb file.|No|
|`-b`, `--binary`|Save as binary glTF (.glb).|No, default `false`|
|`-s`, `--separate`|Writes out separate buffers and textures instead of embedding them in the glTF file.|No, default `false`|
|`-t`, `--separateTextures`|Write out separate textures only.|No, default `false`|
|`--checkTransparency`|Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel. By default textures are considered to be opaque.|No, default `false`|
|`--secure`|Prevent the converter from reading texture or mtl files outside of the input obj directory.|No, default `false`|
|`--packOcclusion`|Pack the occlusion texture in the red channel of metallic-roughness texture.|No, default `false`|
|`--metallicRoughness`|The values in the mtl file are already metallic-roughness PBR values and no conversion step should be applied. Metallic is stored in the Ks and map_Ks slots and roughness is stored in the Ns and map_Ns slots.|No, default `false`|
|`--specularGlossiness`|The values in the mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the `KHR_materials_pbrSpecularGlossiness` extension.|No, default `false`|
|`--materialsCommon`|The glTF will be saved with the KHR_materials_common extension.|No, default `false`|
|`--metallicRoughnessOcclusionTexture`|Path to the metallic-roughness-occlusion texture that should override textures in the .mtl file, where occlusion is stored in the red channel, roughness is stored in the green channel, and metallic is stored in the blue channel. The model will be saved with a pbrMetallicRoughness material. This is often convenient in workflows where the .mtl does not exist or is not set up to use PBR materials. Intended for models with a single material.|No|
|`--specularGlossinessTexture`|Path to the specular-glossiness texture that should override textures in the .mtl file, where specular color is stored in the red, green, and blue channels and specular glossiness is stored in the alpha channel. The model will be saved with a material using the KHR_materials_pbrSpecularGlossiness extension.|No|
|`--occlusionTexture`|Path to the occlusion texture that should override textures in the .mtl file.|No|
|`--normalTexture`|Path to the normal texture that should override textures in the .mtl file.|No|
|`--baseColorTexture`|Path to the baseColor/diffuse texture that should override textures in the .mtl file.|No|
|`--emissiveTexture`|Path to the emissive texture that should override textures in the .mtl file.|No|

## Build Instructions

Run the tests:
```
npm run test
```
To run ESLint on the entire codebase, run:
```
npm run eslint
```
To run ESLint automatically when a file is saved, run the following and leave it open in a console window:
```
npm run eslint-watch
```

## Running Test Coverage

Coverage uses [nyc](https://github.com/istanbuljs/nyc).  Run:
```
npm run coverage
```
For complete coverage details, open `coverage/lcov-report/index.html`.

The tests and coverage covers the Node.js module; it does not cover the command-line interface, which is tiny.

## Generating Documentation

To generate the documentation:
```
npm run jsdoc
```

The documentation will be placed in the `doc` folder.

## Contributions

Pull requests are appreciated.  Please use the same [Contributor License Agreement (CLA)](https://github.com/AnalyticalGraphicsInc/cesium/blob/master/CONTRIBUTING.md) used for [Cesium](http://cesiumjs.org/).

---

Developed by the Cesium team.
<p align="center">
<a href="http://cesiumjs.org/"><img src="doc/cesium.png" onerror="this.src='cesium.png'"/></a>
</p>
