"use strict";
var async = require('async');
var fs = require('fs-extra');
var path = require('path');
var readline = require('readline');
var loadImage = require('./image');
var Material = require('./mtl');
var Cesium = require('cesium');
var Cartesian3 = Cesium.Cartesian3;
var defined = Cesium.defined;

module.exports = parseObj;

// OBJ regex patterns are from ThreeJS (https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/OBJLoader.js)

function parseObj(objFile, inputPath, done) {
    getObjInfo(objFile, inputPath, function(info, materials, images) {
        processObj(objFile, info, materials, images, done);
    });
}

function processObj(objFile, info, materials, images, done) {
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
    var positionMax = [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE];

    var hasNormals = info.hasNormals;
    var hasUVs = info.hasUVs;

    var materialGroups = {}; // Map material to index array
    var currentIndexArray;

    // Switch to the material-specific index array, or create it if it doesn't exist
    function useMaterial(material) {
        if (!defined(materials[material])) {
            useDefaultMaterial();
        } else {
            currentIndexArray = materialGroups[material];
            if (!defined(currentIndexArray)) {
                currentIndexArray = [];
                materialGroups[material] = currentIndexArray;
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

    function getOffset(a, data, components) {
        var i = parseInt(a);
        if (i < 0) {
            // Negative vertex indexes reference the vertices immediately above it
            return (data.length / components + i) * components;
        }
        return (i - 1) * components;
    }

    function createVertex(p, u, n) {
        // Positions
        var pi = getOffset(p, positions, 3);
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
            var ni = getOffset(n, normals, 3);
            var nx = normals[ni + 0];
            var ny = normals[ni + 1];
            var nz = normals[ni + 2];
            vertexArray.push(nx, ny, nz);
        }

        // UVs
        if (hasUVs) {
            if (defined(u)) {
                var ui = getOffset(u, uvs, 2);
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
        }

        return index;
    }

    function addFace(v1, p1, u1, n1, v2, p2, u2, n2, v3, p3, u3, n3, v4, p4, u4, n4) {
        var index1 = addVertex(v1, p1, u1, n1);
        var index2 = addVertex(v2, p2, u2, n2);
        var index3 = addVertex(v3, p3, u3, n3);

        currentIndexArray.push(index1);
        currentIndexArray.push(index2);
        currentIndexArray.push(index3);

        // Triangulate if the face is a quad
        if (defined(v4)) {
            var index4 = addVertex(v4, p4, u4, n4);
            currentIndexArray.push(index1);
            currentIndexArray.push(index3);
            currentIndexArray.push(index4);
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
    var facePattern2 = /f( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)( +(-?\d+)\/(-?\d+)\/?)?/;

    // f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...
    var facePattern3 = /f( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))( +(-?\d+)\/(-?\d+)\/(-?\d+))?/;

    // f vertex//normal vertex//normal vertex//normal ...
    var facePattern4 = /f( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))( +(-?\d+)\/\/(-?\d+))?/;

    var stream = fs.createReadStream(objFile, 'utf8');
    var reader = readline.createInterface({
        input : stream
    });

    reader.on('line', function(line) {
        line = line.trim();
        var result;
        if ((line.length === 0) || (line.charAt(0) === '#')) {
            // Nothing to process
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
            var normal = Cartesian3.normalize(new Cartesian3(nx, ny, nz), new Cartesian3());
            normals.push(normal.x, normal.y, normal.z);
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
    });

    reader.on('close', function() {
        done({
            vertexCount : vertexCount,
            vertexArray : vertexArray,
            positionMin : positionMin,
            positionMax : positionMax,
            hasUVs : hasUVs,
            hasNormals : hasNormals,
            materialGroups : materialGroups,
            materials : materials,
            images : images
        });
    });
}

function getImages(inputPath, materials, done) {
    // Collect all the image files from the materials
    var images = [];
    for (var name in materials) {
        if (materials.hasOwnProperty(name)) {
            var material = materials[name];
            if (defined(material.ambientColorMap) && (images.indexOf(material.ambientColorMap) === -1)) {
                images.push(material.ambientColorMap);
            }
            if (defined(material.diffuseColorMap) && (images.indexOf(material.diffuseColorMap) === -1)) {
                images.push(material.diffuseColorMap);
            }
            if (defined(material.emissionColorMap) && (images.indexOf(material.emissionColorMap) === -1)) {
                images.push(material.emissionColorMap);
            }
            if (defined(material.specularColorMap) && (images.indexOf(material.specularColorMap) === -1)) {
                images.push(material.specularColorMap);
            }
        }
    }

    // Load the image files
    var imagesInfo = {};
    async.each(images, function (image, callback) {
        var imagePath = image;
        if (!path.isAbsolute(imagePath)) {
            imagePath = path.join(inputPath, image);
        }
        loadImage(imagePath, function(info) {
            var uri = 'data:application/octet-stream;base64,' + info.data.toString('base64');
            imagesInfo[image] = {
                transparent : info.transparent,
                channels : info.channels,
                uri : uri
            };
            callback();
        });
    }, function (error) {
        if (error) {
            throw error;
        }
        done(imagesInfo);
    });
}

function getMaterials(mtlPath, hasMaterialGroups, done) {
    if (!hasMaterialGroups) {
        done({});
        return;
    }

    if (defined(mtlPath)) {
        Material.parse(mtlPath, function(materials) {
            done(materials);
        });
    } else {
        done({});
    }
}

function getObjInfo(objFile, inputPath, done) {
    var mtlPath;
    var hasMaterialGroups = false;
    var hasPositions = false;
    var hasNormals = false;
    var hasUVs = false;

    var stream = fs.createReadStream(objFile, 'utf8');
    var reader = readline.createInterface({
        input : stream
    });

    reader.on('line', function(line) {
        if (!defined(mtlPath)) {
            var mtllibMatches = line.match(/^mtllib.*/gm);
            if (mtllibMatches !== null) {
                var mtlFile = mtllibMatches[0].substring(7).trim();
                mtlPath = mtlFile;
                if (!path.isAbsolute(mtlPath)) {
                    mtlPath = path.join(inputPath, mtlFile);
                }
            }
        }
        if (!hasMaterialGroups) {
            hasMaterialGroups = /^usemtl/gm.test(line);
        }
        if (!hasPositions) {
            hasPositions = /^v\s/gm.test(line);
        }
        if (!hasNormals) {
            hasNormals = /^vn/gm.test(line);
        }
        if (!hasUVs) {
            hasUVs = /^vt/gm.test(line);
        }
    });

    reader.on('close', function() {
        if (!hasPositions) {
            throw new Error('Could not process OBJ file, no positions.');
        }
        var info = {
            hasNormals : hasNormals,
            hasUVs : hasUVs
        };
        getMaterials(mtlPath, hasMaterialGroups, function(materials) {
            getImages(inputPath, materials, function(images) {
                done(info, materials, images);
            });
        });
    });
}
