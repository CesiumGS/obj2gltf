"use strict";
var fs = require('fs');
var path = require('path');
var Material = require('./mtl');
var util = require('./util');
var defined = util.defined;
var normalize = util.normalize;
var faceNormal = util.faceNormal;

module.exports = parseObj;

// OBJ regex patterns are from ThreeJS (https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/OBJLoader.js)

function getMaterials(contents, inputPath, done) {
    var hasMaterialGroups = /^usemtl/gm.test(contents);
    if (!hasMaterialGroups) {
        done({});
        return;
    }

    var mtllibMatches = contents.match(/^mtllib.*/gm);
    if (mtllibMatches === null) {
        done({});
    } else {
        var mtlFile = mtllibMatches[0].substring(7).trim();
        var mtlPath = mtlFile;
        if (!path.isAbsolute(mtlPath)) {
            mtlPath = path.join(inputPath, mtlFile);
        }

        Material.parse(mtlPath, function (materials) {
            done(materials);
        });
    }
}

function parseObj(objFile, inputPath, done) {
    fs.readFile(objFile, 'utf-8', function (err, contents) {
        if (err) {
            throw err;
        }

        getMaterials(contents, inputPath, function (materials) {
            var i, length;

            // A vertex is specified by indexes into each of the attribute arrays,
            // but these indexes may be different. This maps the separate indexes to a single index.
            var vertexCache = {};
            var vertexCount = 0;

            var vertexArray = [];

            var positions = [];
            var normals = [];
            var uvs = [];

            var positionMin = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
            var positionMax = [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];

            var hasPositions = /^v\s/gm.test(contents);
            var hasNormals = /^vn/gm.test(contents);
            var hasUVs = /^vt/gm.test(contents);

            if (!hasPositions) {
                console.log('Error: could not process OBJ file, no positions.');
                process.exit(1);
            }

            // Auto-generate normals if they are missing from the obj file
            var generateNormals = !hasNormals;
            var vertexLocations = [];
            var vertexNormals;
            if (generateNormals) {
                var locations = contents.match(/^v\s/gm).length;
                vertexNormals = new Array(locations*3);
                for (i = 0; i < locations; ++i) {
                    vertexNormals[i * 3 + 0] = 0;
                    vertexNormals[i * 3 + 1] = 0;
                    vertexNormals[i * 3 + 2] = 0;
                }
            }

            // Map material to index array
            var materialGroups = {};
            var matIndexArray;

            // Switch to the material-specific index array, or create it if it doesn't exist
            function useMaterial(material) {
                if (!defined(materials[material])) {
                    useDefaultMaterial();
                } else {
                    matIndexArray = materialGroups[material];
                    if (!defined(matIndexArray)) {
                        matIndexArray = [];
                        materialGroups[material] = matIndexArray;
                    }
                }
            }

            function useDefaultMaterial() {
                var defaultMaterial = 'czmDefaultMat';
                if (!defined(materials[defaultMaterial])) {
                    materials[defaultMaterial] = Material.getDefault();
                }
                useMaterial(defaultMaterial);
            }

            var materialsLength = Object.keys(materials).length;
            if (materialsLength === 0) {
                useDefaultMaterial();
            }

            function createVertex(p, u, n) {
                // Positions
                var pi = (parseInt(p) - 1) * 3;
                var px = positions[pi + 0];
                var py = positions[pi + 1];
                var pz = positions[pi + 2];
                positionMin[0] = Math.min(px, positionMin[0]);
                positionMin[1] = Math.min(py, positionMin[1]);
                positionMin[2] = Math.min(pz, positionMin[2]);
                positionMax[0] = Math.max(px, positionMax[0]);
                positionMax[1] = Math.max(py, positionMax[1]);
                positionMax[2] = Math.max(pz, positionMax[2]);
                vertexArray.push(px, py, pz);

                // Normals
                if (hasNormals) {
                    var ni = (parseInt(n) - 1) * 3;
                    var nx = normals[ni + 0];
                    var ny = normals[ni + 1];
                    var nz = normals[ni + 2];
                    vertexArray.push(nx, ny, nz);
                } else {
                    // Normals will be auto-generated later
                    vertexArray.push(0.0, 0.0, 0.0);
                }

                // UVs
                if (hasUVs) {
                    if (defined(u)) {
                        var ui = (parseInt(u) - 1) * 2;
                        var ux = uvs[ui + 0];
                        var uy = uvs[ui + 1];
                        vertexArray.push(ux, uy);
                    } else {
                        // Some objects in the model may not have uvs, fill with 0's for consistency
                        vertexArray.push(0.0, 0.0);
                    }
                }
            }

            function addVertex(v, p, u, n) {
                var index = vertexCache[v];
                if (!defined(index)) {
                    index = vertexCount++;
                    vertexCache[v] = index;
                    createVertex(p, u, n);

                    if (generateNormals) {
                        var pi = (parseInt(p) - 1);
                        vertexLocations.push(pi);
                    }
                }

                return index;
            }

            function addFace(v1, p1, u1, n1, v2, p2, u2, n2, v3, p3, u3, n3, v4, p4, u4, n4) {
                var index1 = addVertex(v1, p1, u1, n1);
                var index2 = addVertex(v2, p2, u2, n2);
                var index3 = addVertex(v3, p3, u3, n3);

                matIndexArray.push(index1);
                matIndexArray.push(index2);
                matIndexArray.push(index3);

                // Triangulate if the face is a quad
                if (defined(v4)) {
                    var index4 = addVertex(v4, p4, u4, n4);
                    matIndexArray.push(index1);
                    matIndexArray.push(index3);
                    matIndexArray.push(index4);
                }

                if (generateNormals) {
                    // Get face normal
                    var i1 = (parseInt(p1) - 1) * 3;
                    var i2 = (parseInt(p2) - 1) * 3;
                    var i3 = (parseInt(p3) - 1) * 3;
                    var normal = faceNormal(
                        positions[i1], positions[i1 + 1], positions[i1 + 2],
                        positions[i2], positions[i2 + 1], positions[i2 + 2],
                        positions[i3], positions[i3 + 1], positions[i3 + 2]
                    );

                    // Add face normal to each vertex normal
                    vertexNormals[i1 + 0] += normal[0];
                    vertexNormals[i1 + 1] += normal[1];
                    vertexNormals[i1 + 2] += normal[2];
                    vertexNormals[i2 + 0] += normal[0];
                    vertexNormals[i2 + 1] += normal[1];
                    vertexNormals[i2 + 2] += normal[2];
                    vertexNormals[i3 + 0] += normal[0];
                    vertexNormals[i3 + 1] += normal[1];
                    vertexNormals[i3 + 2] += normal[2];

                    if (defined(v4)) {
                        var i4 = (parseInt(p4) - 1) * 3;
                        vertexNormals[i4 + 0] += normal[0];
                        vertexNormals[i4 + 1] += normal[1];
                        vertexNormals[i4 + 2] += normal[2];
                    }
                }
            }

            // v float float float
            var vertexPattern = /v( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

            // vn float float float
            var normalPattern = /vn( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

            // vt float float
            var uvPattern = /vt( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

            // f vertex vertex vertex ...
            var facePattern1 = /f( +-?\d+)( +-?\d+)( +-?\d+)( +-?\d+)?/;

            // f vertex/uv vertex/uv vertex/uv ...
            var facePattern2 = /f( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+))?/;

            // f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...
            var facePattern3 = /f( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))?/;

            // f vertex//normal vertex//normal vertex//normal ...
            var facePattern4 = /f( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))?/;

            var lines = contents.split('\n');
            length = lines.length;
            for (i = 0; i < length; ++i) {
                var line = lines[i].trim();
                var result;
                if ((line.length === 0) || (line.charAt(0) === '#')) {
                    continue;
                } else if ((result = vertexPattern.exec(line)) !== null) {
                    positions.push(
                        parseFloat(result[1]),
                        parseFloat(result[2]),
                        parseFloat(result[3])
                    );
                } else if ((result = normalPattern.exec(line) ) !== null) {
                    var nx = parseFloat(result[1]);
                    var ny = parseFloat(result[2]);
                    var nz = parseFloat(result[3]);
                    var normal = normalize(nx, ny, nz);
                    normals.push(
                        normal[0],
                        normal[1],
                        normal[2]
                    );
                } else if ((result = uvPattern.exec(line)) !== null) {
                    uvs.push(
                        parseFloat(result[1]),
                        parseFloat(result[2])
                    );

                } else if ((result = facePattern1.exec(line)) !== null) {
                    addFace(
                        result[1], result[1], undefined, undefined,
                        result[2], result[2], undefined, undefined,
                        result[3], result[3], undefined, undefined,
                        result[4], result[4], undefined, undefined
                    );
                } else if ((result = facePattern2.exec(line)) !== null) {
                    addFace(
                        result[1], result[2], result[3], undefined,
                        result[4], result[5], result[6], undefined,
                        result[7], result[8], result[9], undefined,
                        result[10], result[11], result[12], undefined
                    );
                } else if ((result = facePattern3.exec(line)) !== null) {
                    addFace(
                        result[1], result[2], result[3], result[4],
                        result[5], result[6], result[7], result[8],
                        result[9], result[10], result[11], result[12],
                        result[13], result[14], result[15], result[16]
                    );
                } else if ((result = facePattern4.exec(line)) !== null) {
                    addFace(
                        result[1], result[2], undefined, result[3],
                        result[4], result[5], undefined, result[6],
                        result[7], result[8], undefined, result[9],
                        result[10], result[11], undefined, result[12]
                    );
                } else if (/^usemtl /.test(line)) {
                    var materialName = line.substring(7).trim();
                    useMaterial(materialName);
                }
            }

            if (generateNormals) {
                length = vertexLocations.length;
                for (i = 0; i < length; ++i) {
                    // Normalize normal
                    var index = vertexLocations[i] * 3;
                    var normal = normalize(
                        vertexNormals[index + 0],
                        vertexNormals[index + 1],
                        vertexNormals[index + 2]
                    );

                    // Set new normal in vertex array
                    var offset = i * (hasUVs ? 8 : 6) + 3;
                    vertexArray[offset + 0] = normal[0];
                    vertexArray[offset + 1] = normal[1];
                    vertexArray[offset + 2] = normal[2];
                }
            }

            done({
                vertexCount: vertexCount,
                vertexArray: vertexArray,
                positionMin : positionMin,
                positionMax : positionMax,
                hasUVs: hasUVs,
                materialGroups: materialGroups,
                materials: materials
            });
        });
    });
}
