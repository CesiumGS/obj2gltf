'use strict';
var loadTexture = require('../../lib/loadTexture');

var pngTexturePath = 'specs/data/box-complex-material/shininess.png';
var jpgTexturePath = 'specs/data/box-complex-material/emission.jpg';
var jpegTexturePath = 'specs/data/box-complex-material/specular.jpeg';
var gifTexturePath = 'specs/data/box-complex-material/ambient.gif';
var grayscaleTexturePath = 'specs/data/box-complex-material/alpha.png';
var transparentTexturePath = 'specs/data/box-complex-material/diffuse.png';

describe('loadTexture', function() {
    it('loads png texture', function(done) {
        expect(loadTexture(pngTexturePath)
            .then(function(texture) {
                expect(texture.transparent).toBe(false);
                expect(texture.source).toBeDefined();
                expect(texture.name).toBe('shininess');
                expect(texture.extension).toBe('.png');
                expect(texture.path).toBe(pngTexturePath);
                expect(texture.pixels).toBeUndefined();
                expect(texture.width).toBeUndefined();
                expect(texture.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads jpg texture', function(done) {
        expect(loadTexture(jpgTexturePath)
            .then(function(texture) {
                expect(texture.transparent).toBe(false);
                expect(texture.source).toBeDefined();
                expect(texture.name).toBe('emission');
                expect(texture.extension).toBe('.jpg');
                expect(texture.path).toBe(jpgTexturePath);
                expect(texture.pixels).toBeUndefined();
                expect(texture.width).toBeUndefined();
                expect(texture.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads jpeg texture', function(done) {
        expect(loadTexture(jpegTexturePath)
            .then(function(texture) {
                expect(texture.transparent).toBe(false);
                expect(texture.source).toBeDefined();
                expect(texture.name).toBe('specular');
                expect(texture.extension).toBe('.jpeg');
                expect(texture.path).toBe(jpegTexturePath);
                expect(texture.pixels).toBeUndefined();
                expect(texture.width).toBeUndefined();
                expect(texture.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads gif texture', function(done) {
        expect(loadTexture(gifTexturePath)
            .then(function(texture) {
                expect(texture.transparent).toBe(false);
                expect(texture.source).toBeDefined();
                expect(texture.name).toBe('ambient');
                expect(texture.extension).toBe('.gif');
                expect(texture.path).toBe(gifTexturePath);
                expect(texture.pixels).toBeUndefined();
                expect(texture.width).toBeUndefined();
                expect(texture.height).toBeUndefined();
            }), done).toResolve();
    });

    it('loads grayscale texture', function(done) {
        expect(loadTexture(grayscaleTexturePath)
            .then(function(texture) {
                expect(texture.transparent).toBe(false);
                expect(texture.source).toBeDefined();
                expect(texture.extension).toBe('.png');
            }), done).toResolve();
    });

    it('loads texture with alpha channel', function(done) {
        expect(loadTexture(transparentTexturePath)
            .then(function(texture) {
                expect(texture.transparent).toBe(false);
            }), done).toResolve();
    });

    it('loads texture with checkTransparency flag', function(done) {
        var options = {
            checkTransparency : true
        };
        expect(loadTexture(transparentTexturePath, options)
            .then(function(texture) {
                expect(texture.transparent).toBe(true);
            }), done).toResolve();
    });

    it('loads and decodes png', function(done) {
        var options = {
            decode : true
        };
        expect(loadTexture(pngTexturePath, options)
            .then(function(texture) {
                expect(texture.pixels).toBeDefined();
                expect(texture.width).toBe(211);
                expect(texture.height).toBe(211);
            }), done).toResolve();
    });

    it('loads and decodes jpeg', function(done) {
        var options = {
            decode : true
        };
        expect(loadTexture(jpegTexturePath, options)
            .then(function(texture) {
                expect(texture.pixels).toBeDefined();
                expect(texture.width).toBe(211);
                expect(texture.height).toBe(211);
            }), done).toResolve();
    });
});
