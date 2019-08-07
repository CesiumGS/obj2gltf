<<<<<<< HEAD
"use strict";
const Cesium = require("cesium");
const path = require("path");
const Promise = require("bluebird");
const loadTexture = require("./loadTexture");
const outsideDirectory = require("./outsideDirectory");
const readLines = require("./readLines");
const Texture = require("./Texture");
=======
'use strict';
const Cesium = require('@propelleraero/cesium');
const path = require('path');
const Promise = require('bluebird');
const loadTexture = require('./loadTexture');
const outsideDirectory = require('./outsideDirectory');
const readLines = require('./readLines');
const Texture = require('./Texture');
>>>>>>> 769bf85... Use Propeller Cesium

const CesiumMath = Cesium.Math;
const clone = Cesium.clone;
const combine = Cesium.combine;
const defaultValue = Cesium.defaultValue;
const defined = Cesium.defined;

module.exports = loadMtl;

/**
 * Parse a .mtl file and load textures referenced within. Returns an array of glTF materials with Texture
 * objects stored in the texture slots.
 * <p>
 * Packed PBR textures (like metallicRoughnessOcclusion and specularGlossiness) require all input textures to be decoded before hand.
 * If a texture is of an unsupported format like .gif or .tga it can't be packed and a metallicRoughness texture will not be created.
 * Similarly if a texture cannot be found it will be ignored and a default value will be used instead.
 * </p>
 *
 * @param {String} mtlPath Path to the .mtl file.
 * @param {Object} options The options object passed along from lib/obj2gltf.js
 * @returns {Promise} A promise resolving to an array of glTF materials with Texture objects stored in the texture slots.
 *
 * @private
 */
