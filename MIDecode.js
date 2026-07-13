"use strict";

const File = require('./File');
const PNG = require('pngjs').PNG;
const fs = require('fs');

const bpp = 2; // Problema utilizando alpha channel
const debug = false;
const invertColorBase = 200;

module.exports = PixerDecode;
function PixerDecode(){
}

// API pública de siempre. Ahora despacha por el header de la imagen: si trae prólogo,
// lo usa; si no, cae al códec legacy. El require es perezoso a propósito, para no armar
// un ciclo de módulos (codecs/pixel.js requiere este archivo).
PixerDecode.prototype.imageToFile = function( imageFile, fileTo, cb ){
	require('./codecs').decodeFile( imageFile, fileTo, cb );
}

// Saca de la imagen los bytes de la región codificada, salteando el prólogo.
// `preludeLen` es 0 para las imágenes legacy (no tienen prólogo).
PixerDecode.prototype.decodeImage = function( image, preludeLen ){
	this.data   = image.data;
	this.width  = image.width;
	this.height = image.height;

	this.imgDecode( preludeLen );

	// Los píxeles sobrantes de la imagen llegan acá como ceros al final.
	// No se recortan: un stream gzip se autodelimita, así que gunzip ignora todo lo
	// que venga después del trailer. Recortarlos era justamente el bug: el trailer
	// ISIZE del gzip termina en 0x00 para todo archivo < 16MB, y el recorte se lo
	// comía junto con el padding, dejando el stream truncado.
	return Buffer.from( this.buffer );
}

PixerDecode.prototype.imgDecode = function( preludeLen ){
	this.table = {};
	this.byteidx = 0;
	this.buffer = [];
	this.preludeLen = preludeLen || 0;

	for (let y = 0; y < this.height; y++) {
		for (let x = 0; x < this.width; x++) {
			for (let i = 0; i<bpp; i++){
				this.getPixelInfo( x, y, i);
			}
		}
	}

}

PixerDecode.prototype.getPixelInfo = function( x , y, channel){
	let idx = y*(this.width*4)+(x*4);

	let storedByte = this.data[idx+channel];

	// Valor ajustado según inversión
	let isColored = this.isColoredByChannel( channel, this.data[idx+bpp]);
	let charCode = storedByte;
	if (isColored) // para imágenes con fondo donde alpha
		charCode = 255 - charCode;

	const slot = this.byteidx++;

	// Prólogo: ya lo leyó container.js antes de elegir el códec. Acá se saltea.
	if (slot < this.preludeLen)
		return;

	const d = slot - this.preludeLen;

	if (d <= 255)
		this.table[d] = charCode;           // diccionario
	else
		this.buffer.push( this.getChar(charCode) );
}

PixerDecode.prototype.isColoredByChannel = function(channel, alpha){
	if (alpha==invertColorBase)
		return false;

	let fill = "0000";
	let bin = dec2bin(invertColorBase-alpha);

	// ajusta el binario siempre a 4 agregando 0. Ej.: 110 -> 0110
	let delta = 4-bin.length;
	if (delta > 0)
		bin = fill.substring( 0, delta) + bin;

	if (bin[4-channel-2]==="1")
		return true;
	else
		return false;
}



PixerDecode.prototype.getChar = function(val){
	for(var i=0; i<=255;i++){
		if (this.table[i]==val)
			return i;
	}
	return 0;
}

function dec2bin(dec){
    return (dec >>> 0).toString(2);
}

PixerDecode.prototype.saveData = function( fileName ){
	console.log(this.buffer);
};
