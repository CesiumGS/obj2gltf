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
|`-c`, `--compress`|Quantize positions, compress texture coordinates, and oct-encode normals.|No, default `false`|
|`-z`, `--optimize`|Use the optimization stages in the glTF pipeline.|No, default `false`|
|`-n`, `--generateNormals`|Generate normals if they are missing.|No, default `false`|
|`--optimizeForCesium`|Optimize the glTF for Cesium by using the sun as a default light source.|No, default `false`|
|`--ao`|Apply ambient occlusion to the converted model.|No, default `false`|
|`--kmc`|Output glTF with the KHR_materials_common extension.|No, default `false`|
|`--bypassPipeline`|Bypass the gltf-pipeline for debugging purposes. This option overrides many of the options above and will save the glTF with the KHR_materials_common extension.|No, default `false`|
|`--checkTransparency`|Do a more exhaustive check for texture transparency by looking at the alpha channel of each pixel. By default textures are considered to be opaque.|No, default `false`|
|`--secure`|Prevent the converter from reading image or mtl files outside of the input obj directory.|No, default `false`|
|`--inputUpAxis`|Up axis of the obj. Choices are 'X', 'Y', and 'Z'.|No, default `Y`|
|`--outputUpAxis`|Up axis of the converted glTF. Choices are 'X', 'Y', and 'Z'.|No, default `Y`|

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

Coverage uses [istanbul](https://github.com/gotwarlost/istanbul).  Run:
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
