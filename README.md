# OBJ2GLTF

Convert OBJ assets to [glTF](https://www.khronos.org/gltf) 1.0.

## Getting Started

Install [Node.js](https://nodejs.org/en/) if you don't already have it, clone this repo, and then:
```
cd OBJ2GLTF
npm install
```
Run `node bin/obj2gltf.js` and pass it the path to an OBJ file.

## Usage

###Command line flags:

|Flag|Description|Required|
|----|-----------|--------|
|`-i`|Path to the input OBJ file.| :white_check_mark: Yes|
|`-o`|Directory or filename for the exported glTF file.|No|
|`-e`|Embed glTF resources, including images, into the exported glTF file.|No, default `false`|
|`-h`|Display help|No|

###Examples:

`node bin/obj2gltf.js model.obj`

`node bin/obj2gltf.js model.obj model.gltf`

`node bin/obj2gltf.js -i model.obj -o model.gltf`

`node bin/obj2gltf.js -i model.obj -o model.gltf -e`

## Contributions

Pull requests are appreciated.  Please use the same [Contributor License Agreement (CLA)](https://github.com/AnalyticalGraphicsInc/cesium/blob/master/CONTRIBUTING.md) used for [Cesium](http://cesiumjs.org/).

---

Developed by the Cesium team.
<p align="center">
<a href="http://cesiumjs.org/"><img src="doc/cesium.png" /></a>
</p>
