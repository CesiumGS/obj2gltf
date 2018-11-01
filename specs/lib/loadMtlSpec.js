'use strict';
var path = require('path');
var loadMtl = require('../../lib/loadMtl');

var complexMaterialAlphaUrl = 'specs/data/box-complex-material-alpha/box-complex-material-alpha.mtl';
var diffuseAmbientSameMaterialUrl = 'specs/data/box-diffuse-ambient-same/box-diffuse-ambient-same.mtl';
var multipleMaterialsUrl = 'specs/data/box-multiple-materials/box-multiple-materials.mtl';
var texturedWithOptionsMaterialUrl = 'specs/data/box-texture-options/box-texture-options.mtl';
var transparentMaterialUrl = 'specs/data/box-transparent/box-transparent.mtl';

function getImagePath(objPath, relativePath) {
    return path.normalize(path.join(path.dirname(objPath), relativePath));
}

describe('loadMtl', function() {
    it('loads complex material', function(done) {
        expect(loadMtl(complexMaterialAlphaUrl)
            .then(function(materials) {
                var material = materials.Material;
                expect(material).toBeDefined();
                expect(material.ambientColor).toEqual([0.2, 0.2, 0.2, 1.0]);
                expect(material.emissionColor).toEqual([0.1, 0.1, 0.1, 1.0]);
                expect(material.diffuseColor).toEqual([0.64, 0.64, 0.64, 1.0]);
                expect(material.specularColor).toEqual([0.5, 0.5, 0.5, 1.0]);
                expect(material.specularShininess).toEqual(96.078431);
                expect(material.alpha).toEqual(0.9);
                expect(material.ambientTexture).toEqual(getImagePath(complexMaterialAlphaUrl, 'ambient.gif'));
                expect(material.emissionTexture).toEqual(getImagePath(complexMaterialAlphaUrl, 'emission.jpg'));
                expect(material.diffuseTexture).toEqual(getImagePath(complexMaterialAlphaUrl, 'diffuse.png'));
                expect(material.specularTexture).toEqual(getImagePath(complexMaterialAlphaUrl, 'specular.jpeg'));
                expect(material.specularShininessMap).toEqual(getImagePath(complexMaterialAlphaUrl, 'shininess.png'));
                expect(material.normalMap).toEqual(getImagePath(complexMaterialAlphaUrl, 'bump.png'));
                expect(material.alphaMap).toEqual(getImagePath(complexMaterialAlphaUrl, 'alpha.png'));
            }), done).toResolve();
    });

    it('loads mtl with multiple materials', function(done) {
        expect(loadMtl(multipleMaterialsUrl)
            .then(function(materials) {
                expect(Object.keys(materials).length).toBe(3);
                expect(materials.Red.diffuseColor).toEqual([0.64, 0.0, 0.0, 1.0]);
                expect(materials.Green.diffuseColor).toEqual([0.0, 0.64, 0.0, 1.0]);
                expect(materials.Blue.diffuseColor).toEqual([0.0, 0.0, 0.64, 1.0]);
            }), done).toResolve();
    });

    it('loads mtl with textures having options', function(done) {
        expect(loadMtl(texturedWithOptionsMaterialUrl)
            .then(function(materials) {
                var material = materials.Material;
                expect(material).toBeDefined();
                expect(material.ambientColor).toEqual([0.2, 0.2, 0.2, 1.0]);
                expect(material.emissionColor).toEqual([0.1, 0.1, 0.1, 1.0]);
                expect(material.diffuseColor).toEqual([0.64, 0.64, 0.64, 1.0]);
                expect(material.specularColor).toEqual([0.5, 0.5, 0.5, 1.0]);
                expect(material.specularShininess).toEqual(96.078431);
                expect(material.alpha).toEqual(0.9);
                expect(material.ambientTexture).toEqual(getImagePath(texturedWithOptionsMaterialUrl, 'ambient.gif'));
                expect(material.emissionTexture).toEqual(getImagePath(texturedWithOptionsMaterialUrl, 'emission.jpg'));
                expect(material.diffuseTexture).toEqual(getImagePath(texturedWithOptionsMaterialUrl, 'diffuse.png'));
                expect(material.specularTexture).toEqual(getImagePath(texturedWithOptionsMaterialUrl, 'specular.jpeg'));
                expect(material.specularShininessMap).toEqual(getImagePath(texturedWithOptionsMaterialUrl, 'shininess.png'));
                expect(material.normalMap).toEqual(getImagePath(texturedWithOptionsMaterialUrl, 'bump.png'));
            }), done).toResolve();
    });

    it('ambient texture is ignored if it is the same as the diffuse texture', function(done) {
        expect(loadMtl(diffuseAmbientSameMaterialUrl)
            .then(function(materials) {
                expect(Object.keys(materials).length).toBe(1);
                var material = materials['Material'];
                expect(material.diffuseTexture).toBeDefined();
                expect(material.ambientTexture).toBeUndefined();
            }), done).toResolve();
    });

    it('alpha of 0.0 is treated as 1.0', function(done) {
        expect(loadMtl(transparentMaterialUrl)
            .then(function(materials) {
                var material = materials.Material;
                expect(material.alpha).toBe(1.0);
            }), done).toResolve();
    });
});
