'use strict';
const Cesium = require('cesium');
const path = require('path');

const loadObj = require('../../lib/loadObj');
const obj2gltf = require('../../lib/obj2gltf');

const Cartesian3 = Cesium.Cartesian3;
const CesiumMath = Cesium.Math;
const clone = Cesium.clone;
const RuntimeError = Cesium.RuntimeError;

const objPath = 'specs/data/box/box.obj';
const objRotatedUrl = 'specs/data/box-rotated/box-rotated.obj';
const objNormalsPath = 'specs/data/box-normals/box-normals.obj';
const objUvsPath = 'specs/data/box-uvs/box-uvs.obj';
const objPositionsOnlyPath = 'specs/data/box-positions-only/box-positions-only.obj';
const objNegativeIndicesPath = 'specs/data/box-negative-indices/box-negative-indices.obj';
const objTrianglesPath = 'specs/data/box-triangles/box-triangles.obj';
const objObjectsPath = 'specs/data/box-objects/box-objects.obj';
const objGroupsPath = 'specs/data/box-groups/box-groups.obj';
const objObjectsGroupsPath = 'specs/data/box-objects-groups/box-objects-groups.obj';
const objObjectsGroupsMaterialsPath = 'specs/data/box-objects-groups-materials/box-objects-groups-materials.obj';
const objObjectsGroupsMaterialsPath2 = 'specs/data/box-objects-groups-materials-2/box-objects-groups-materials-2.obj';
const objUsemtlPath = 'specs/data/box-usemtl/box-usemtl.obj';
const objNoMaterialsPath = 'specs/data/box-no-materials/box-no-materials.obj';
const objMultipleMaterialsPath = 'specs/data/box-multiple-materials/box-multiple-materials.obj';
const objUncleanedPath = 'specs/data/box-uncleaned/box-uncleaned.obj';
const objMtllibPath = 'specs/data/box-mtllib/box-mtllib.obj';
const objMtllibSpacesPath = 'specs/data/box-mtllib-spaces/box mtllib.obj';
const objMissingMtllibPath = 'specs/data/box-missing-mtllib/box-missing-mtllib.obj';
const objMissingUsemtlPath = 'specs/data/box-missing-usemtl/box-missing-usemtl.obj';
const objUnnamedMaterialPath = 'specs/data/box-unnamed-material/box-unnamed-material.obj';
const objExternalResourcesPath = 'specs/data/box-external-resources/box-external-resources.obj';
const objResourcesInRootPath = 'specs/data/box-resources-in-root/box-resources-in-root.obj';
const objExternalResourcesInRootPath = 'specs/data/box-external-resources-in-root/box-external-resources-in-root.obj';
const objTexturedPath = 'specs/data/box-textured/box-textured.obj';
const objMissingTexturePath = 'specs/data/box-missing-texture/box-missing-texture.obj';
const objSubdirectoriesPath = 'specs/data/box-subdirectories/box-textured.obj';
const objWindowsPaths = 'specs/data/box-windows-paths/box-windows-paths.obj';
const objInvalidContentsPath = 'specs/data/box/box.mtl';
const objConcavePath = 'specs/data/concave/concave.obj';
const objUnnormalizedPath = 'specs/data/box-unnormalized/box-unnormalized.obj';
const objMixedAttributesPath = 'specs/data/box-mixed-attributes/box-mixed-attributes.obj';
const objInvalidPath = 'invalid.obj';

function getMeshes(data) {
    let meshes = [];
    const nodes = data.nodes;
    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        meshes = meshes.concat(nodes[i].meshes);
    }
    return meshes;
}

function getPrimitives(data) {
    let primitives = [];
    const nodes = data.nodes;
    const nodesLength = nodes.length;
    for (let i = 0; i < nodesLength; ++i) {
        const meshes = nodes[i].meshes;
        const meshesLength = meshes.length;
        for (let j = 0; j < meshesLength; ++j) {
            primitives = primitives.concat(meshes[j].primitives);
        }
    }
    return primitives;
}

let options;

