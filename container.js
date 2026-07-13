"use strict";

// Prólogo: el header que hace que una imagen se auto-describa.
//
// Se escribe CRUDO en los primeros píxeles, antes de que empiece el códec. Tiene que
// ser así: el nombre del archivo y el payload los transforma el códec, y para leerlos
// habría que saber de antemano qué códec usar — que es justo lo que queremos averiguar.
// Sacando el header afuera de la región codificada, se lee sin saber nada.
//
//   byte 0..2   magic "MIC"
//   byte 3      versión del prólogo
//   byte 4..5   largo del header (uint16 big-endian)
//   byte 6..    header UTF-8: "<nombre>;<codec>;<version>"
//
// Sin magic -> la imagen es del formato viejo -> códec legacy.
//
// CONTRATO DE PÍXELES (nivel contenedor, lo debe respetar todo códec en esta región):
//   - 2 bytes por píxel, en los canales R y G
//   - canal B = 200 - 2*[R invertido] - 4*[G invertido]  (flags de inversión)
//   - alpha = 255
//   - bytes crudos: SIN tabla de sustitución
//
// La inversión de watermark SÍ se aplica al prólogo. Los flags viajan en el canal B,
// así que cualquier lector los deshace sin conocer el códec, y la imagen se sigue
// viendo como el dibujo. Si el prólogo fuera plano, en una imagen chica (un archivo de
// 1 byte da 11x15 px) sería una mancha del ~10% de los píxeles.

const fs = require('fs');
const PNG = require('pngjs').PNG;

const MAGIC = Buffer.from([0x4D, 0x49, 0x43]);   // "MIC"
const PRELUDE_VERSION = 1;
const FIJO = 6;                                   // magic(3) + versión(1) + largo(2)
const MAX_HEADER = 0xFFFF;

const bpp = 2;
const invertColorBase = 200;

// --- construcción ----------------------------------------------------------

function build( nombre, codecName, codecVersion ){
	if (String(codecName).includes(";"))
		throw new Error(`El nombre de un códec no puede contener ";" (vino "${codecName}")`);

	const header = Buffer.from( `${nombre};${codecName};${codecVersion}`, "utf8" );
	if (header.length > MAX_HEADER)
		throw new Error(`El header no entra: ${header.length} bytes, máximo ${MAX_HEADER}`);

	const buf = Buffer.alloc( FIJO + header.length );
	MAGIC.copy( buf, 0 );
	buf[3] = PRELUDE_VERSION;
	buf.writeUInt16BE( header.length, 4 );   // uint16, no 1 byte: el nombre solo ya
	header.copy( buf, 6 );                   // puede llegar a 255 bytes y desbordaría
	return buf;
}

// --- parseo ----------------------------------------------------------------

// Devuelve null (no tira) ante cualquier cosa que no sea un prólogo válido: null
// significa "imagen legacy", que es un caso normal, no un error.
function parse( bytes ){
	if (!bytes || bytes.length < FIJO)
		return null;
	if (!bytes.subarray(0, 3).equals(MAGIC))
		return null;
	if (bytes[3] !== PRELUDE_VERSION)
		return null;

	const headerLen = bytes.readUInt16BE(4);
	const preludeLen = FIJO + headerLen;
	if (bytes.length < preludeLen)
		return null;

	const header = bytes.toString( "utf8", FIJO, preludeLen );

	// UTF-8 inválido -> toString mete U+FFFD. Si aparece, no era un header nuestro.
	if (header.includes("�"))
		return null;

	// Se parsea DESDE LA DERECHA: el nombre de un archivo puede contener ";"
	// ("reporte;final.txt" es válido), así que un split(";") lo rompería. Los dos
	// últimos campos son códec y versión; todo lo que queda a la izquierda es nombre.
	const iVersion = header.lastIndexOf(";");
	if (iVersion < 0) return null;
	const iCodec = header.lastIndexOf( ";", iVersion - 1 );
	if (iCodec < 0) return null;

	const version = header.slice( iVersion + 1 );
	const codec   = header.slice( iCodec + 1, iVersion );
	const nombre  = header.slice( 0, iCodec );

	if (!/^\d+$/.test(version)) return null;
	if (!codec.length)          return null;

	return { nombre, codec, version: Number(version), preludeLen };
}

// --- lectura desde la imagen -----------------------------------------------

// ¿El canal `channel` de este píxel está invertido? Lo dice el canal B, que es
// convención del contenedor: se puede responder sin saber nada del códec.
function estaInvertido( channel, blue ){
	return ((invertColorBase - blue) & (1 << (channel + 1))) !== 0;
}

// Lee los primeros `count` byte-slots crudos, deshaciendo la inversión.
// Devuelve null si la imagen es más chica que eso.
function leerSlots( image, count ){
	const out = Buffer.alloc(count);

	for (let i = 0; i < count; i++){
		const idx = Math.floor(i / bpp) * 4;    // los píxeles son contiguos: pixel*4
		const channel = i % bpp;

		if (idx + bpp >= image.data.length)
			return null;

		let val = image.data[idx + channel];
		if (estaInvertido( channel, image.data[idx + bpp] ))
			val = 255 - val;

		out[i] = val;
	}
	return out;
}

// image ya parseado por pngjs -> info del prólogo, o null si es legacy.
function readFromPng( image ){
	const cabecera = leerSlots( image, FIJO );
	if (!cabecera) return null;

	if (!cabecera.subarray(0, 3).equals(MAGIC)) return null;
	if (cabecera[3] !== PRELUDE_VERSION)         return null;

	const total = FIJO + cabecera.readUInt16BE(4);
	return parse( leerSlots(image, total) );
}

function readFromImage( pngPath ){
	let image;
	try{
		image = PNG.sync.read( fs.readFileSync(pngPath) );
	}catch(ex){
		return null;    // no es un PNG legible
	}
	return readFromPng( image );
}

module.exports = {
	build, parse, readFromPng, readFromImage,
	MAGIC, PRELUDE_VERSION, invertColorBase, bpp,
};
