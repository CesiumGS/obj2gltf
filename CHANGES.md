Change Log
==========

### 1.4.0
* Fixed greyscale images loading as alpha instead of luminance. [#144](https://github.com/AnalyticalGraphicsInc/obj2gltf/pull/144)

### 1.3.1 2018-03-28
* Maintenance release to update major version Node dependencies.

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