function loadMtl(mtlPath, options) {
  let material;
  let values;
  let value;

  const mtlDirectory = path.dirname(mtlPath);
  const materials = [];
  const texturePromiseMap = {}; // Maps texture paths to load promises so that no texture is loaded twice
  const texturePromises = [];

  const overridingTextures = options.overridingTextures;
  const overridingSpecularTexture = defaultValue(
    overridingTextures.metallicRoughnessOcclusionTexture,
    overridingTextures.specularGlossinessTexture
  );
  const overridingSpecularShininessTexture = defaultValue(
    overridingTextures.metallicRoughnessOcclusionTexture,
    overridingTextures.specularGlossinessTexture
  );
  const overridingAmbientTexture = defaultValue(
    overridingTextures.metallicRoughnessOcclusionTexture,
    overridingTextures.occlusionTexture
  );
  const overridingNormalTexture = overridingTextures.normalTexture;
  const overridingDiffuseTexture = overridingTextures.baseColorTexture;
  const overridingEmissiveTexture = overridingTextures.emissiveTexture;
  const overridingAlphaTexture = overridingTextures.alphaTexture;

  // Textures that are packed into PBR textures need to be decoded first
  const decodeOptions = {
    decode: true,
  };

  const diffuseTextureOptions = {
    checkTransparency: options.checkTransparency,
  };

  const ambientTextureOptions = defined(overridingAmbientTexture)
    ? undefined
    : options.packOcclusion
    ? decodeOptions
    : undefined;
  const specularTextureOptions = defined(overridingSpecularTexture)
    ? undefined
    : decodeOptions;
  const specularShinessTextureOptions = defined(
    overridingSpecularShininessTexture
  )
    ? undefined
    : decodeOptions;
  const emissiveTextureOptions = undefined;
  const normalTextureOptions = undefined;
  const alphaTextureOptions = {
    decode: true,
  };

  function createMaterial(name) {
    material = new Material();
    material.name = name;
    material.specularShininess = options.metallicRoughness ? 1.0 : 0.0;
    material.specularTexture = overridingSpecularTexture;
    material.specularShininessTexture = overridingSpecularShininessTexture;
    material.diffuseTexture = overridingDiffuseTexture;
    material.ambientTexture = overridingAmbientTexture;
    material.normalTexture = overridingNormalTexture;
    material.emissiveTexture = overridingEmissiveTexture;
    material.alphaTexture = overridingAlphaTexture;
    materials.push(material);
  }

  function normalizeTexturePath(texturePath, mtlDirectory) {
    // Removes texture options from texture name
    // Assumes no spaces in texture name
    const re = /-(bm|t|s|o|blendu|blendv|boost|mm|texres|clamp|imfchan|type)/;
    if (re.test(texturePath)) {
      texturePath = texturePath.split(/\s+/).pop();
    }
    texturePath = texturePath.replace(/\\/g, "/");
    return path.normalize(path.resolve(mtlDirectory, texturePath));
  }

  function parseLine(line) {
    line = line.trim();
    if (/^newmtl/i.test(line)) {
      const name = line.substring(7).trim();
      createMaterial(name);
    } else if (/^Ka /i.test(line)) {
      values = line.substring(3).trim().split(" ");
      material.ambientColor = [
        parseFloat(values[0]),
        parseFloat(values[1]),
        parseFloat(values[2]),
        1.0,
      ];
    } else if (/^Ke /i.test(line)) {
      values = line.substring(3).trim().split(" ");
      material.emissiveColor = [
        parseFloat(values[0]),
        parseFloat(values[1]),
        parseFloat(values[2]),
        1.0,
      ];
    } else if (/^Kd /i.test(line)) {
      values = line.substring(3).trim().split(" ");
      material.diffuseColor = [
        parseFloat(values[0]),
        parseFloat(values[1]),
        parseFloat(values[2]),
        1.0,
      ];
    } else if (/^Ks /i.test(line)) {
      values = line.substring(3).trim().split(" ");
      material.specularColor = [
        parseFloat(values[0]),
        parseFloat(values[1]),
        parseFloat(values[2]),
        1.0,
      ];
    } else if (/^Ns /i.test(line)) {
      value = line.substring(3).trim();
      material.specularShininess = parseFloat(value);
    } else if (/^d /i.test(line)) {
      value = line.substring(2).trim();
      material.alpha = correctAlpha(parseFloat(value));
    } else if (/^Tr /i.test(line)) {
      value = line.substring(3).trim();
      material.alpha = correctAlpha(1.0 - parseFloat(value));
    } else if (/^map_Ka /i.test(line)) {
      if (!defined(overridingAmbientTexture)) {
        material.ambientTexture = normalizeTexturePath(
          line.substring(7).trim(),
          mtlDirectory
        );
      }
    } else if (/^map_Ke /i.test(line)) {
      if (!defined(overridingEmissiveTexture)) {
        material.emissiveTexture = normalizeTexturePath(
          line.substring(7).trim(),
          mtlDirectory
        );
      }
    } else if (/^map_Kd /i.test(line)) {
      if (!defined(overridingDiffuseTexture)) {
        material.diffuseTexture = normalizeTexturePath(
          line.substring(7).trim(),
          mtlDirectory
        );
      }
    } else if (/^map_Ks /i.test(line)) {
      if (!defined(overridingSpecularTexture)) {
        material.specularTexture = normalizeTexturePath(
          line.substring(7).trim(),
          mtlDirectory
        );
      }
    } else if (/^map_Ns /i.test(line)) {
      if (!defined(overridingSpecularShininessTexture)) {
        material.specularShininessTexture = normalizeTexturePath(
          line.substring(7).trim(),
          mtlDirectory
        );
      }
    } else if (/^map_Bump /i.test(line)) {
      if (!defined(overridingNormalTexture)) {
        material.normalTexture = normalizeTexturePath(
          line.substring(9).trim(),
          mtlDirectory
        );
      }
    } else if (/^map_d /i.test(line)) {
      if (!defined(overridingAlphaTexture)) {
        material.alphaTexture = normalizeTexturePath(
          line.substring(6).trim(),
          mtlDirectory
        );
      }
    }
  }

  function loadMaterialTextures(material) {
    // If an alpha texture is present the diffuse texture needs to be decoded so they can be packed together
    const diffuseAlphaTextureOptions = defined(material.alphaTexture)
      ? alphaTextureOptions
      : diffuseTextureOptions;

    if (material.diffuseTexture === material.ambientTexture) {
      // OBJ models are often exported with the same texture in the diffuse and ambient slots but this is typically not desirable, particularly
      // when saving with PBR materials where the ambient texture is treated as the occlusion texture.
      material.ambientTexture = undefined;
    }

    const textureNames = [
      "diffuseTexture",
      "ambientTexture",
      "emissiveTexture",
      "specularTexture",
      "specularShininessTexture",
      "normalTexture",
      "alphaTexture",
    ];
    const textureOptions = [
      diffuseAlphaTextureOptions,
      ambientTextureOptions,
      emissiveTextureOptions,
      specularTextureOptions,
      specularShinessTextureOptions,
      normalTextureOptions,
      alphaTextureOptions,
    ];

    const sharedOptions = {};
    textureNames.forEach(function (name, index) {
      const texturePath = material[name];
      const originalOptions = textureOptions[index];
      if (defined(texturePath) && defined(originalOptions)) {
        if (!defined(sharedOptions[texturePath])) {
          sharedOptions[texturePath] = clone(originalOptions);
        }
        const options = sharedOptions[texturePath];
        options.checkTransparency =
          options.checkTransparency || originalOptions.checkTransparency;
        options.decode = options.decode || originalOptions.decode;
        options.keepSource =
          options.keepSource ||
          !originalOptions.decode ||
          !originalOptions.checkTransparency;
      }
    });

    textureNames.forEach(function (name) {
      const texturePath = material[name];
      if (defined(texturePath)) {
        loadMaterialTexture(
          material,
          name,
          sharedOptions[texturePath],
          mtlDirectory,
          texturePromiseMap,
          texturePromises,
          options
        );
      }
    });
  }

  return readLines(mtlPath, parseLine)
    .then(function () {
      const length = materials.length;
      for (let i = 0; i < length; ++i) {
        loadMaterialTextures(materials[i]);
      }
      return Promise.all(texturePromises);
    })
    .then(function () {
      return convertMaterials(materials, options);
    });
}

