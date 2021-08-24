"use strict";
const loadTexture = require("../../lib/loadTexture");

const pngTexturePath = "specs/data/box-complex-material/shininess.png";
const jpgTexturePath = "specs/data/box-complex-material/emission.jpg";
const jpegTexturePath = "specs/data/box-complex-material/specular.jpeg";
const gifTexturePath = "specs/data/box-complex-material/ambient.gif";
const grayscaleTexturePath = "specs/data/box-complex-material-alpha/alpha.png";
const transparentTexturePath = "specs/data/box-complex-material/diffuse.png";

describe("loadTexture", () => {
  it("loads png texture", async () => {
    const texture = await loadTexture(pngTexturePath);
    expect(texture.transparent).toBe(false);
    expect(texture.source).toBeDefined();
    expect(texture.name).toBe("shininess");
    expect(texture.extension).toBe(".png");
    expect(texture.path).toBe(pngTexturePath);
    expect(texture.pixels).toBeUndefined();
    expect(texture.width).toBeUndefined();
    expect(texture.height).toBeUndefined();
  });

  it("loads jpg texture", async () => {
    const texture = await loadTexture(jpgTexturePath);
    expect(texture.transparent).toBe(false);
    expect(texture.source).toBeDefined();
    expect(texture.name).toBe("emission");
    expect(texture.extension).toBe(".jpg");
    expect(texture.path).toBe(jpgTexturePath);
    expect(texture.pixels).toBeUndefined();
    expect(texture.width).toBeUndefined();
    expect(texture.height).toBeUndefined();
  });

  it("loads jpeg texture", async () => {
    const texture = await loadTexture(jpegTexturePath);
    expect(texture.transparent).toBe(false);
    expect(texture.source).toBeDefined();
    expect(texture.name).toBe("specular");
    expect(texture.extension).toBe(".jpeg");
    expect(texture.path).toBe(jpegTexturePath);
    expect(texture.pixels).toBeUndefined();
    expect(texture.width).toBeUndefined();
    expect(texture.height).toBeUndefined();
  });

  it("loads gif texture", async () => {
    const texture = await loadTexture(gifTexturePath);
    expect(texture.transparent).toBe(false);
    expect(texture.source).toBeDefined();
    expect(texture.name).toBe("ambient");
    expect(texture.extension).toBe(".gif");
    expect(texture.path).toBe(gifTexturePath);
    expect(texture.pixels).toBeUndefined();
    expect(texture.width).toBeUndefined();
    expect(texture.height).toBeUndefined();
  });

  it("loads grayscale texture", async () => {
    const texture = await loadTexture(grayscaleTexturePath);
    expect(texture.transparent).toBe(false);
    expect(texture.source).toBeDefined();
    expect(texture.extension).toBe(".png");
  });

  it("loads texture with alpha channel", async () => {
    const texture = await loadTexture(transparentTexturePath);
    expect(texture.transparent).toBe(false);
  });

  it("loads texture with checkTransparency flag", async () => {
    const options = {
      checkTransparency: true,
    };
    const texture = await loadTexture(transparentTexturePath, options);
    expect(texture.transparent).toBe(true);
  });

  it("loads and decodes png", async () => {
    const options = {
      decode: true,
    };
    const texture = await loadTexture(pngTexturePath, options);
    expect(texture.pixels).toBeDefined();
    expect(texture.width).toBe(211);
    expect(texture.height).toBe(211);
  });

  it("loads and decodes jpeg", async () => {
    const options = {
      decode: true,
    };
    const texture = await loadTexture(jpegTexturePath, options);
    expect(texture.pixels).toBeDefined();
    expect(texture.width).toBe(211);
    expect(texture.height).toBe(211);
  });
});
