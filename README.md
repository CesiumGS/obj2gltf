# OBJ2GLTF

Convert OBJ assets to [glTF](https://www.khronos.org/gltf) 1.0.

## Getting Started

Install [Node.js](https://nodejs.org/en/) if you don't already have it, and then:
```
npm install --save obj2gltf
```
Using obj2gltf as a library:
```javascript
var obj2gltf = require('obj2gltf');
var options = {
    separateTextures : true // Don't embed textures in the converted glTF
}
obj2gltf('model.obj', 'model.gltf', options)
    .then(function() {
        console.log('Converted model');
    });
```
Using obj2gltf as a command-line tool:

`node bin/obj2gltf.js -i model.obj`

`node bin/obj2gltf.js -i model.obj -o model.gltf`

## Usage

### Command line flags:

|Flag|Description|Required|
|----|-----------|--------|
|`-h`, `--help`|Display help.|No|
|`-i`, `--input`|Path to the obj file.| :white_check_mark: Yes|
|`-o`, `--output`|Path of the converted glTF file.|No|
|`-b`, `--binary`|Save as binary glTF.|No, default `false`|
|`-s`, `--separate`|Writes out separate geometry data files, shader files, and textures instead of embedding them in the glTF file.|No, default `false`|
|`-t`, `--separateTextures`|Write out separate textures only.|No, default `false`|
|`--checkTransparency`|Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel. By default textures are considered to be opaque.|No, default `false`|
|`--secure`|Prevent the converter from reading image or mtl files outside of the input obj directory.|No, default `false`|
|`--inputUpAxis`|Up axis of the obj. Choices are 'X', 'Y', and 'Z'.|No, default `Y`|
|`--outputUpAxis`|Up axis of the converted glTF. Choices are 'X', 'Y', and 'Z'.|No, default `Y`|
|`--packOcclusion`|Pack the occlusion texture in the red channel of metallic-roughness texture.|No, default `false`|
|`--metallicRoughness`|The values in the mtl file are already metallic-roughness PBR values and no conversion step should be applied. Metallic is stored in the Ks and map_Ks slots and roughness is stored in the Ns and map_Ns slots.|No, default `false`|
|`--specularGlossiness`|The values in the mtl file are already specular-glossiness PBR values and no conversion step should be applied. Specular is stored in the Ks and map_Ks slots and glossiness is stored in the Ns and map_Ns slots. The glTF will be saved with the `KHR_materials_pbrSpecularGlossiness` extension.|No, default `false`|
|`--materialsCommon`|The glTF will be saved with the KHR_materials_common extension.|No, default `false`|
|`--metallicRoughnessOcclusionTexture`|Path to the metallic-roughness-occlusion texture used by the model, where occlusion is stored in the red channel, roughness is stored in the green channel, and metallic is stored in the blue channel. This may be used instead of setting texture paths in the .mtl file. The model will be saved with a pbrMetallicRoughness material.
|`--specularGlossinessTexture`|Path to the specular-glossiness texture used by the model, where specular color is stored in the red, green, and blue channels and specular glossiness is stored in the alpha channel. This may be used instead of setting texture paths in the .mtl file. The model will be saved with a material using the KHR_materials_pbrSpecularGlossiness extension.
|`--occlusionTexture`|Path to the occlusion texture used by the model. This may be used instead of setting texture paths in the .mtl file. Ignored if metallicRoughnessOcclusionTexture is also set.
|`--normalTexture`|Path to the normal texture used by the model. This may be used instead of setting texture paths in the .mtl file.
|`--baseColorTexture`|Path to the baseColor/diffuse texture used by the model. This may be used instead of setting texture paths in the .mtl file.
|`--emissiveTexture`|Path to the emissive texture used by the model. This may be used instead of setting texture paths in the .mtl file.

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

## Debugging

* To debug the tests in Webstorm, open the Gulp tab, right click the `test` task, and click `Debug 'test'`.
* To run a single test, change the test function from `it` to `fit`.

## Contributions

Pull requests are appreciated.  Please use the same [Contributor License Agreement (CLA)](https://github.com/AnalyticalGraphicsInc/cesium/blob/master/CONTRIBUTING.md) used for [Cesium](http://cesiumjs.org/).

---

Developed by the Cesium team.
<p align="center">
<a href="http://cesiumjs.org/"><img src="doc/cesium.png" onerror="this.src='cesium.png'"/></a>
</p>
