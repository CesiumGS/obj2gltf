'use strict';

module.exports = Texture;

/**
 * An object containing information about a texture.
 *
 * @private
 */
function Texture() {
    this.transparent = false;
    this.source = undefined;
    this.name = undefined;
    this.extension = undefined;
    this.path = undefined;
    this.pixels = undefined;
    this.width = undefined;
    this.height = undefined;
}