function correctAlpha(alpha) {
  // An alpha of 0.0 usually implies a problem in the export, change to 1.0 instead
  return alpha === 0.0 ? 1.0 : alpha;
}

function Material() {
  this.name = undefined;
  this.ambientColor = [0.0, 0.0, 0.0, 1.0]; // Ka
  this.emissiveColor = [0.0, 0.0, 0.0, 1.0]; // Ke
  this.diffuseColor = [0.5, 0.5, 0.5, 1.0]; // Kd
  this.specularColor = [0.0, 0.0, 0.0, 1.0]; // Ks
  this.specularShininess = 0.0; // Ns
  this.alpha = 1.0; // d / Tr
  this.ambientTexture = undefined; // map_Ka
  this.emissiveTexture = undefined; // map_Ke
  this.diffuseTexture = undefined; // map_Kd
  this.specularTexture = undefined; // map_Ks
  this.specularShininessTexture = undefined; // map_Ns
  this.normalTexture = undefined; // map_Bump
  this.alphaTexture = undefined; // map_d
}

loadMtl.getDefaultMaterial = function (options) {
  return convertMaterial(new Material(), options);
};

// Exposed for testing
loadMtl._createMaterial = function (materialOptions, options) {
  return convertMaterial(combine(materialOptions, new Material()), options);
};

function loadMaterialTexture(
  material,
  name,
  textureOptions,
  mtlDirectory,
  texturePromiseMap,
  texturePromises,
  options
) {
  const texturePath = material[name];
  if (!defined(texturePath)) {
    return;
  }

  let texturePromise = texturePromiseMap[texturePath];
  if (!defined(texturePromise)) {
    const shallowPath = path.join(mtlDirectory, path.basename(texturePath));
    if (options.secure && outsideDirectory(texturePath, mtlDirectory)) {
      // Try looking for the texture in the same directory as the obj
      options.logger(
        "Texture file is outside of the mtl directory and the secure flag is true. Attempting to read the texture file from within the obj directory instead."
      );
      texturePromise = loadTexture(shallowPath, textureOptions).catch(function (
        error
      ) {
        options.logger(error.message);
        options.logger(
          "Could not read texture file at " +
            shallowPath +
            ". This texture will be ignored"
        );
      });
    } else {
      texturePromise = loadTexture(texturePath, textureOptions)
        .catch(function (error) {
          // Try looking for the texture in the same directory as the obj
          options.logger(error.message);
          options.logger(
            "Could not read texture file at " +
              texturePath +
              ". Attempting to read the texture file from within the obj directory instead."
          );
          return loadTexture(shallowPath, textureOptions);
        })
        .catch(function (error) {
          options.logger(error.message);
          options.logger(
            "Could not read texture file at " +
              shallowPath +
              ". This texture will be ignored."
          );
        });
    }
    texturePromiseMap[texturePath] = texturePromise;
  }

  texturePromises.push(
    texturePromise.then(function (texture) {
      material[name] = texture;
    })
  );
}