describe('loadObj', () => {
    beforeEach(() => {
        options = clone(obj2gltf.defaults);
        options.overridingTextures = {};
        options.logger = () => {};
    });

    it('loads obj with positions, normals, and uvs', async () => {
        const data = await loadObj(objPath, options);
        const materials = data.materials;
        const nodes = data.nodes;
        const name = data.name;
        const meshes = getMeshes(data);
        const primitives = getPrimitives(data);

        expect(name).toBe('box');
        expect(materials.length).toBe(1);
        expect(nodes.length).toBe(1);
        expect(meshes.length).toBe(1);
        expect(primitives.length).toBe(1);

        const node = nodes[0];
        const mesh = meshes[0];
        const primitive = primitives[0];

        expect(node.name).toBe('Cube');
        expect(mesh.name).toBe('Cube-Mesh');
        expect(primitive.positions.length / 3).toBe(24);
        expect(primitive.normals.length / 3).toBe(24);
        expect(primitive.uvs.length / 2).toBe(24);
        expect(primitive.indices.length).toBe(36);
        expect(primitive.material).toBe('Material');
    });

    it('loads obj with normals', async () => {
        const data = await loadObj(objNormalsPath, options);
        const primitive = getPrimitives(data)[0];
        expect(primitive.positions.length / 3).toBe(24);
        expect(primitive.normals.length / 3).toBe(24);
        expect(primitive.uvs.length / 2).toBe(0);
    });

    it('normalizes normals', async () => {
        const data = await loadObj(objUnnormalizedPath, options);
        const scratchNormal = new Cesium.Cartesian3();
        const primitive = getPrimitives(data)[0];
        const normals = primitive.normals;
        const normalsLength = normals.length / 3;
        for (let i = 0; i < normalsLength; ++i) {
            const normalX = normals.get(i * 3);
            const normalY = normals.get(i * 3 + 1);
            const normalZ = normals.get(i * 3 + 2);
            const normal = Cartesian3.fromElements(normalX, normalY, normalZ, scratchNormal);
            expect(CesiumMath.equalsEpsilon(Cartesian3.magnitude(normal), 1.0, CesiumMath.EPSILON5)).toBe(true);
        }
    });

    it('loads obj with uvs', async () => {
        const data = await loadObj(objUvsPath, options);
        const primitive = getPrimitives(data)[0];
        expect(primitive.positions.length / 3).toBe(20);
        expect(primitive.normals.length / 3).toBe(0);
        expect(primitive.uvs.length / 2).toBe(20);
    });

    it('loads obj with negative indices', async () => {
        const results = [
            await loadObj(objPositionsOnlyPath, options),
            await loadObj(objNegativeIndicesPath, options)
        ];
        const positionsReference = getPrimitives(results[0])[0].positions.toFloatBuffer();
        const positions = getPrimitives(results[1])[0].positions.toFloatBuffer();
        expect(positions).toEqual(positionsReference);
    });

    it('loads obj with triangle faces', async () => {
        const data = await loadObj(objTrianglesPath, options);
        const primitive = getPrimitives(data)[0];
        expect(primitive.positions.length / 3).toBe(24);
        expect(primitive.indices.length).toBe(36);
    });

    it('loads obj with objects', async () => {
        const data = await loadObj(objObjectsPath, options);
        const nodes = data.nodes;
        expect(nodes.length).toBe(3);
        expect(nodes[0].name).toBe('CubeBlue');
        expect(nodes[1].name).toBe('CubeGreen');
        expect(nodes[2].name).toBe('CubeRed');

        const primitives = getPrimitives(data);
        expect(primitives.length).toBe(3);
        expect(primitives[0].material).toBe('Blue');
        expect(primitives[1].material).toBe('Green');
        expect(primitives[2].material).toBe('Red');
    });

    it('loads obj with groups', async () => {
        const data = await loadObj(objGroupsPath, options);
        const nodes = data.nodes;
        expect(nodes.length).toBe(3);
        expect(nodes[0].name).toBe('CubeBlue');
        expect(nodes[1].name).toBe('CubeGreen');
        expect(nodes[2].name).toBe('CubeRed');

        const primitives = getPrimitives(data);
        expect(primitives.length).toBe(3);
        expect(primitives[0].material).toBe('Blue');
        expect(primitives[1].material).toBe('Green');
        expect(primitives[2].material).toBe('Red');
    });

    it('loads obj with objects and groups', async () => {
        const data = await loadObj(objObjectsGroupsPath, options);
        const nodes = data.nodes;
        expect(nodes.length).toBe(3);
        expect(nodes[0].name).toBe('CubeBlue');
        expect(nodes[1].name).toBe('CubeGreen');
        expect(nodes[2].name).toBe('CubeRed');

        const meshes = getMeshes(data);
        expect(meshes.length).toBe(3);
        expect(meshes[0].name).toBe('CubeBlue_CubeBlue_Blue');
        expect(meshes[1].name).toBe('CubeGreen_CubeGreen_Green');
        expect(meshes[2].name).toBe('CubeRed_CubeRed_Red');

        const primitives = getPrimitives(data);
        expect(primitives.length).toBe(3);
        expect(primitives[0].material).toBe('Blue');
        expect(primitives[1].material).toBe('Green');
        expect(primitives[2].material).toBe('Red');
    });

    function loadsObjWithObjectsGroupsAndMaterials(data) {
        const nodes = data.nodes;
        expect(nodes.length).toBe(1);
        expect(nodes[0].name).toBe('Cube');
        const meshes = getMeshes(data);
        expect(meshes.length).toBe(3);
        expect(meshes[0].name).toBe('Blue');
        expect(meshes[1].name).toBe('Green');
        expect(meshes[2].name).toBe('Red');
        const primitives = getPrimitives(data);
        expect(primitives.length).toBe(6);
        expect(primitives[0].material).toBe('Blue');
        expect(primitives[1].material).toBe('Green');
        expect(primitives[2].material).toBe('Green');
        expect(primitives[3].material).toBe('Red');
        expect(primitives[4].material).toBe('Red');
        expect(primitives[5].material).toBe('Blue');
    }

    it('loads obj with objects, groups, and materials', async () => {
        const data = await loadObj(objObjectsGroupsMaterialsPath, options);
        loadsObjWithObjectsGroupsAndMaterials(data);
    });

    it('loads obj with objects, groups, and materials (2)', async () => {
        // The usemtl lines are placed in an unordered fashion but
        // should produce the same result as the previous test
        const data = await loadObj(objObjectsGroupsMaterialsPath2, options);
        loadsObjWithObjectsGroupsAndMaterials(data);
    });

    it('loads obj with concave face containing 5 vertices', async () => {
        const data = await loadObj(objConcavePath, options);
        const primitive = getPrimitives(data)[0];
        expect(primitive.positions.length / 3).toBe(30);
        expect(primitive.indices.length).toBe(48);
    });

    it('loads obj with usemtl only', async () => {
        const data = await loadObj(objUsemtlPath, options);
        const nodes = data.nodes;
        expect(nodes.length).toBe(1);
        expect(nodes[0].name).toBe('Node'); // default name

        const meshes = getMeshes(data);
        expect(meshes.length).toBe(1);
        expect(meshes[0].name).toBe('Node-Mesh');

        const primitives = getPrimitives(data);
        expect(primitives.length).toBe(3);
        expect(primitives[0].material).toBe('Blue');
        expect(primitives[1].material).toBe('Green');
        expect(primitives[2].material).toBe('Red');
    });

    it('loads obj with no materials', async () => {
        const data = await loadObj(objNoMaterialsPath, options);
        const nodes = data.nodes;
        expect(nodes.length).toBe(1);
        expect(nodes[0].name).toBe('Node'); // default name

        const primitives = getPrimitives(data);
        expect(primitives.length).toBe(1);
    });

    it('loads obj with multiple materials', async () => {
        // The usemtl markers are interleaved, but should condense to just three primitives
        const data = await loadObj(objMultipleMaterialsPath, options);
        const nodes = data.nodes;
        expect(nodes.length).toBe(1);

        const primitives = getPrimitives(data);
        expect(primitives.length).toBe(3);

        expect(primitives[0].indices.length).toBe(12);
        expect(primitives[1].indices.length).toBe(12);
        expect(primitives[2].indices.length).toBe(12);
        expect(primitives[0].material).toBe('Red');
        expect(primitives[1].material).toBe('Green');
        expect(primitives[2].material).toBe('Blue');

        for (let i = 0; i < 3; ++i) {
            const indices = primitives[i].indices;
            for (let j = 0; j < indices.length; ++j) {
                expect(indices.get(j)).toBeLessThan(8);
            }
        }
    });

    it('loads obj uncleaned', async () => {
        // Obj with extraneous o, g, and usemtl lines
        // Also tests handling of o and g lines with the same names
        const data = await loadObj(objUncleanedPath, options);
        const nodes = data.nodes;
        const meshes = getMeshes(data);
        const primitives = getPrimitives(data);

        expect(nodes.length).toBe(1);
        expect(meshes.length).toBe(1);
        expect(primitives.length).toBe(1);

        expect(nodes[0].name).toBe('Cube');
        expect(meshes[0].name).toBe('Cube_1');
    });

    it('loads obj with multiple mtllibs', async () => {
        const data = await loadObj(objMtllibPath, options);
        const materials = data.materials;
        expect(materials.length).toBe(3);

        // .mtl files are loaded in an arbitrary order, so sort for testing purposes
        materials.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        expect(materials[0].name).toBe('Blue');
        expect(materials[0].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.0, 0.64, 1.0]);
        expect(materials[1].name).toBe('Green');
        expect(materials[1].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.64, 0.0, 1.0]);
        expect(materials[2].name).toBe('Red');
        expect(materials[2].pbrMetallicRoughness.baseColorFactor).toEqual([0.64, 0.0, 0.0, 1.0]);
    });

    it('loads obj with mtllib paths with spaces', async () => {
        const data = await loadObj(objMtllibSpacesPath, options);
        const materials = data.materials;
        expect(materials.length).toBe(3);

        // .mtl files are loaded in an arbitrary order, so sort for testing purposes
        materials.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        expect(materials[0].name).toBe('Blue');
        expect(materials[0].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.0, 0.64, 1.0]);
        expect(materials[1].name).toBe('Green');
        expect(materials[1].pbrMetallicRoughness.baseColorFactor).toEqual([0.0, 0.64, 0.0, 1.0]);
        expect(materials[2].name).toBe('Red');
        expect(materials[2].pbrMetallicRoughness.baseColorFactor).toEqual([0.64, 0.0, 0.0, 1.0]);
    });

    it('loads obj with missing mtllib', async () => {
        const spy = jasmine.createSpy('logger');
        options.logger = spy;

        const data = await loadObj(objMissingMtllibPath, options);
        expect(data.materials.length).toBe(0);
        expect(spy.calls.argsFor(0)[0].indexOf('ENOENT') >= 0).toBe(true);
        expect(spy.calls.argsFor(0)[0].indexOf(path.resolve('/box.mtl')) >= 0).toBe(true);
        expect(spy.calls.argsFor(1)[0].indexOf('Attempting to read the material file from within the obj directory instead.') >= 0).toBe(true);
        expect(spy.calls.argsFor(2)[0].indexOf('ENOENT') >= 0).toBe(true);
        expect(spy.calls.argsFor(3)[0].indexOf('Could not read material file') >= 0).toBe(true);
    });

    it('loads obj with missing usemtl', async () => {
        const data = await loadObj(objMissingUsemtlPath, options);
        expect(data.materials.length).toBe(1);
        expect(data.nodes[0].meshes[0].primitives[0].material).toBe('Material');
    });

    it('loads obj with unnamed material', async () => {
        const data = await loadObj(objUnnamedMaterialPath, options);
        expect(data.materials.length).toBe(1);
        expect(data.nodes[0].meshes[0].primitives[0].material).toBe('');
    });

    it('loads .mtl outside of the obj directory', async () => {
        const data = await loadObj(objExternalResourcesPath, options);
        const materials = data.materials;
        expect(materials.length).toBe(2);

        // .mtl files are loaded in an arbitrary order, so find the "MaterialTextured" material
        const materialTextured = materials[0].name === 'MaterialTextured' ? materials[0] : materials[1];
        const baseColorTexture = materialTextured.pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.source).toBeDefined();
        expect(baseColorTexture.name).toEqual('cesium');
    });

    it('does not load .mtl outside of the obj directory when secure is true', async () => {
        const spy = jasmine.createSpy('logger');
        options.logger = spy;
        options.secure = true;

        const data = await loadObj(objExternalResourcesPath, options);
        expect(data.materials.length).toBe(1); // obj references 2 materials, one of which is outside the input directory
        expect(spy.calls.argsFor(0)[0].indexOf('The material file is outside of the obj directory and the secure flag is true. Attempting to read the material file from within the obj directory instead.') >= 0).toBe(true);
        expect(spy.calls.argsFor(1)[0].indexOf('ENOENT') >= 0).toBe(true);
        expect(spy.calls.argsFor(2)[0].indexOf('Could not read material file') >= 0).toBe(true);
    });

    it('loads .mtl from root directory when the .mtl path does not exist', async () => {
        const data = await loadObj(objResourcesInRootPath, options);
        const baseColorTexture = data.materials[0].pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.name).toBe('cesium');
        expect(baseColorTexture.source).toBeDefined();
    });

    it('loads .mtl from root directory when the .mtl path is outside of the obj directory and secure is true', async () => {
        options.secure = true;

        const data = await loadObj(objExternalResourcesInRootPath, options);
        const materials = data.materials;
        expect(materials.length).toBe(2);

        // .mtl files are loaded in an arbitrary order, so find the "MaterialTextured" material
        const materialTextured = materials[0].name === 'MaterialTextured' ? materials[0] : materials[1];
        const baseColorTexture = materialTextured.pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.source).toBeDefined();
        expect(baseColorTexture.name).toEqual('cesium');
    });

    it('loads obj with texture', async () => {
        const data = await loadObj(objTexturedPath, options);
        const baseColorTexture = data.materials[0].pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.name).toBe('cesium');
        expect(baseColorTexture.source).toBeDefined();
    });

    it('loads obj with missing texture', async () => {
        const spy = jasmine.createSpy('logger');
        options.logger = spy;

        const data = await loadObj(objMissingTexturePath, options);
        const baseColorTexture = data.materials[0].pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture).toBeUndefined();
        expect(spy.calls.argsFor(0)[0].indexOf('ENOENT') >= 0).toBe(true);
        expect(spy.calls.argsFor(0)[0].indexOf(path.resolve('/cesium.png')) >= 0).toBe(true);
        expect(spy.calls.argsFor(1)[0].indexOf('Attempting to read the texture file from within the obj directory instead.') >= 0).toBe(true);
        expect(spy.calls.argsFor(2)[0].indexOf('ENOENT') >= 0).toBe(true);
        expect(spy.calls.argsFor(3)[0].indexOf('Could not read texture file') >= 0).toBe(true);
    });

    it('loads obj with subdirectories', async () => {
        const data = await loadObj(objSubdirectoriesPath, options);
        const baseColorTexture = data.materials[0].pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.name).toBe('cesium');
        expect(baseColorTexture.source).toBeDefined();
    });

    it('loads obj with windows paths', async () => {
        const data = await loadObj(objWindowsPaths, options);
        const baseColorTexture = data.materials[0].pbrMetallicRoughness.baseColorTexture;
        expect(baseColorTexture.name).toBe('cesium');
        expect(baseColorTexture.source).toBeDefined();
    });

    it('separates faces that don\'t use the same attributes as other faces in the primitive', async () => {
        const data = await loadObj(objMixedAttributesPath, options);
        const primitives = getPrimitives(data);
        expect(primitives.length).toBe(4);
        expect(primitives[0].indices.length).toBe(18); // 6 faces
        expect(primitives[1].indices.length).toBe(6); // 2 faces
        expect(primitives[2].indices.length).toBe(6); // 2 faces
        expect(primitives[3].indices.length).toBe(6); // 2 faces
    });

    function getFirstPosition(data) {
        const primitive = getPrimitives(data)[0];
        return new Cartesian3(primitive.positions.get(0), primitive.positions.get(1), primitive.positions.get(2));
    }

    function getFirstNormal(data) {
        const primitive = getPrimitives(data)[0];
        return new Cartesian3(primitive.normals.get(0), primitive.normals.get(1), primitive.normals.get(2));
    }

    async function checkAxisConversion(inputUpAxis, outputUpAxis, position, normal) {
        const sameAxis = (inputUpAxis === outputUpAxis);
        options.inputUpAxis = inputUpAxis;
        options.outputUpAxis = outputUpAxis;
        const data = await loadObj(objRotatedUrl, options);
        const rotatedPosition = getFirstPosition(data);
        const rotatedNormal = getFirstNormal(data);
        if (sameAxis) {
            expect(rotatedPosition).toEqual(position);
            expect(rotatedNormal).toEqual(normal);
        } else {
            expect(rotatedPosition).not.toEqual(position);
            expect(rotatedNormal).not.toEqual(normal);
        }
    }

    it('performs up axis conversion', async () => {
        const data = await loadObj(objRotatedUrl, options);
        const position = getFirstPosition(data);
        const normal = getFirstNormal(data);

        const axes = ['X', 'Y', 'Z'];
        const axesLength = axes.length;
        for (let i = 0; i < axesLength; ++i) {
            for (let j = 0; j < axesLength; ++j) {
                await checkAxisConversion(axes[i], axes[j], position, normal);
            }
        }
    });

    it('throws when file has invalid contents', async () => {
        let thrownError;
        try {
            await loadObj(objInvalidContentsPath, options);
        } catch (e) {
            thrownError = e;
        }
        expect(thrownError).toEqual(new RuntimeError(objInvalidContentsPath + ' does not have any geometry data'));
    });

    it('throw when reading invalid file', async () => {
        let thrownError;
        try {
            await loadObj(objInvalidPath, options);
        } catch (e) {
            thrownError = e;
        }
        expect(thrownError.message.startsWith('ENOENT: no such file or directory')).toBe(true);
    });
});
