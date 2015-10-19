"use strict";
var fs = require('fs');
var path = require('path');
var Material = require('./mtl');
var util = require('./util');
var defined = util.defined;
var defaultValue = util.defaultValue;

module.exports = parseObj;

// Obj regex patterns are from ThreeJS (https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/OBJLoader.js)

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
        var mtlPath = path.join(inputPath, mtlFile);
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
            // A vertex in a face is specified by indexes into each of the attribute arrays,
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
                console.log('Could not process obj file, no positions.');
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

            // Sometimes the obj will have objects with different vertex formats
            // e.g. one object has uvs, the other does not.
            // In this case, use default values.
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
                var ni = (parseInt(n) - 1) * 3;
                var nx = defaultValue(normals[ni + 0], 0.0);
                var ny = defaultValue(normals[ni + 1], 0.0);
                var nz = defaultValue(normals[ni + 2], 0.0);
                vertexArray.push(nx, ny, nz);

                // UVs
                if (hasUVs) {
                    var ui = (parseInt(u) - 1) * 2;
                    var ux = defaultValue(uvs[ui + 0], 0.0);
                    var uy = defaultValue(uvs[ui + 1], 0.0);
                    vertexArray.push(ux, uy);
                }
            }

            function addVertex(v, p, u, n) {
                var index = vertexCache[v];
                if (!defined(index)) {
                    index = vertexCount++;
                    vertexCache[v] = index;
                    createVertex(p, u, n);
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
            var length = lines.length;
            for (var i = 0; i < length; ++i) {
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
                    // Normalize
                    var nx = parseFloat(result[1]);
                    var ny = parseFloat(result[2]);
                    var nz = parseFloat(result[3]);
                    var magnitude = Math.sqrt(nx * nx + ny * ny + nz * nz);
                    nx /= magnitude;
                    ny /= magnitude;
                    nz /= magnitude;
                    normals.push(
                        nx,
                        ny,
                        nz
                    );
                } else if ((result = uvPattern.exec(line)) !== null) {
                    uvs.push(
                        parseFloat(result[1]),
                        parseFloat(result[2])
                    );

                } else if ((result = facePattern1.exec(line)) !== null) {
                    addFace(
                        result[1], result[1], 0, 0,
                        result[2], result[2], 0, 0,
                        result[3], result[3], 0, 0,
                        result[4], result[4], 0, 0
                    );
                } else if ((result = facePattern2.exec(line)) !== null) {
                    addFace(
                        result[1], result[2], result[3], 0,
                        result[4], result[5], result[6], 0,
                        result[7], result[8], result[9], 0,
                        result[10], result[11], result[12], 0
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
                        result[1], result[2], 0, result[3],
                        result[4], result[5], 0, result[6],
                        result[7], result[8], 0, result[9],
                        result[10], result[11], 0, result[12]
                    );
                } else if (/^usemtl /.test(line)) {
                    var materialName = line.substring(7).trim();
                    useMaterial(materialName);
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
