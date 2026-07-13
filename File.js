"use strict";

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

module.exports = File;
function File( _version){
	this.version = _version;
}

File.prototype.fromDisk = function( fileIn, orgName, cb){
	if ( !fileExists( fileIn ) )
		throw "File can't be readed";

	this.path = fileIn;
	if (orgName)
		this.name = orgName;
	else
		this.name = path.basename( fileIn );

	// El largo del nombre viaja en un solo byte, y se escribe en UTF-8:
	// el límite es 255 bytes, no 256 caracteres.
	if (Buffer.byteLength(this.name, "utf8") > 255)
		throw new Error("Filename must be at most 255 bytes (UTF-8)");


	fs.readFile( fileIn, ( err, _buffer) => {

		zlib.gzip( _buffer, {level: 9}, (err, cbuffer) => {
			this.fileBuffer = cbuffer;
			cb(err, this.toBytes());
		});

	} )


}

File.prototype.toBytes = function(){
	let i;
	let bufferName = Buffer.from( this.name, "utf8");

	let total = 2 + bufferName.length + this.fileBuffer.length; // 1 version, 1 fnamesize, filename, filedata
	let buffer = Buffer.alloc(total);

	buffer[0] = this.version;
	buffer[1] = bufferName.length;
	let idx = 2;
	for(i=0; i<bufferName.length;i++){
		buffer[idx++] = bufferName[i];
	}
	for(i=0; i<this.fileBuffer.length;i++){
		buffer[idx++] = this.fileBuffer[i];
	}
	return buffer;
}


File.prototype.toDisk = function(buffer, fileOut, cb){
	let frame;
	try{
		frame = File.parseFrame( buffer );
	}catch(ex){
		return cb( ex.message );
	}

	this.version = 1;
	this.name = frame.name;

	File.writeGunzip( frame.payload, fileOut, (err) => {
		if (err) return cb(err);
		cb( undefined, this.name );     // se devuelve el nombre al terminar
	} );
}

// --- Framing (solo formato legacy) -----------------------------------------
//
// Las imágenes nuevas NO llevan frame: el nombre viaja en el prólogo (container.js) y
// la región codificada tiene solo el gzip. Esto queda para leer las imágenes viejas.
File.parseFrame = function( bytes ){
	const version = bytes[0];
	if (version !== 1)
		throw new Error("Not a valid MICodec file. Take care to don't use applications like hangout, whatsapp to transfer it, they modify de image.");

	const nameLen = bytes[1];
	return {
		name:    bytes.toString( "utf8", 2, 2 + nameLen ),
		payload: bytes.subarray( 2 + nameLen ),
	};
}

// --- gzip, sin framing -----------------------------------------------------
//
// El camino nuevo solo necesita comprimir/descomprimir: el nombre ya está en el prólogo.

File.gzipFile = function( fileIn, cb ){
	fs.readFile( fileIn, (err, buffer) => {
		if (err) return cb(err);
		zlib.gzip( buffer, { level: 9 }, cb );
	} );
}

File.writeGunzip = function( payload, fileOut, cb ){
	zlib.gunzip( payload, (err, out) => {
		if (err) return cb(err);
		try{
			fs.writeFileSync( fileOut, out );
			cb();
		}catch(ex){
			cb(ex);
		}
	} );
}

// Funcniones auxiliares
function fileExists(fileIn){
	try {
   	fs.accessSync( fileIn, fs.constants.F_OK);
		return true;
	} catch (e) {
		return false;
	}
}

/*
File.prototype.toArrayBuffer = function(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}
*/
