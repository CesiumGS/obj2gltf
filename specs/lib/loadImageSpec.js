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
            .then(function(image) {
                expect(image.transparent).toBe(false);
                expect(image.source).toBeDefined();
                expect(image.extension).toBe('.png');
                expect(image.path).toBe(pngImage);
                expect(image.decoded).toBeUndefined();
                expect(image.width).toBeUndefined();
                expect(image.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads jpg image', function(done) {
        expect(loadImage(jpgImage)
            .then(function(image) {
                expect(image.transparent).toBe(false);
                expect(image.source).toBeDefined();
                expect(image.extension).toBe('.jpg');
                expect(image.decoded).toBeUndefined();
                expect(image.width).toBeUndefined();
                expect(image.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads jpeg image', function(done) {
        expect(loadImage(jpegImage)
            .then(function(image) {
                expect(image.transparent).toBe(false);
                expect(image.source).toBeDefined();
                expect(image.extension).toBe('.jpeg');
                expect(image.decoded).toBeUndefined();
                expect(image.width).toBeUndefined();
                expect(image.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads gif image', function(done) {
        expect(loadImage(gifImage)
            .then(function(image) {
                expect(image.transparent).toBe(false);
                expect(image.source).toBeDefined();
                expect(image.extension).toBe('.gif');
                expect(image.decoded).toBeUndefined();
                expect(image.width).toBeUndefined();
                expect(image.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads grayscale image', function(done) {
        expect(loadImage(grayscaleImage)
            .then(function(image) {
                expect(image.transparent).toBe(false);
                expect(image.source).toBeDefined();
                expect(image.extension).toBe('.png');
            }), done).toResolve();
    });

    it('loads image with alpha channel', function(done) {
        expect(loadImage(transparentImage)
            .then(function(image) {
                expect(image.transparent).toBe(false);
            }), done).toResolve();
    });

    it('loads image with checkTransparency flag', function(done) {
        var options = {
            checkTransparency : true
        };

        expect(loadImage(transparentImage, options)
            .then(function(image) {
                expect(image.transparent).toBe(true);
            }), done).toResolve();
    });

    it('loads and decodes png', function(done) {
        var options = {
            decode : true
        };

        expect(loadImage(pngImage, options)
            .then(function(image) {
                expect(image.decoded).toBeDefined();
                expect(image.width).toBe(211);
                expect(image.height).toBe(211);
            }), done).toResolve();
    });

    it('loads and decodes jpeg', function(done) {
        var options = {
            decode : true
        };

        expect(loadImage(jpegImage, options)
            .then(function(image) {
                expect(image.decoded).toBeDefined();
                expect(image.width).toBe(211);
                expect(image.height).toBe(211);
            }), done).toResolve();
    });
});
