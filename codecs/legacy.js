"use strict";

const PixerDecode = require('../MIDecode');
const File = require('../File');

// Formato original, anterior al prólogo. Las imágenes viejas no llevan ningún header,
// así que no hay nada que las identifique: se asume este códec cuando NO se encuentra
// el magic. Ese es todo el criterio.
//
// El algoritmo de píxeles es el mismo que "pixel", pero el layout es otro: sin prólogo,
// la tabla arranca en el slot 0 y el nombre del archivo viaja dentro de la región
// codificada, en un frame [versión][largo][nombre][gzip].
//
// SOLO LECTURA. No se puede encodear en este formato a propósito: las imágenes nuevas
// tienen que auto-describirse.
module.exports = {
	name: "legacy",
	version: 0,
	description: "Formato original, sin header. Solo lectura, para las imágenes ya existentes.",
	outputExt: ".png",
	lossy: false,

	encode(){
		throw new Error("El códec legacy es de solo lectura: las imágenes nuevas se generan con pixel/1.");
	},

	decode( image ){
		// Sin prólogo -> preludeLen = 0 -> la tabla arranca en el slot 0.
		const bytes = new PixerDecode().decodeImage( image, 0 );
		const frame = File.parseFrame( bytes );

		return { payload: frame.payload, name: frame.name };
	},

	capacity(){
		return Infinity;
	}
};