function convertMaterial(material, options) {
  if (options.specularGlossiness) {
    return createSpecularGlossinessMaterial(material, options);
  } else if (options.metallicRoughness) {
    return createMetallicRoughnessMaterial(material, options);
  }
  // No material type specified, convert the material to metallic roughness
  convertTraditionalToMetallicRoughness(material);
  return createMetallicRoughnessMaterial(material, options);
}

function convertMaterials(materials, options) {
  return materials.map(function (material) {
    return convertMaterial(material, options);
  });
}

function resizeChannel(
  sourcePixels,
  sourceWidth,
  sourceHeight,
  targetPixels,
  targetWidth,
  targetHeight
) {
  // Nearest neighbor sampling
  const widthRatio = sourceWidth / targetWidth;
  const heightRatio = sourceHeight / targetHeight;

  for (let y = 0; y < targetHeight; ++y) {
    for (let x = 0; x < targetWidth; ++x) {
      const targetIndex = y * targetWidth + x;
      const sourceY = Math.round(y * heightRatio);
      const sourceX = Math.round(x * widthRatio);
      const sourceIndex = sourceY * sourceWidth + sourceX;
      const sourceValue = sourcePixels.readUInt8(sourceIndex);
      targetPixels.writeUInt8(sourceValue, targetIndex);
    }
  }
  return targetPixels;
}

let scratchResizeChannel;

function getTextureChannel(
  texture,
  index,
  targetWidth,
  targetHeight,
  targetChannel
) {
  const pixels = texture.pixels; // RGBA
  const sourceWidth = texture.width;
  const sourceHeight = texture.height;
  const sourcePixelsLength = sourceWidth * sourceHeight;
  const targetPixelsLength = targetWidth * targetHeight;

  // Allocate the scratchResizeChannel on demand if the texture needs to be resized
  let sourceChannel = targetChannel;
  if (sourcePixelsLength > targetPixelsLength) {
    if (
      !defined(scratchResizeChannel) ||
      sourcePixelsLength > scratchResizeChannel.length
    ) {
      scratchResizeChannel = Buffer.alloc(sourcePixelsLength);
    }
    sourceChannel = scratchResizeChannel;
  }

  for (let i = 0; i < sourcePixelsLength; ++i) {
    const value = pixels.readUInt8(i * 4 + index);
    sourceChannel.writeUInt8(value, i);
  }

  if (sourcePixelsLength > targetPixelsLength) {
    resizeChannel(
      sourceChannel,
      sourceWidth,
      sourceHeight,
      targetChannel,
      targetWidth,
      targetHeight
    );
  }

  return targetChannel;
}

function writeChannel(pixels, channel, index) {
  const pixelsLength = pixels.length / 4;
  for (let i = 0; i < pixelsLength; ++i) {
    const value = channel.readUInt8(i);
    pixels.writeUInt8(value, i * 4 + index);
  }
}

function getMinimumDimensions(textures, options) {
  let width = Number.POSITIVE_INFINITY;
  let height = Number.POSITIVE_INFINITY;

  const length = textures.length;
  for (let i = 0; i < length; ++i) {
    const texture = textures[i];
    width = Math.min(texture.width, width);
    height = Math.min(texture.height, height);
  }

  for (let i = 0; i < length; ++i) {
    const texture = textures[i];
    if (texture.width !== width || texture.height !== height) {
      options.logger(
        "Texture " +
          texture.path +
          " will be scaled from " +
          texture.width +
          "x" +
          texture.height +
          " to " +
          width +
          "x" +
          height +
          "."
      );
    }
  }

  return [width, height];
}

function isChannelSingleColor(buffer) {
  const first = buffer.readUInt8(0);
  const length = buffer.length;
  for (let i = 1; i < length; ++i) {
    if (buffer[i] !== first) {
      return false;
    }
  }
  return true;
}

