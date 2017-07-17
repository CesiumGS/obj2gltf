'use strict';
var loadImage = require('../../lib/loadImage');

var pngImage = 'specs/data/box-complex-material/shininess.png';
var jpgImage = 'specs/data/box-complex-material/emission.jpg';
var jpegImage = 'specs/data/box-complex-material/specular.jpeg';
var gifImage = 'specs/data/box-complex-material/ambient.gif';
var grayscaleImage = 'specs/data/box-complex-material/alpha.png';
var transparentImage = 'specs/data/box-complex-material/diffuse.png';

describe('loadImage', function() {
    it('loads png image', function(done) {
        expect(loadImage(pngImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.png');
                expect(info.path).toBe(pngImage);
                expect(info.decoded).toBeUndefined();
                expect(info.width).toBeUndefined();
                expect(info.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads jpg image', function(done) {
        expect(loadImage(jpgImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.jpg');
                expect(info.decoded).toBeUndefined();
                expect(info.width).toBeUndefined();
                expect(info.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads jpeg image', function(done) {
        expect(loadImage(jpegImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.jpeg');
                expect(info.decoded).toBeUndefined();
                expect(info.width).toBeUndefined();
                expect(info.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads gif image', function(done) {
        expect(loadImage(gifImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.gif');
                expect(info.decoded).toBeUndefined();
                expect(info.width).toBeUndefined();
                expect(info.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads grayscale image', function(done) {
        expect(loadImage(grayscaleImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
                expect(info.source).toBeDefined();
                expect(info.extension).toBe('.png');
            }), done).toResolve();
    });

    it('loads image with alpha channel', function(done) {
        expect(loadImage(transparentImage)
            .then(function(info) {
                expect(info.transparent).toBe(false);
            }), done).toResolve();
    });

    it('loads image with checkTransparency flag', function(done) {
        var options = {
            checkTransparency : true
        };

        expect(loadImage(transparentImage, options)
            .then(function(info) {
                expect(info.transparent).toBe(true);
            }), done).toResolve();
    });

    it('loads and decodes png', function(done) {
        var options = {
            decode : true
        };

        expect(loadImage(pngImage, options)
            .then(function(info) {
                expect(info.decoded).toBeDefined();
                expect(info.width).toBe(211);
                expect(info.height).toBe(211);
            }), done).toResolve();
    });

    it('loads and decodes jpeg', function(done) {
        var options = {
            decode : true
        };

        expect(loadImage(jpegImage, options)
            .then(function(info) {
                expect(info.decoded).toBeDefined();
                expect(info.width).toBe(211);
                expect(info.height).toBe(211);
            }), done).toResolve();
    });
});
