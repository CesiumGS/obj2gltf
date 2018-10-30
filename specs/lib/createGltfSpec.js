'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var obj2gltf = require('../../lib/obj2gltf');
var createGltf = require('../../lib/createGltf');
var loadObj = require('../../lib/loadObj');
var getDefaultMaterial = require('../../lib/loadMtl').getDefaultMaterial;

var clone = Cesium.clone;
var defined = Cesium.defined;
var WebGLConstants = Cesium.WebGLConstants;

var boxObjPath = 'specs/data/box/box.obj';
var groupObjPath = 'specs/data/box-objects-groups-materials/box-objects-groups-materials.obj';
var complexObjPath = 'specs/data/box-complex-material/box-complex-material.obj';
var noMaterialsObjPath = 'specs/data/box-no-materials/box-no-materials.obj';
var mixedAttributesObjPath = 'specs/data/box-mixed-attributes-2/box-mixed-attributes-2.obj';

var options;

describe('createGltf', function() {
    var boxObjData;
    var groupObjData;
    var complexObjData;
    var noMaterialsObjData;
    var mixedAttributesObjData;

    beforeEach(function(done) {
        options = clone(obj2gltf.defaults);
        options.overridingTextures = {};
        options.logger = function() {};

        return Promise.all([
            loadObj(boxObjPath, options)
                .then(function(data) {
                    boxObjData = data;
                }),
            loadObj(groupObjPath, options)
                .then(function(data) {
                    groupObjData = data;
                }),
            loadObj(complexObjPath, options)
                .then(function(data) {
                    complexObjData = data;
                }),
            loadObj(noMaterialsObjPath, options)
                .then(function(data) {
                    noMaterialsObjData = data;
                }),
            loadObj(mixedAttributesObjPath, options)
                .then(function(data) {
                    mixedAttributesObjData = data;
                })
        ]).then(done);
    });

    it('simple gltf', function() {
        var gltf = createGltf(boxObjData, options);

        expect(gltf.materials.length).toBe(1);
        expect(gltf.scene).toBe(0);
        expect(gltf.scenes[0].nodes[0]).toBe(0);
        expect(gltf.nodes.length).toBe(1);
        expect(gltf.meshes.length).toBe(1);

        var primitives = gltf.meshes[0].primitives;
        var primitive = primitives[0];
        var attributes = primitive.attributes;
        var positionAccessor = gltf.accessors[attributes.POSITION];
        var normalAccessor = gltf.accessors[attributes.NORMAL];
        var uvAccessor = gltf.accessors[attributes.TEXCOORD_0];
        var indexAccessor = gltf.accessors[primitive.indices];

        expect(primitives.length).toBe(1);
        expect(positionAccessor.count).toBe(24);
        expect(normalAccessor.count).toBe(24);
        expect(uvAccessor.count).toBe(24);
        expect(indexAccessor.count).toBe(36);
    });

    it('multiple nodes, meshes, and primitives', function() {
        var gltf = createGltf(groupObjData, options);

        expect(gltf.materials.length).toBe(3);
        expect(gltf.scene).toBe(0);
        expect(gltf.scenes[0].nodes[0]).toBe(0);
        expect(gltf.nodes.length).toBe(4);
        expect(gltf.nodes[0].mesh).toBeUndefined();
        expect(gltf.nodes[0].children.length).toBe(3);
        expect(gltf.meshes.length).toBe(3);

        // Check for two primitives in each mesh
        var length = gltf.meshes.length;
        for (var i = 0; i < length; ++i) {
            var mesh = gltf.meshes[i];
            expect(mesh.primitives.length).toBe(2);
        }
    });

    it('multiple textures', function() {
        var gltf = createGltf(complexObjData, options);
        var material = gltf.materials[0];
        var pbr = material.pbrMetallicRoughness;
        var textures = [pbr.metallicRoughnessTexture, pbr.baseColorTexture, material.emissiveTexture, material.normalTexture, material.occlusionTexture];
        expect(textures.map(function(texture) {
            return texture.index;
        }).sort()).toEqual([0, 1, 2, 3, 4]);
        expect(gltf.samplers[0]).toBeDefined();
    });

    it('creates default material', function() {
        var gltf = createGltf(noMaterialsObjData, options);
        var material = gltf.materials[0];
        var pbr = material.pbrMetallicRoughness;
        expect(material.name).toBe('default');
        expect(pbr.baseColorTexture).toBeUndefined();
        expect(pbr.metallicRoughnessTexture).toBeUndefined();
        expect(pbr.baseColorFactor).toEqual([0.5, 0.5, 0.5, 1.0]);
        expect(pbr.metallicFactor).toBe(0.0); // No metallic
        expect(pbr.roughnessFactor).toBe(1.0); // Fully rough
        expect(material.emissiveTexture).toBeUndefined();
        expect(material.normalTexture).toBeUndefined();
        expect(material.ambientTexture).toBeUndefined();
        expect(material.emissiveFactor).toEqual([0.0, 0.0, 0.0]);
        expect(material.alphaMode).toBe('OPAQUE');
        expect(material.doubleSided).toBe(false);
    });

    it('adds KHR_materials_pbrSpecularGlossiness extension when specularGlossiness is set', function() {
        options.specularGlossiness = true;
        var gltf = createGltf(noMaterialsObjData, options);
        expect(gltf.extensionsUsed).toEqual(['KHR_materials_pbrSpecularGlossiness']);
        expect(gltf.extensionsRequired).toEqual(['KHR_materials_pbrSpecularGlossiness']);
    });

    it('adds KHR_materials_common extension when materialsCommon is set', function() {
        options.materialsCommon = true;
        var gltf = createGltf(noMaterialsObjData, options);
        expect(gltf.extensionsUsed).toEqual(['KHR_materials_common']);
        expect(gltf.extensionsRequired).toEqual(['KHR_materials_common']);
    });

    it('runs without normals', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].normals.length = 0;

        var gltf = createGltf(boxObjData, options);
        var attributes = gltf.meshes[0].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeUndefined();
        expect(attributes.TEXCOORD_0).toBeDefined();
    });

    it('runs without uvs', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].uvs.length = 0;

        var gltf = createGltf(boxObjData, options);
        var attributes = gltf.meshes[0].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeDefined();
        expect(attributes.TEXCOORD_0).toBeUndefined();
    });

    it('runs without uvs and normals', function() {
        boxObjData.nodes[0].meshes[0].primitives[0].normals.length = 0;
        boxObjData.nodes[0].meshes[0].primitives[0].uvs.length = 0;

        var gltf = createGltf(boxObjData, options);
        var attributes = gltf.meshes[0].primitives[0].attributes;
        expect(attributes.POSITION).toBeDefined();
        expect(attributes.NORMAL).toBeUndefined();
        expect(attributes.TEXCOORD_0).toBeUndefined();
    });

    it('splits incompatible materials', function() {
        var gltf = createGltf(mixedAttributesObjData, options);
        var materials = gltf.materials;
        var meshes = gltf.meshes;

        var referenceMaterial = mixedAttributesObjData.materials[0];
        delete referenceMaterial.name;
        referenceMaterial.pbrMetallicRoughness.baseColorTexture = {
            index : 0
        };

        var referenceMaterialNoTextures = clone(referenceMaterial, true);
        referenceMaterialNoTextures.pbrMetallicRoughness.baseColorTexture = undefined;

        var defaultMaterial = getDefaultMaterial(options);
        delete defaultMaterial.name;

        var materialNames = materials.map(function(material) {
            var name = material.name;
            delete material.name;
            return name;
        });

        // Expect three copies of each material for
        // * positions/normals/uvs
        // * positions/normals
        // * positions/uvs
        expect(materialNames).toEqual([
            'default',
            'default-2',
            'default-3',
            'Material',
            'Material-2',
            'Material-3',
            'Missing',
            'Missing-2',
            'Missing-3'
        ]);

        expect(materials.length).toBe(9);
        expect(materials[0]).toEqual(defaultMaterial);
        expect(materials[1]).toEqual(defaultMaterial);
        expect(materials[2]).toEqual(defaultMaterial);
        expect(materials[3]).toEqual(referenceMaterial);
        expect(materials[4]).toEqual(referenceMaterial);
        expect(materials[5]).toEqual(referenceMaterialNoTextures);
        expect(materials[6]).toEqual(defaultMaterial);
        expect(materials[7]).toEqual(defaultMaterial);
        expect(materials[8]).toEqual(defaultMaterial);

        // Test that primitives without uvs reference materials without textures
        var meshesLength = meshes.length;
        for (var i = 0; i < meshesLength; ++i) {
            var mesh = meshes[i];
            var primitives = mesh.primitives;
            var primitivesLength = primitives.length;
            for (var j = 0; j < primitivesLength; ++j) {
                var primitive = primitives[j];
                var material = materials[primitive.material];
                if (!defined(primitive.attributes.TEXCOORD_0)) {
                    expect(material.pbrMetallicRoughness.baseColorTexture).toBeUndefined();
                }
            }
        }
    });

    function expandObjData(objData, duplicatesLength) {
        var primitive = objData.nodes[0].meshes[0].primitives[0];
        var indices = primitive.indices;
        var positions = primitive.positions;
        var normals = primitive.normals;
        var uvs = primitive.uvs;

        var indicesLength = indices.length;
        var vertexCount = positions.length / 3;

        for (var i = 1; i < duplicatesLength; ++i) {
            for (var j = 0; j < vertexCount; ++j) {
                positions.push(0.0);
                positions.push(0.0);
                positions.push(0.0);
                normals.push(0.0);
                normals.push(0.0);
                normals.push(0.0);
                uvs.push(0.0);
                uvs.push(0.0);
            }
            for (var k = 0; k < indicesLength; ++k) {
                indices.push(indices.get(k) + vertexCount * i);
            }
        }
    }

    it('detects need to use uint32 indices', function() {
        expandObjData(boxObjData, 2731); // Right above 65536 limit
        var primitive = boxObjData.nodes[0].meshes[0].primitives[0];
        var indicesLength = primitive.indices.length;
        var vertexCount = primitive.positions.length / 3;

        var gltf = createGltf(boxObjData, options);
        primitive = gltf.meshes[0].primitives[0];
        var indicesAccessor = gltf.accessors[primitive.indices];
        expect(indicesAccessor.count).toBe(indicesLength);
        expect(indicesAccessor.max[0]).toBe(vertexCount - 1);
        expect(indicesAccessor.componentType).toBe(WebGLConstants.UNSIGNED_INT);

        var positionAccessor = gltf.accessors[primitive.attributes.POSITION];
        expect(positionAccessor.count).toBe(vertexCount);
    });
});
