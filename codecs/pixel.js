"use strict";

const PixerEncode = require('../MIEncode');
const PixerDecode = require('../MIDecode');

// Códec original, ahora con nombre y versión propios: las imágenes que genera llevan
// prólogo y se auto-describen.
//
// Guarda 2 bytes crudos por píxel (canales R y G), con una tabla de sustitución
// aleatoria y un watermark que decide las inversiones. Al depender de los valores
// EXACTOS de cada píxel, no sobrevive a ninguna recompresión con pérdida ni a un
// resize. A cambio, la capacidad es enorme.
//
// Layout de byte-slots:  [prólogo crudo][tabla (256)][payload gzip]
module.exports = {
	name: "pixel",
	version: 1,
	description: "Píxel exacto, 2 bytes/píxel. Máxima capacidad, cero tolerancia a recompresión.",
	outputExt: ".png",
	lossy: false,

	// prólogo (crudo) + payload gzip -> imagen en disco
	encode( prelude, payload, outPath ){
		return new Promise( (resolve, reject) => {
			try{
				new PixerEncode().bytesToImage( prelude, payload, outPath, (err) => {
					if (err) reject( toError(err) );
					else resolve();
				} );
			}catch(ex){
				reject( toError(ex) );
			}
		} );
	},

	// imagen ya parseada + info del prólogo -> payload gzip y nombre del archivo.
	// El nombre sale del prólogo: acá no hay frame que parsear.
	decode( image, info ){
		return {
			payload: new PixerDecode().decodeImage( image, info.preludeLen ),
			name:    info.nombre,
		};
	},

	// La imagen crece según los datos, así que no hay techo práctico.
	capacity(){
		return Infinity;
	}
};

function toError(e){
	return (e instanceof Error) ? e : new Error(String(e));
}
