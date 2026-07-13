"use strict";

// Registry de códecs + despacho.
//
// Un códec resuelve UN solo problema: cómo meter un puñado de bytes dentro de una
// imagen y cómo sacarlos. NO se ocupa del gzip ni del nombre del archivo: de eso se
// encargan File.js (compresión) y container.js (el prólogo con nombre + códec).
//
// Ya no se infiere nada: la imagen dice qué códec la generó. Si no lo dice, es legacy.
//
// Interfaz de un códec:
//
//   name        string   identificador; no puede contener ";"
//   version     int      versión del formato que emite
//   description string   una línea, se muestra en `codecs`
//   outputExt   string   extensión que emite (".png", ...)
//   lossy       bool     si tolera recompresión con pérdida
//   encode(prelude: Buffer, payload: Buffer, outPath: string): Promise<void>
//   decode(image, info): { payload: Buffer, name: string }
//   capacity(): number
//
// Si un códec necesita corrección de errores o sincronización, eso vive adentro del
// códec, entre los bytes y los píxeles. El framing y el prólogo no se enteran.

const fs = require('fs');
const PNG = require('pngjs').PNG;

const File = require('../File');
const container = require('../container');

const codecs = new Map();
const clave = (name, version) => `${name}/${version}`;

function register( codec ){
	const faltan = ["name", "version", "description", "outputExt", "encode", "decode"]
		.filter( k => codec[k] === undefined );
	if (faltan.length)
		throw new Error(`Códec inválido: le faltan ${faltan.join(", ")}`);

	// El ";" separa los campos del header: un nombre que lo contenga lo haría ambiguo.
	if (!/^[a-zA-Z0-9_-]+$/.test(codec.name))
		throw new Error(`Nombre de códec inválido: "${codec.name}" (solo letras, números, - y _)`);
	if (!Number.isInteger(codec.version) || codec.version < 0)
		throw new Error(`Versión de códec inválida: "${codec.version}"`);

	const k = clave(codec.name, codec.version);
	if (codecs.has(k))
		throw new Error(`Ya hay un códec registrado como ${k}`);

	codecs.set( k, codec );
	return codec;
}

function get( name, version ){
	const codec = codecs.get( clave(name, version) );
	if (!codec)
		throw new Error(
			`Esta imagen la generó el códec "${name}" v${version}, que esta versión de ` +
			`MICodec no conoce. Códecs disponibles: ${list().map(c => clave(c.name, c.version)).join(", ")}`
		);
	return codec;
}

// Busca por nombre la versión más alta registrada. Es lo que usa el encode.
function latest( name ){
	const candidatos = list().filter( c => c.name === name );
	if (!candidatos.length)
		throw new Error(`Códec desconocido: "${name}". Disponibles: ${[...new Set(list().map(c => c.name))].join(", ")}`);

	return candidatos.sort( (a, b) => b.version - a.version )[0];
}

function list(){
	return [...codecs.values()];
}

// --- despacho --------------------------------------------------------------

function encodeFile( fileIn, fileOut, nombre, codecName, cb ){
	let codec;
	try{
		codec = latest( codecName || "pixel" );
	}catch(ex){
		return cb(ex);
	}

	File.gzipFile( fileIn, (err, payload) => {
		if (err) return cb(err);

		let prelude;
		try{
			prelude = container.build( nombre, codec.name, codec.version );
		}catch(ex){
			return cb(ex);
		}

		codec.encode( prelude, payload, fileOut )
			.then( () => cb( undefined, codec ) )
			.catch( cb );
	} );
}

// Decodifica leyendo el header de la imagen. Sin header -> legacy.
function decodeFile( imageFile, fileOut, cb ){
	let image;
	try{
		image = PNG.sync.read( fs.readFileSync(imageFile) );
	}catch(ex){
		return cb( new Error(`No es un PNG legible: ${ex.message}`) );
	}

	// El prólogo se lee crudo, sin saber todavía qué códec es. Null = imagen legacy.
	const info = container.readFromPng( image );

	let codec, resultado;
	try{
		codec = info ? get( info.codec, info.version ) : get( "legacy", 0 );
		resultado = codec.decode( image, info );
	}catch(ex){
		return cb( (ex instanceof Error) ? ex : new Error(String(ex)) );
	}

	File.writeGunzip( resultado.payload, fileOut, (err) => {
		if (err) return cb(err);
		cb( undefined, resultado.name, codec );
	} );
}

register( require('./pixel') );
register( require('./legacy') );

module.exports = { register, get, latest, list, encodeFile, decodeFile };
