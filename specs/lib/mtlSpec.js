'use strict';
var path = require('path');
var loadMtl = require('../../lib/mtl.js');

var complexMaterialUrl = 'specs/data/box-complex-material/box-complex-material.mtl';
var multipleMaterialsUrl = 'specs/data/box-multiple-materials/box-multiple-materials.mtl';
var invalidMaterialUrl = 'invalid.mtl';

function getImagePath(objPath, relativePath) {
    return path.normalize(path.join(path.dirname(objPath), relativePath));
}

describe('mtl', function() {
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
                expect(material.ambientColorMap).toEqual(getImagePath(complexMaterialUrl, 'ambient.gif'));
                expect(material.emissionColorMap).toEqual(getImagePath(complexMaterialUrl, 'emission.jpg'));
                expect(material.diffuseColorMap).toEqual(getImagePath(complexMaterialUrl, 'diffuse.png'));
                expect(material.specularColorMap).toEqual(getImagePath(complexMaterialUrl, 'specular.jpeg'));
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
});
