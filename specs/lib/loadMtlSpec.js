'use strict';
var path = require('path');
var loadMtl = require('../../lib/loadMtl');

var complexMaterialUrl = 'specs/data/box-complex-material/box-complex-material.mtl';
var multipleMaterialsUrl = 'specs/data/box-multiple-materials/box-multiple-materials.mtl';
var transparentMaterialUrl = 'specs/data/box-transparent/box-transparent.mtl';

function getImagePath(objPath, relativePath) {
    return path.normalize(path.join(path.dirname(objPath), relativePath));
}

describe('loadMtl', function() {
    it('loads complex material', function(done) {
        expect(loadMtl(complexMaterialUrl)
            .then(function(materials) {
                var material = materials.Material;
                expect(material).toBeDefined();
                expect(material.ambientColor).toEqual([0.2, 0.2, 0.2, 1.0]);
                expect(material.emissionColor).toEqual([0.1, 0.1, 0.1, 1.0]);
                expect(material.diffuseColor).toEqual([0.64, 0.64, 0.64, 1.0]);
                expect(material.specularColor).toEqual([0.5, 0.5, 0.5, 1.0]);
                expect(material.specularShininess).toEqual(96.078431);
                expect(material.alpha).toEqual(0.9);
                expect(material.ambientTexture).toEqual(getImagePath(complexMaterialUrl, 'ambient.gif'));
                expect(material.emissionTexture).toEqual(getImagePath(complexMaterialUrl, 'emission.jpg'));
                expect(material.diffuseTexture).toEqual(getImagePath(complexMaterialUrl, 'diffuse.png'));
                expect(material.specularTexture).toEqual(getImagePath(complexMaterialUrl, 'specular.jpeg'));
                expect(material.specularShininessMap).toEqual(getImagePath(complexMaterialUrl, 'shininess.png'));
                expect(material.normalMap).toEqual(getImagePath(complexMaterialUrl, 'bump.png'));
                expect(material.alphaMap).toEqual(getImagePath(complexMaterialUrl, 'alpha.png'));
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

    it('alpha of 0.0 is treated as 1.0', function(done) {
        expect(loadMtl(transparentMaterialUrl)
            .then(function(materials) {
                var material = materials.Material;
                expect(material.alpha).toBe(1.0);
            }), done).toResolve();
    });
});
