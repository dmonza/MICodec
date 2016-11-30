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

PixerDecode.prototype.imageToFile = function( imageFile, fileTo, cb ){
	fs.readFile( imageFile, (err, buff) => {
		try{
			let image = PNG.sync.read(buff);
			this.data = image.data;
			this.width  = image.width;
			this.height = image.height;
			console.log(`w: ${this.width} h: ${this.height}`);

			// ahora tenemos la estructura data de forma correcta
			this.imgDecode();

			// Return fixed buffer
			let i;
			let lastByte = this.buffer.length-1;

			// busca el último byte > 0
			for (i = (this.buffer.length-1); this.buffer[i]===0; i--) {
				lastByte = i;
			}
			console.log(`Totalbytes: ${this.buffer.length} LastByte: ${lastByte}`)

			let newBuffer = new Buffer(lastByte); // new Uint8Array(lastByte);
			for (i = 0; i < lastByte; i++) {
				 newBuffer[i] = this.buffer[i];
			}

			let f = new File(1);
			f.toDisk( newBuffer, fileTo, cb);
		}catch(ex){
			console.log(ex);
			cb("Not a valid MICodec file. Take care to don't use applications like hangout, whatsapp to transfer it, they modify de image.");
		}
	} );
}

PixerDecode.prototype.imgDecode = function(){
	this.table = {};
	this.byteidx = 0;
	this.buffer = [];

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

	let realChar = 0;

	if (this.byteidx<=255){
		this.table[this.byteidx] = charCode;
		if (charCode>0){
			realChar = this.byteidx;
		}
	}else{
		realChar = this.getChar(charCode);
		this.buffer.push(realChar);
	}

	this.byteidx++;
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