function createDiffuseAlphaTexture(diffuseTexture, alphaTexture, options) {
  const packDiffuse = defined(diffuseTexture);
  const packAlpha = defined(alphaTexture);

  if (!packDiffuse) {
    return undefined;
  }

  if (!packAlpha) {
    return diffuseTexture;
  }

  if (diffuseTexture === alphaTexture) {
    return diffuseTexture;
  }

  if (!defined(diffuseTexture.pixels) || !defined(alphaTexture.pixels)) {
    options.logger(
      "Could not get decoded texture data for " +
        diffuseTexture.path +
        " or " +
        alphaTexture.path +
        ". The material will be created without an alpha texture."
    );
    return diffuseTexture;
  }

  const packedTextures = [diffuseTexture, alphaTexture];
  const dimensions = getMinimumDimensions(packedTextures, options);
  const width = dimensions[0];
  const height = dimensions[1];
  const pixelsLength = width * height;
  const pixels = Buffer.alloc(pixelsLength * 4, 0xff); // Initialize with 4 channels
  const scratchChannel = Buffer.alloc(pixelsLength);

  // Write into the R, G, B channels
  const redChannel = getTextureChannel(
    diffuseTexture,
    0,
    width,
    height,
    scratchChannel
  );
  writeChannel(pixels, redChannel, 0);
  const greenChannel = getTextureChannel(
    diffuseTexture,
    1,
    width,
    height,
    scratchChannel
  );
  writeChannel(pixels, greenChannel, 1);
  const blueChannel = getTextureChannel(
    diffuseTexture,
    2,
    width,
    height,
    scratchChannel
  );
  writeChannel(pixels, blueChannel, 2);

  // First try reading the alpha component from the alpha channel, but if it is a single color read from the red channel instead.
  let alphaChannel = getTextureChannel(
    alphaTexture,
    3,
    width,
    height,
    scratchChannel
  );
  if (isChannelSingleColor(alphaChannel)) {
    alphaChannel = getTextureChannel(
      alphaTexture,
      0,
      width,
      height,
      scratchChannel
    );
  }
  writeChannel(pixels, alphaChannel, 3);

  const texture = new Texture();
  texture.name = diffuseTexture.name;
  texture.extension = ".png";
  texture.pixels = pixels;
  texture.width = width;
  texture.height = height;
  texture.transparent = true;

  return texture;
}

function createMetallicRoughnessTexture(
  metallicTexture,
  roughnessTexture,
  occlusionTexture,
  options
) {
  if (defined(options.overridingTextures.metallicRoughnessOcclusionTexture)) {
    return metallicTexture;
  }

  const packMetallic = defined(metallicTexture);
  const packRoughness = defined(roughnessTexture);
  const packOcclusion = defined(occlusionTexture) && options.packOcclusion;

  if (!packMetallic && !packRoughness) {
    return undefined;
  }

  if (packMetallic && !defined(metallicTexture.pixels)) {
    options.logger(
      "Could not get decoded texture data for " +
        metallicTexture.path +
        ". The material will be created without a metallicRoughness texture."
    );
    return undefined;
  }

  if (packRoughness && !defined(roughnessTexture.pixels)) {
    options.logger(
      "Could not get decoded texture data for " +
        roughnessTexture.path +
        ". The material will be created without a metallicRoughness texture."
    );
    return undefined;
  }

  if (packOcclusion && !defined(occlusionTexture.pixels)) {
    options.logger(
      "Could not get decoded texture data for " +
        occlusionTexture.path +
        ". The occlusion texture will not be packed in the metallicRoughness texture."
    );
    return undefined;
  }

  const packedTextures = [
    metallicTexture,
    roughnessTexture,
    occlusionTexture,
  ].filter(function (texture) {
    return defined(texture) && defined(texture.pixels);
  });

  const dimensions = getMinimumDimensions(packedTextures, options);
  const width = dimensions[0];
  const height = dimensions[1];
  const pixelsLength = width * height;
  const pixels = Buffer.alloc(pixelsLength * 4, 0xff); // Initialize with 4 channels, unused channels will be white
  const scratchChannel = Buffer.alloc(pixelsLength);

  if (packMetallic) {
    // Write into the B channel
    const metallicChannel = getTextureChannel(
      metallicTexture,
      0,
      width,
      height,
      scratchChannel
    );
    writeChannel(pixels, metallicChannel, 2);
  }

  if (packRoughness) {
    // Write into the G channel
    const roughnessChannel = getTextureChannel(
      roughnessTexture,
      0,
      width,
      height,
      scratchChannel
    );
    writeChannel(pixels, roughnessChannel, 1);
  }

  if (packOcclusion) {
    // Write into the R channel
    const occlusionChannel = getTextureChannel(
      occlusionTexture,
      0,
      width,
      height,
      scratchChannel
    );
    writeChannel(pixels, occlusionChannel, 0);
  }

  const length = packedTextures.length;
  const names = new Array(length);
  for (let i = 0; i < length; ++i) {
    names[i] = packedTextures[i].name;
  }
  const name = names.join("_");

  const texture = new Texture();
  texture.name = name;
  texture.extension = ".png";
  texture.pixels = pixels;
  texture.width = width;
  texture.height = height;

  return texture;
}

