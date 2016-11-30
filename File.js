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

	// console.log(this.name + this.name.length);
	if (this.name.length > 256)
		throw "Maximun file length is 256 chars";


	fs.readFile( fileIn, ( err, _buffer) => {

		zlib.gzip( _buffer, {level: 9}, (err, cbuffer) => {
			this.fileBuffer = cbuffer;
			cb(err, this.toBytes());
		});

	} )


}

File.prototype.toBytes = function(){
	let i;
	let bufferName = new Buffer( this.name, "utf8");

	let total = 2 + bufferName.length + this.fileBuffer.length; // 1 version, 1 fnamesize, filename, filedata
	let buffer = new Buffer(total);

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
	try{
		this.version = buffer[0];

		// Control de versión
		if (this.version > 1)
			return cb("Not a valid MICodec file. Take care to don't use applications like hangout, whatsapp to transfer it, they modify de image.");

		this.name = buffer.toString( "utf8", 2, buffer[1]+2);

		this.fileBuffer = new Buffer( buffer.length-2-buffer[1] );

		buffer.copy( this.fileBuffer, 0, 2+buffer[1]);

		console.log(`Version: ${this.version} Name:${this.name}` );

		zlib.gunzip( this.fileBuffer, {level: 9}, (err, cbuffer) => {
			try{
				fs.writeFileSync( fileOut, cbuffer);
				// return filename at finish
				cb(undefined, this.name );
			}catch(ex){
				cb(ex);
			}
		});
	}catch(ex){
		cb( ex );
	}
}

// Funcniones auxiliares
function fileExists(fileIn){
	try {
   	fs.accessSync( fileIn, fs.F_OK);
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
