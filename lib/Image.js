'use strict';

module.exports = Image;

/**
 * Stores image data and properties.
 *
 * @private
 */
function Image() {
    this.transparent = false;
    this.source = undefined;
    this.extension = undefined;
    this.path = undefined;
    this.decoded = undefined;
    this.width = undefined;
    this.height = undefined;
}
