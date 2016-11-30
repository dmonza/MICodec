"use strict";

const File = require('./File');
const PNG = require('pngjs').PNG;
const fs = require('fs');
const path = require('path');

const bpp = 2; // Problema utilizando alpha channel
const ratio = 1.3333;
const debug = false;
const invertColorBase = 200;



module.exports = PixerEncode;
function PixerEncode(){
}

PixerEncode.prototype.fileToImage = function( fileIn, fileTo, orgName, cb ){
		this.currentChar = 0;
		this.fileIn = fileIn;
		this.fileTo = fileTo;

		this.name = orgName;

		let f = new File(1);
		f.fromDisk( this.fileIn, orgName, (err, buff) => {
			this.buffer = buff;
			this.processData(cb);

		} );
}

PixerEncode.prototype.processData = function( cb ){
	let pixels  = Math.ceil(( this.buffer.length+256)/bpp); // (3 pixel por letra) + diccionario

	this.width  = Math.ceil(Math.pow(pixels/ratio, 1/2));
	this.height = Math.ceil(ratio * this.width);

	// Image data array
	// this.data = [];
	this.data = new Uint8Array(this.width*this.height*4);

	this.wmark = new WaterMark( "baseimage.png", this.width, this.height);

	this.buildMapping();

	// Codify image
	for (let y = 0; y < this.height; y++) {
		for (let x = 0; x < this.width; x++) {
			for (let i = 0; i<bpp; i++){
				this.setPixelInfo( x, y, i);
			}
		}
	}

	// Create image
	let image = new PNG({
		width: this.width,
		height: this.height,
		filterType: 0,
		colorType: ((bpp == 2) ? 2 : 6)  // Según cantidad de byte per pixel
	});
	image.data = this.data;

	// let p = path.parse(this.fi)
	// let outFile = path.join( p.dir, p.name + ".png");
	let writer = fs.createWriteStream( this.fileTo );
	let stream = image.pack().pipe( writer );

	writer.on( 'finish', () => {
		// writer.end(cb);
		if (cb){
			cb(); // Se ejecuta callback con output file
		}

	});
}

PixerEncode.prototype.setPixelInfo = function( x, y, channel){
		let idx = y*(this.width*4)+(x*4);

		let isColored = this.wmark.getPixel(x,y);

		// Pixel initialize
		if (channel==0){
			this.data[idx+bpp] = invertColorBase;
			if (bpp<3)
				this.data[idx+3] = 255; // alpha
		}

		let realChar = this.nextChar();

		let charCode = 0;
		// Map char
		if (realChar>0)
			charCode = this.table[realChar];

		// Ajuste de inversión de pixel
		let invertir = false;
		if ( isColored ){
		 	if (charCode > 130){
				invertir = true;
			}
		}else {
			if (charCode <= 130){
				invertir = true;
			}
		}
		if (invertir){
			charCode = 255-charCode;
			this.data[idx+bpp] -= Math.pow(2,(channel+1));
		}

		this.data[idx+channel] = charCode;

		if (debug)
			console.log(`${realChar};${x},${y},${channel},${idx},${this.data[idx+bpp]};${charCode}`);
}

PixerEncode.prototype.nextChar = function(){
	// currentChar - Current byte to write
	let realChar = 0;

	// Si es menor a 255, se escribe el mapeo al inicio de la imagen
	if (this.currentChar<=255){
		// table[65] = 2 // 65 = A, 2 es el random number
		if (this.table[this.currentChar])
			realChar = this.currentChar;
	}else{
		realChar = this.buffer[ this.currentChar-256 ];
	}

	this.currentChar++;
	return realChar;
}

PixerEncode.prototype.buildMapping = function(){
	// Se inicializa el array de caracteres utilizados
	// En este array se van generando los mapeos con los nuevas correspondencias
	// Esto se hace para que las letras no queden en un grupo de la tabla ascii
	// arUsed[random] = 65; (A)
	// table[65] = randomNumber;
	this.table = {};
	let arUsed = [];
	for(var i=0; i<=255;i++){
		arUsed[i] = null;
	}

	for(var i=0; i< this.buffer.length;i++){
		var b = this.buffer[i];
		if (typeof this.table[b] === "undefined"){
			var newChar = this.nextUnused(arUsed, b);
			this.table[b] = newChar;
		}
	}
}

PixerEncode.prototype.nextUnused = function(ar,_code){
		if (_code==0)
			return 0;

		// posición 0, siempre retorna 0
		// para mantenerlo de referencia a nulls
		var _idx = -1;

		while( _idx==-1 || ar[_idx]!=null ){
			_idx = this.getRandomInt(1, 255);
		}

		ar[_idx] = _code;
		return _idx;
	}

PixerEncode.prototype.getRandomInt = function(min, max){
	  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// -----------------------------------
// WaterMark Class
function WaterMark(file, w, h){
		this.width = w;
		this.height = h;

		let data = fs.readFileSync("baseimage.png");
		this.image = PNG.sync.read(data);
		let buff = PNG.sync.write(this.image);
}

WaterMark.prototype.getPixel = function(_x,_y){
		let x = Math.floor( (this.image.width*_x)/this.width );
		let y = Math.floor( (this.image.height*_y)/this.height );

		let idx = y*(this.image.width*4)+(x*4)

		let val = this.image.data[idx];

		if (this.image.data[idx+1] < val)
			val = this.image.data[idx+1];
		else if(this.image.data[idx+2] < val)
			val = this.image.data[idx+2];

		if (val < 150)
			return true;
		else
			return false;
}