function createSpecularGlossinessTexture(
  specularTexture,
  glossinessTexture,
  options
) {
  if (defined(options.overridingTextures.specularGlossinessTexture)) {
    return specularTexture;
  }

  const packSpecular = defined(specularTexture);
  const packGlossiness = defined(glossinessTexture);

  if (!packSpecular && !packGlossiness) {
    return undefined;
  }

  if (packSpecular && !defined(specularTexture.pixels)) {
    options.logger(
      "Could not get decoded texture data for " +
        specularTexture.path +
        ". The material will be created without a specularGlossiness texture."
    );
    return undefined;
  }

  if (packGlossiness && !defined(glossinessTexture.pixels)) {
    options.logger(
      "Could not get decoded texture data for " +
        glossinessTexture.path +
        ". The material will be created without a specularGlossiness texture."
    );
    return undefined;
  }

  const packedTextures = [specularTexture, glossinessTexture].filter(function (
    texture
  ) {
    return defined(texture) && defined(texture.pixels);
  });

  const dimensions = getMinimumDimensions(packedTextures, options);
  const width = dimensions[0];
  const height = dimensions[1];
  const pixelsLength = width * height;
  const pixels = Buffer.alloc(pixelsLength * 4, 0xff); // Initialize with 4 channels, unused channels will be white
  const scratchChannel = Buffer.alloc(pixelsLength);

  if (packSpecular) {
    // Write into the R, G, B channels
    const redChannel = getTextureChannel(
      specularTexture,
      0,
      width,
      height,
      scratchChannel
    );
    writeChannel(pixels, redChannel, 0);
    const greenChannel = getTextureChannel(
      specularTexture,
      1,
      width,
      height,
      scratchChannel
    );
    writeChannel(pixels, greenChannel, 1);
    const blueChannel = getTextureChannel(
      specularTexture,
      2,
      width,
      height,
      scratchChannel
    );
    writeChannel(pixels, blueChannel, 2);
  }

  if (packGlossiness) {
    // Write into the A channel
    const glossinessChannel = getTextureChannel(
      glossinessTexture,
      0,
      width,
      height,
      scratchChannel
    );
    writeChannel(pixels, glossinessChannel, 3);
  }

  const length = packedTextures.length;
  const names = new Array(length);
  for (let i = 0; i < length; ++i) {
    names[i] = packedTextures[i].name;
  }
  const name = names.join("_");

  const texture = new Texture();
  texture.name = name;
  texture.extension = ".png";
  texture.pixels = pixels;
  texture.width = width;
  texture.height = height;

  return texture;
}

function createSpecularGlossinessMaterial(material, options) {
  const emissiveTexture = material.emissiveTexture;
  const normalTexture = material.normalTexture;
  const occlusionTexture = material.ambientTexture;
  const diffuseTexture = material.diffuseTexture;
  const alphaTexture = material.alphaTexture;
  const specularTexture = material.specularTexture;
  const glossinessTexture = material.specularShininessTexture;
  const specularGlossinessTexture = createSpecularGlossinessTexture(
    specularTexture,
    glossinessTexture,
    options
  );
  const diffuseAlphaTexture = createDiffuseAlphaTexture(
    diffuseTexture,
    alphaTexture,
    options
  );

  let emissiveFactor = material.emissiveColor.slice(0, 3);
  let diffuseFactor = material.diffuseColor;
  let specularFactor = material.specularColor.slice(0, 3);
  let glossinessFactor = material.specularShininess;

  if (defined(emissiveTexture)) {
    emissiveFactor = [1.0, 1.0, 1.0];
  }

  if (defined(diffuseTexture)) {
    diffuseFactor = [1.0, 1.0, 1.0, 1.0];
  }

  if (defined(specularTexture)) {
    specularFactor = [1.0, 1.0, 1.0];
  }

  if (defined(glossinessTexture)) {
    glossinessFactor = 1.0;
  }

  let transparent = false;
  if (defined(alphaTexture)) {
    transparent = true;
  } else {
    const alpha = material.alpha;
    diffuseFactor[3] = alpha;
    transparent = alpha < 1.0;
  }

  if (defined(diffuseTexture)) {
    transparent = transparent || diffuseTexture.transparent;
  }

  const doubleSided = transparent;
  const alphaMode = transparent ? "BLEND" : "OPAQUE";

  return {
    name: material.name,
    extensions: {
      KHR_materials_pbrSpecularGlossiness: {
        diffuseTexture: diffuseAlphaTexture,
        specularGlossinessTexture: specularGlossinessTexture,
        diffuseFactor: diffuseFactor,
        specularFactor: specularFactor,
        glossinessFactor: glossinessFactor,
      },
    },
    emissiveTexture: emissiveTexture,
    normalTexture: normalTexture,
    occlusionTexture: occlusionTexture,
    emissiveFactor: emissiveFactor,
    alphaMode: alphaMode,
    doubleSided: doubleSided,
  };
}

