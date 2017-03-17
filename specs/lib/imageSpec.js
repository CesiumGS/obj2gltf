'use strict';
var Cesium = require('cesium');
var path = require('path');
var loadImage = require('../../lib/image.js');

var WebGLConstants = Cesium.WebGLConstants;

var pngImage = 'specs/data/box-complex-material/shininess.png';
var jpgImage = 'specs/data/box-complex-material/emission.jpg';
var jpegImage = 'specs/data/box-complex-material/specular.jpeg';
var gifImage = 'specs/data/box-complex-material/ambient.gif';
var grayscaleImage = 'specs/data/box-complex-material/alpha.png';
var transparentImage = 'specs/data/box-complex-material/diffuse.png';
var opaqueAlphaImage = 'specs/data/box-complex-material/bump.png';
var invalidImage = 'invalid.png';

describe('image', function() {
    it('loads png image', function(done) {
        expect(loadImage(pngImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.RGB);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.png');
            }), done).toResolve();
    });

    it('loads jpg image', function(done) {
        expect(loadImage(jpgImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.RGB);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.jpg');
            }), done).toResolve();
    });

    it('loads jpeg image', function(done) {
        expect(loadImage(jpegImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.RGB);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.jpeg');
            }), done).toResolve();
    });

    it('loads gif image', function(done) {
        expect(loadImage(gifImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.RGB);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.gif');
            }), done).toResolve();
    });

    it('loads grayscale image', function(done) {
        expect(loadImage(grayscaleImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.format).toBe(WebGLConstants.ALPHA);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.png');
            }), done).toResolve();
    });

    it('loads transparent image', function(done) {
        expect(loadImage(transparentImage)
            .then(function(info) {
                expect(info.transparent).toBe(true);
                expect(info.format).toBe(WebGLConstants.RGBA);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.png');
            }), done).toResolve();
    });

    it('loads image with fully opaque alpha channel', function(done) {
        expect(loadImage(opaqueAlphaImage)
            .then(function(info) {
                expect(info.transparent).toBe(true);
            }), done).toResolve();
    });

    it('loads image with fully opaque alpha channel with checkTextureAlpha flag', function(done) {
        var options = {
            checkTextureAlpha : true
        };
        expect(loadImage(opaqueAlphaImage, options)
            .then(function(info) {
                expect(info.transparent).toBe(false);
            }), done).toResolve();
    });

    it('handles invalid image file', function(done) {
        spyOn(console, 'log');
        expect(loadImage(invalidImage)
            .then(function(image) {
                expect(image).toBeUndefined();
                expect(console.log.calls.argsFor(0)[0].indexOf('Could not read image file') >= 0).toBe(true);
            }), done).toResolve();
    });
});
