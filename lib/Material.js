'use strict';

module.exports = Material;

function Material() {
    this.name = '';
    this.ambientColor = [0.0, 0.0, 0.0, 1.0];    // Ka
    this.emissiveColor = [0.0, 0.0, 0.0, 1.0];   // Ke
    this.diffuseColor = [0.5, 0.5, 0.5, 1.0];    // Kd
    this.specularColor = [0.0, 0.0, 0.0, 1.0];   // Ks
    this.specularShininess = 0.0;                // Ns
    this.alpha = 1.0;                            // d / Tr
    this.ambientTexture = undefined;             // map_Ka
    this.emissiveTexture = undefined;            // map_Ke
    this.diffuseTexture = undefined;             // map_Kd
    this.specularTexture = undefined;            // map_Ks
    this.specularShininessTexture = undefined;   // map_Ns
    this.normalTexture = undefined;              // map_Bump
    this.alphaTexture = undefined;               // map_d
}
