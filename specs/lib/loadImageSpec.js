'use strict';
var Cesium = require('cesium');
var obj2gltf = require('../../lib/obj2gltf');
var loadImage = require('../../lib/loadImage');

var clone = Cesium.clone;
var WebGLConstants = Cesium.WebGLConstants;

var pngImage = 'specs/data/box-complex-material/shininess.png';
var jpgImage = 'specs/data/box-complex-material/emission.jpg';
var jpegImage = 'specs/data/box-complex-material/specular.jpeg';
var gifImage = 'specs/data/box-complex-material/ambient.gif';
var grayscaleImage = 'specs/data/box-complex-material/alpha.png';
var transparentImage = 'specs/data/box-complex-material/diffuse.png';

var defaultOptions = obj2gltf.defaults;

describe('loadImage', function() {
    it('loads png image', function(done) {
        expect(loadImage(pngImage, defaultOptions)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.RGB);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.png');
            }), done).toResolve();
    });

    it('loads jpg image', function(done) {
        expect(loadImage(jpgImage, defaultOptions)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.RGB);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.jpg');
            }), done).toResolve();
    });

    it('loads jpeg image', function(done) {
        expect(loadImage(jpegImage, defaultOptions)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.RGB);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.jpeg');
            }), done).toResolve();
    });

    it('loads gif image', function(done) {
        expect(loadImage(gifImage, defaultOptions)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.RGB);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.gif');
            }), done).toResolve();
    });

    it('loads grayscale image', function(done) {
        expect(loadImage(grayscaleImage, defaultOptions)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.ALPHA);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.png');
            }), done).toResolve();
    });

    it('loads image with alpha channel', function(done) {
        expect(loadImage(transparentImage, defaultOptions)
            .then(function(info) {
                expect(info.transparent).toBe(false);
            }), done).toResolve();
    });

    it('loads image with checkTransparency flag', function(done) {
        var options = clone(defaultOptions);
        options.checkTransparency = true;

        expect(loadImage(transparentImage, options)
            .then(function(info) {
                expect(info.transparent).toBe(true);
            }), done).toResolve();
    });
});
