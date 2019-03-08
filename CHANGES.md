Change Log
==========

### 3.0.1 2019-03-08

* Fixed handling of materials that don't have names. [#173](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/173)

### 3.0.0 2018-12-05

* Breaking changes
    * The `--materialsCommon` flag has been removed. Use `--unlit` instead which uses the `KHR_materials_unlit` extension. [#152](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/152)

### 2.3.2 2018-11-02

* Improved handling of primitives with different attributes using the same material. Materials are now duplicated. [#162](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/162)
* Fixed a bug where primitives without texture coordinates could use materials containing textures. Those textures are now removed. [#162](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/162)
* Improved parsing of faces with mismatching attributes. [#161](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/161)

### 2.3.1 2018-10-16

* Improved parsing models with concave or n-sided faces. [#157](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/157)
* Fixed handling of objs with interleaved materials. [#155](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/155)

### 2.3.0 2018-09-19

* Fixed handling of objs with mismatching attribute layouts. [#153](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/153)
* Fixed normalization of Windows paths when running the converter on Linux. [#150](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/150)
* Added ability to use the first material in the mtl file when the obj is missing `usemtl`. [#133](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/133)
* Fixed handling of unnormalized input normals. [#136](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/136)

### 2.2.0 2018-01-29

* Fixed handling of materials where the diffuse and ambient texture are the same. [#127](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/127)
* Added ability to load alpha textures. [#124](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/124)
* Fixed handling of `usemtl` when appearing before an `o` or `g` token. [#123](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/123)
* Fixed output name when running from the command line. [#126](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/126)

### 2.1.0 2017-12-28

* Fixed loading faces that contain less than 3 vertices. [#120](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/120)
* Attempt to load missing materials and textures from within the same directory as the obj. [#117](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/117)
* Fixed loading mtllib paths that contain spaces. [#116](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/116)
* Fixed checking for transparency when the diffuse texture is used in another texture slot. [#115](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/115)
* Fixed parsing mtl textures that contain texture map options. [#109](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/109)
* Added back support for the `CONSTANT` technique when a model uses the `KHR_materials_common` extension and has no normals. [#108](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/108)
* Improved handling of materials with alpha. If the alpha value is 0.0 it is now treated as 1.0. [#107](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/107)

### 2.0.0 2017-08-11

* Breaking changes
    * Obj models now convert to glTF 2.0. Possible material profiles are `metallicRoughness`, `specGlossiness` (using the `KHR_materials_pbrSpecularGlossiness` extension), and `materialsCommon` (using the `KHR_materials_common` extension).
    * Removed `gltf-pipeline` dependency. The following options have been removed: `compress`, `optimize`, `generateNormals`, `optimizeForCesium`, `ao`, and `bypassPipeline`.
    * Removed `inputUpAxis` and `outputUpAxis`. This stage will be incorporated into `gltf-pipeline` instead.
    * `obj2gltf` no longer takes a `gltfPath` argument and saves a glTF file. Instead it returns a promise that resolves to the glTF JSON or glb buffer.

### 1.3.0 2017-08-11

* Fixed parsing models with concave or n-sided faces. [#85](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/85)
* Fixed parsing models with line breaks. [#85](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/85)

### 1.2.0 2017-07-11

* Change texture sampling to use `NEAREST_MIPMAP_LINEAR` by default. [#83](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/83).
* Fixed lighting when generating normals. [#89](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/89)

### 1.1.1 2017-04-25

* Fixed `CHANGES.md` formatting.

### 1.1.0 2017-04-25

* Added ability to convert the up-axis of the obj model. [#68](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/68)
* Fixed issues with an extra .bin file being saved when using `--separate`. [#62](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/62)
* Fixed issue where an ambient color of `[1, 1, 1]` overly brightens the converted model. [#70](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/70)

### 1.0.0 2017-04-13

* Breaking changes
    * To use `obj2gltf` as a library, call `require('obj2gltf')(input, output, options)`. The previous calling code was `require('obj2gltf').convert(input, output, options)`.
    * Many library options and command-line parameters have been renamed.
* Project cleanup. [#49](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/49)
    * Speed improvements, especially for larger models.
    * Preserves the objects and groups in the obj.
    * Added documentation and tests.
    * Material fixes.

### 0.1.7 2017-01-06

* Update gltf-pipeline to 0.1.0-alpha9
* Added command to generate documentation (npm run jsdoc)

### 0.1.6 2016-09-07

* Changed obj2gltf.js line endings from CRLF to LF in npm package.

### 0.1.5 2016-08-26

* Fixed incorrect parameter to the gltf-pipeline.

### 0.1.4 2016-08-25

* Added compression flag for quantizing positions, compressing texture coordinates, and oct-encoding normals.

### 0.1.3 - 2016-08-08

* Fixed a bug causing models with no mtl file to not convert.

### 0.1.2 - 2016-07-25

* Converted the API to now use promises instead of callbacks. [#21](https://github.com/AnalyticalGraphicsInc/OBJ2GLTF/pull/21)
* Added the ability to optimize the converted glTF for Cesium by using the sun as a default light source.

### 0.1.1 - 2016-07-21

* Updated to use gltf-pipeline 0.1.0-alpha2.

### 0.1.0 - 2016-07-20

* Initial release.
