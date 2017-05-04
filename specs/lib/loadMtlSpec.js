'use strict';
var path = require('path');
var loadMtl = require('../../lib/loadMtl');
var obj2gltf = require('../../lib/obj2gltf');

var complexMaterialUrl = 'specs/data/box-complex-material/box-complex-material.mtl';
var multipleMaterialsUrl = 'specs/data/box-multiple-materials/box-multiple-materials.mtl';

function getImagePath(objPath, relativePath) {
    return path.resolve(path.dirname(objPath), relativePath);
}

var defaultOptions = obj2gltf.defaults;

describe('loadMtl', function() {
    it('loads complex material', function(done) {
        expect(loadMtl(complexMaterialUrl, defaultOptions)
            .then(function(materials) {
                var material = materials[0];
                expect(material.name).toBe('Material');
                expect(material.ambientColor).toEqual([0.2, 0.2, 0.2, 1.0]);
                expect(material.emissiveColor).toEqual([0.1, 0.1, 0.1, 1.0]);
                expect(material.diffuseColor).toEqual([0.64, 0.64, 0.64, 1.0]);
                expect(material.specularColor).toEqual([0.5, 0.5, 0.5, 1.0]);
                expect(material.specularShininess).toEqual(96.078431);
                expect(material.alpha).toEqual(0.9);
                expect(material.ambientTexture).toEqual(getImagePath(complexMaterialUrl, 'ambient.gif'));
                expect(material.emissiveTexture).toEqual(getImagePath(complexMaterialUrl, 'emission.jpg'));
                expect(material.diffuseTexture).toEqual(getImagePath(complexMaterialUrl, 'diffuse.png'));
                expect(material.specularTexture).toEqual(getImagePath(complexMaterialUrl, 'specular.jpeg'));
                expect(material.specularShininessTexture).toEqual(getImagePath(complexMaterialUrl, 'shininess.png'));
                expect(material.normalTexture).toEqual(getImagePath(complexMaterialUrl, 'bump.png'));
                expect(material.alphaTexture).toEqual(getImagePath(complexMaterialUrl, 'alpha.png'));
            }), done).toResolve();
    });

    it('loads mtl with multiple materials', function(done) {
        expect(loadMtl(multipleMaterialsUrl, defaultOptions)
            .then(function(materials) {
                expect(materials.length).toBe(3);
                expect(materials[0].name).toBe('Blue');
                expect(materials[0].diffuseColor).toEqual([0.0, 0.0, 0.64, 1.0]);
                expect(materials[1].name).toBe('Green');
                expect(materials[1].diffuseColor).toEqual([0.0, 0.64, 0.0, 1.0]);
                expect(materials[2].name).toBe('Red');
                expect(materials[2].diffuseColor).toEqual([0.64, 0.0, 0.0, 1.0]);
            }), done).toResolve();
    });
});