function createMetallicRoughnessMaterial(material, options) {
  const emissiveTexture = material.emissiveTexture;
  const normalTexture = material.normalTexture;
  let occlusionTexture = material.ambientTexture;
  const baseColorTexture = material.diffuseTexture;
  const alphaTexture = material.alphaTexture;
  const metallicTexture = material.specularTexture;
  const roughnessTexture = material.specularShininessTexture;
  const metallicRoughnessTexture = createMetallicRoughnessTexture(
    metallicTexture,
    roughnessTexture,
    occlusionTexture,
    options
  );
  const diffuseAlphaTexture = createDiffuseAlphaTexture(
    baseColorTexture,
    alphaTexture,
    options
  );

  if (options.packOcclusion) {
    occlusionTexture = metallicRoughnessTexture;
  }

  let emissiveFactor = material.emissiveColor.slice(0, 3);
  let baseColorFactor = material.diffuseColor;
  let metallicFactor = material.specularColor[0];
  let roughnessFactor = material.specularShininess;

  if (defined(emissiveTexture)) {
    emissiveFactor = [1.0, 1.0, 1.0];
  }

  if (defined(baseColorTexture)) {
    baseColorFactor = [1.0, 1.0, 1.0, 1.0];
  }

  if (defined(metallicTexture)) {
    metallicFactor = 1.0;
  }

  if (defined(roughnessTexture)) {
    roughnessFactor = 1.0;
  }

  let transparent = false;
  if (defined(alphaTexture)) {
    transparent = true;
  } else {
    const alpha = material.alpha;
    baseColorFactor[3] = alpha;
    transparent = alpha < 1.0;
  }

  if (defined(baseColorTexture)) {
    transparent = transparent || baseColorTexture.transparent;
  }

  const doubleSided = transparent;
  const alphaMode = transparent ? "BLEND" : "OPAQUE";

  return {
    name: material.name,
    pbrMetallicRoughness: {
      baseColorTexture: diffuseAlphaTexture,
      metallicRoughnessTexture: metallicRoughnessTexture,
      baseColorFactor: baseColorFactor,
      metallicFactor: metallicFactor,
      roughnessFactor: roughnessFactor,
    },
    emissiveTexture: emissiveTexture,
    normalTexture: normalTexture,
    occlusionTexture: occlusionTexture,
    emissiveFactor: emissiveFactor,
    alphaMode: alphaMode,
    doubleSided: doubleSided,
  };
}

function luminance(color) {
  return color[0] * 0.2125 + color[1] * 0.7154 + color[2] * 0.0721;
}

function convertTraditionalToMetallicRoughness(material) {
  // Translate the blinn-phong model to the pbr metallic-roughness model
  // Roughness factor is a combination of specular intensity and shininess
  // Metallic factor is 0.0
  // Textures are not converted for now
  const specularIntensity = luminance(material.specularColor);

  // Transform from 0-1000 range to 0-1 range. Then invert.
  let roughnessFactor = material.specularShininess;
  roughnessFactor = roughnessFactor / 1000.0;
  roughnessFactor = 1.0 - roughnessFactor;
  roughnessFactor = CesiumMath.clamp(roughnessFactor, 0.0, 1.0);

  // Low specular intensity values should produce a rough material even if shininess is high.
  if (specularIntensity < 0.1) {
    roughnessFactor *= 1.0 - specularIntensity;
  }

  const metallicFactor = 0.0;

  material.specularColor = [
    metallicFactor,
    metallicFactor,
    metallicFactor,
    1.0,
  ];
  material.specularShininess = roughnessFactor;
}
