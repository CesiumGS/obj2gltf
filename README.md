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
var convert = obj2gltf.convert;
var options = {
    embedImage : false // Don't embed image in the converted glTF
}
convert('model.obj', 'model.gltf', options)
    .then(function() {
        console.log('Converted model');
    });
```
Using obj2gltf as a command-line tool:

`node bin/obj2gltf.js model.obj`

`node bin/obj2gltf.js model.obj model.gltf`

`node bin/obj2gltf.js -i model.obj -o model.gltf`

`node bin/obj2gltf.js -i model.obj -o model.gltf -s`


## Usage

###Command line flags:

|Flag|Description|Required|
|----|-----------|--------|
|`-i`|Path to the input OBJ file.| :white_check_mark: Yes|
|`-o`|Directory or filename for the exported glTF file.|No|
|`-b`|Output binary glTF.|No, default `false`|
|`-s`|Writes out separate geometry/animation data files, shader files, and textures instead of embedding them in the glTF file.|No, default `false`|
|`-p`|Use the optimization stages in the glTF pipeline|No, default `false`|
|`-t`|Write out separate textures only.|No, default `false`|
|`--ao`|Apply ambient occlusion to the converted model.|No, default `false`|
|`-h`|Display help|No|

## Contributions

Pull requests are appreciated.  Please use the same [Contributor License Agreement (CLA)](https://github.com/AnalyticalGraphicsInc/cesium/blob/master/CONTRIBUTING.md) used for [Cesium](http://cesiumjs.org/).

---

Developed by the Cesium team.
<p align="center">
<a href="http://cesiumjs.org/"><img src="doc/cesium.png" /></a>
</p>
