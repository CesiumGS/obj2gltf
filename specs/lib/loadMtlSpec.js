'use strict';
var path = require('path');
var loadMtl = require('../../lib/loadMtl');

var complexMaterialUrl = 'specs/data/box-complex-material/box-complex-material.mtl';
var diffuseAmbientSameMaterialUrl = 'specs/data/box-diffuse-ambient-same/box-diffuse-ambient-same.mtl';
var multipleMaterialsUrl = 'specs/data/box-multiple-materials/box-multiple-materials.mtl';
var texturedWithOptionsMaterialUrl = 'specs/data/box-texture-options/box-texture-options.mtl';

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

    it('loads mtl with textures having options', function(done) {
        options.metallicRoughness = true;
        expect(loadMtl(texturedWithOptionsMaterialUrl)
            .then(function(materials) {
                expect(materials.length).toBe(1);
                var material = materials[0];
                var pbr = material.pbrMetallicRoughness;
                expect(pbr.baseColorTexture).toBeDefined();
                expect(pbr.metallicRoughnessTexture).toBeDefined();
                expect(pbr.baseColorFactor).toEqual([1.0, 1.0, 1.0, 0.9]);
                expect(pbr.metallicFactor).toBe(1.0);
                expect(pbr.roughnessFactor).toBe(1.0);
                expect(material.name).toBe('Material');
                expect(material.emissiveTexture).toBeDefined();
                expect(material.normalTexture).toBeDefined();
                expect(material.occlusionTexture).toBeDefined();
                expect(material.emissiveFactor).toEqual([1.0, 1.0, 1.0]);
                expect(material.alphaMode).toBe('BLEND');
                expect(material.doubleSided).toBe(true);
            }), done).toResolve();
    });

    it('ambient texture is ignored if it is the same as the diffuse texture', function(done) {
        expect(loadMtl(diffuseAmbientSameMaterialUrl, options)
            .then(function(materials) {
                expect(Object.keys(materials).length).toBe(1);
                var material = materials['Material'];
                expect(material.diffuseTexture).toBeDefined();
                expect(material.ambientTexture).toBeUndefined();
            }), done).toResolve();
    });
});
