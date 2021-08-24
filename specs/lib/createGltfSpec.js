"use strict";
const Cesium = require("@propelleraero/cesium");
const obj2gltf = require("../../lib/obj2gltf");
const createGltf = require("../../lib/createGltf");
const loadObj = require("../../lib/loadObj");
const { getDefaultMaterial } = require("../../lib/loadMtl");

const clone = Cesium.clone;
const defined = Cesium.defined;
const WebGLConstants = Cesium.WebGLConstants;

const boxObjPath = "specs/data/box/box.obj";
const groupObjPath =
  "specs/data/box-objects-groups-materials/box-objects-groups-materials.obj";
const complexObjPath =
  "specs/data/box-complex-material/box-complex-material.obj";
const noMaterialsObjPath = "specs/data/box-no-materials/box-no-materials.obj";
const mixedAttributesObjPath =
  "specs/data/box-mixed-attributes-2/box-mixed-attributes-2.obj";

let options;

describe("createGltf", () => {
  let boxObjData;
  let groupObjData;
  let complexObjData;
  let noMaterialsObjData;
  let mixedAttributesObjData;

  beforeEach(async () => {
    options = clone(obj2gltf.defaults);
    options.overridingTextures = {};
    options.logger = () => {};

    boxObjData = await loadObj(boxObjPath, options);
    groupObjData = await loadObj(groupObjPath, options);
    complexObjData = await loadObj(complexObjPath, options);
    noMaterialsObjData = await loadObj(noMaterialsObjPath, options);
    mixedAttributesObjData = await loadObj(mixedAttributesObjPath, options);
  });

  it("simple gltf", () => {
    const gltf = createGltf(boxObjData, options);

    expect(gltf.materials.length).toBe(1);
    expect(gltf.scene).toBe(0);
    expect(gltf.scenes[0].nodes[0]).toBe(0);
    expect(gltf.nodes.length).toBe(1);
    expect(gltf.meshes.length).toBe(1);

    const primitives = gltf.meshes[0].primitives;
    const primitive = primitives[0];
    const attributes = primitive.attributes;
    const positionAccessor = gltf.accessors[attributes.POSITION];
    const normalAccessor = gltf.accessors[attributes.NORMAL];
    const uvAccessor = gltf.accessors[attributes.TEXCOORD_0];
    const indexAccessor = gltf.accessors[primitive.indices];

    expect(primitives.length).toBe(1);
    expect(positionAccessor.count).toBe(24);
    expect(normalAccessor.count).toBe(24);
    expect(uvAccessor.count).toBe(24);
    expect(indexAccessor.count).toBe(36);
  });

  it("does not combine buffers when that buffer would exceed the Node buffer size limit", () => {
    spyOn(createGltf, "_getBufferMaxByteLength").and.returnValue(0);
    const clonedOptions = clone(options, true);
    clonedOptions.separate = true;

    const gltf = createGltf(boxObjData, clonedOptions);
    expect(gltf.accessors.length).toBe(4);
    expect(gltf.buffers.length).toBe(4);
    expect(gltf.bufferViews.length).toBe(4);

    const length = gltf.buffers.length;
    for (let i = 0; i < length; ++i) {
      const accessor = gltf.accessors[i];
      const bufferView = gltf.bufferViews[i];
      const buffer = gltf.buffers[i];
      expect(accessor.bufferView).toBe(i);
      expect(accessor.byteOffset).toBe(0);
      expect(bufferView.buffer).toBe(i);
      expect(bufferView.byteOffset).toBe(0);
      expect(bufferView.byteLength).toBe(buffer.byteLength);
    }
  });

  it("multiple nodes, meshes, and primitives", () => {
    const gltf = createGltf(groupObjData, options);

    expect(gltf.materials.length).toBe(3);
    expect(gltf.scene).toBe(0);
    expect(gltf.scenes[0].nodes[0]).toBe(0);
    expect(gltf.nodes.length).toBe(4);
    expect(gltf.nodes[0].mesh).toBeUndefined();
    expect(gltf.nodes[0].children.length).toBe(3);
    expect(gltf.meshes.length).toBe(3);

    // Check for two primitives in each mesh
    const length = gltf.meshes.length;
    for (let i = 0; i < length; ++i) {
      const mesh = gltf.meshes[i];
      expect(mesh.primitives.length).toBe(2);
    }
  });

  it("multiple textures", () => {
    const gltf = createGltf(complexObjData, options);
    const material = gltf.materials[0];
    const pbr = material.pbrMetallicRoughness;
    const textures = [
      pbr.metallicRoughnessTexture,
      pbr.baseColorTexture,
      material.emissiveTexture,
      material.normalTexture,
      material.occlusionTexture,
    ];
    expect(
      textures
        .map((texture) => {
          return texture.index;
        })
        .sort()
    ).toEqual([0, 1, 2, 3, 4]);
    expect(gltf.samplers[0]).toBeDefined();
  });

  it("creates default material", () => {
    const gltf = createGltf(noMaterialsObjData, options);
    const material = gltf.materials[0];
    const pbr = material.pbrMetallicRoughness;
    expect(material.name).toBe("default");
    expect(pbr.baseColorTexture).toBeUndefined();
    expect(pbr.metallicRoughnessTexture).toBeUndefined();
    expect(pbr.baseColorFactor).toEqual([0.5, 0.5, 0.5, 1.0]);
    expect(pbr.metallicFactor).toBe(0.0); // No metallic
    expect(pbr.roughnessFactor).toBe(1.0); // Fully rough
    expect(material.emissiveTexture).toBeUndefined();
    expect(material.normalTexture).toBeUndefined();
    expect(material.ambientTexture).toBeUndefined();
    expect(material.emissiveFactor).toEqual([0.0, 0.0, 0.0]);
    expect(material.alphaMode).toBe("OPAQUE");
    expect(material.doubleSided).toBe(false);
  });

  it("adds KHR_materials_pbrSpecularGlossiness extension when specularGlossiness is set", () => {
    options.specularGlossiness = true;
    const gltf = createGltf(noMaterialsObjData, options);
    expect(gltf.extensionsUsed).toEqual([
      "KHR_materials_pbrSpecularGlossiness",
    ]);
    expect(gltf.extensionsRequired).toEqual([
      "KHR_materials_pbrSpecularGlossiness",
    ]);
  });

  it("adds KHR_materials_unlit extension when unlit is set", () => {
    options.unlit = true;
    const gltf = createGltf(noMaterialsObjData, options);
    expect(gltf.extensionsUsed).toEqual(["KHR_materials_unlit"]);
    expect(gltf.extensionsRequired).toEqual(["KHR_materials_unlit"]);
  });

  it("runs without normals", () => {
    boxObjData.nodes[0].meshes[0].primitives[0].normals.length = 0;

    const gltf = createGltf(boxObjData, options);
    const attributes = gltf.meshes[0].primitives[0].attributes;
    expect(attributes.POSITION).toBeDefined();
    expect(attributes.NORMAL).toBeUndefined();
    expect(attributes.TEXCOORD_0).toBeDefined();
  });

  it("runs without uvs", () => {
    boxObjData.nodes[0].meshes[0].primitives[0].uvs.length = 0;

    const gltf = createGltf(boxObjData, options);
    const attributes = gltf.meshes[0].primitives[0].attributes;
    expect(attributes.POSITION).toBeDefined();
    expect(attributes.NORMAL).toBeDefined();
    expect(attributes.TEXCOORD_0).toBeUndefined();
  });

  it("runs without uvs and normals", () => {
    boxObjData.nodes[0].meshes[0].primitives[0].normals.length = 0;
    boxObjData.nodes[0].meshes[0].primitives[0].uvs.length = 0;

    const gltf = createGltf(boxObjData, options);
    const attributes = gltf.meshes[0].primitives[0].attributes;
    expect(attributes.POSITION).toBeDefined();
    expect(attributes.NORMAL).toBeUndefined();
    expect(attributes.TEXCOORD_0).toBeUndefined();
  });

  it("splits incompatible materials", () => {
    const gltf = createGltf(mixedAttributesObjData, options);
    const materials = gltf.materials;
    const meshes = gltf.meshes;

    const referenceMaterial = mixedAttributesObjData.materials[0];
    delete referenceMaterial.name;
    referenceMaterial.pbrMetallicRoughness.baseColorTexture = {
      index: 0,
    };

    const referenceMaterialNoTextures = clone(referenceMaterial, true);
    referenceMaterialNoTextures.pbrMetallicRoughness.baseColorTexture =
      undefined;

    const defaultMaterial = getDefaultMaterial(options);
    delete defaultMaterial.name;

    const materialNames = materials.map((material) => {
      const name = material.name;
      delete material.name;
      return name;
    });

    // Expect three copies of each material for
    // * positions/normals/uvs
    // * positions/normals
    // * positions/uvs
    expect(materialNames).toEqual([
      "default",
      "default-2",
      "default-3",
      "Material",
      "Material-2",
      "Material-3",
      "Missing",
      "Missing-2",
      "Missing-3",
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
    const meshesLength = meshes.length;
    for (let i = 0; i < meshesLength; ++i) {
      const mesh = meshes[i];
      const primitives = mesh.primitives;
      const primitivesLength = primitives.length;
      for (let j = 0; j < primitivesLength; ++j) {
        const primitive = primitives[j];
        const material = materials[primitive.material];
        if (!defined(primitive.attributes.TEXCOORD_0)) {
          expect(
            material.pbrMetallicRoughness.baseColorTexture
          ).toBeUndefined();
        }
      }
    }
  });

  function expandObjData(objData, duplicatesLength) {
    const primitive = objData.nodes[0].meshes[0].primitives[0];
    const indices = primitive.indices;
    const positions = primitive.positions;
    const normals = primitive.normals;
    const uvs = primitive.uvs;

    const indicesLength = indices.length;
    const vertexCount = positions.length / 3;

    for (let i = 1; i < duplicatesLength; ++i) {
      for (let j = 0; j < vertexCount; ++j) {
        positions.push(0.0);
        positions.push(0.0);
        positions.push(0.0);
        normals.push(0.0);
        normals.push(0.0);
        normals.push(0.0);
        uvs.push(0.0);
        uvs.push(0.0);
      }
      for (let k = 0; k < indicesLength; ++k) {
        indices.push(indices.get(k) + vertexCount * i);
      }
    }
  }

  it("detects need to use uint32 indices", () => {
    expandObjData(boxObjData, 2731); // Right above 65536 limit
    let primitive = boxObjData.nodes[0].meshes[0].primitives[0];
    const indicesLength = primitive.indices.length;
    const vertexCount = primitive.positions.length / 3;

    const gltf = createGltf(boxObjData, options);
    primitive = gltf.meshes[0].primitives[0];
    const indicesAccessor = gltf.accessors[primitive.indices];
    expect(indicesAccessor.count).toBe(indicesLength);
    expect(indicesAccessor.max[0]).toBe(vertexCount - 1);
    expect(indicesAccessor.componentType).toBe(WebGLConstants.UNSIGNED_INT);

    const positionAccessor = gltf.accessors[primitive.attributes.POSITION];
    expect(positionAccessor.count).toBe(vertexCount);
  });
});
