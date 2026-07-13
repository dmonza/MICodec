#!/usr/bin/env node
"use strict";

// CLI de pruebas manuales. Herramienta interna: no se publica en el tarball de npm.
//
//   node bin/micodec.js encode <entrada> <salida.png> [--name <nombre>] [--codec pixel]
//   node bin/micodec.js decode <imagen> <salida>
//   node bin/micodec.js header <imagen>
//   node bin/micodec.js roundtrip <entrada>
//   node bin/micodec.js codecs

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs } = require('util');

const codecs = require('../codecs');
const container = require('../container');

const OPCIONES = {
	name:    { type: "string" },
	codec:   { type: "string" },
	verbose: { type: "boolean", short: "v", default: false },
	help:    { type: "boolean", short: "h", default: false },
};

const USO = `
MICodec — CLI de pruebas manuales

  encode <entrada> <salida.png>   Codifica un archivo dentro de una imagen
    --name <nombre>                Nombre que se embebe (default: basename de la entrada)
    --codec <nombre>               Códec a usar (default: pixel)

  decode <imagen> <salida>        Extrae el archivo de una imagen.
                                   El códec sale del header de la imagen. Si no tiene
                                   header, se asume el formato legacy.

  header <imagen>                 Muestra el header de la imagen sin decodificarla

  roundtrip <entrada>             Codifica y decodifica, y verifica que los bytes
                                   vuelvan idénticos. No deja nada en el disco.

  codecs                          Lista los códecs disponibles

  -v, --verbose                   Muestra tamaños y tiempos
  -h, --help                      Esta ayuda
`;

const kb = n => `${(n / 1024).toFixed(1)} KB`;

const encode = (fileIn, fileOut, nombre, codecName) => new Promise( (res, rej) =>
	codecs.encodeFile( fileIn, fileOut, nombre, codecName, (err, codec) => err ? rej(err) : res(codec) ) );

const decode = (imagen, fileOut) => new Promise( (res, rej) =>
	codecs.decodeFile( imagen, fileOut, (err, nombre, codec) => err ? rej(err) : res({ nombre, codec }) ) );

// --- comandos --------------------------------------------------------------

async function cmdEncode( [entrada, salida], opts, log ){
	if (!entrada || !salida)
		throw new Error("Faltan argumentos: encode <entrada> <salida.png>");

	const nombre = opts.name || path.basename(entrada);

	const t0 = process.hrtime.bigint();
	const codec = await encode( entrada, salida, nombre, opts.codec );
	const ms = Number(process.hrtime.bigint() - t0) / 1e6;

	console.log(`OK  ${entrada} -> ${salida}`);
	console.log(`    códec: ${codec.name}/${codec.version} (queda escrito en la imagen)`);
	log(`    nombre:   ${nombre}`);
	log(`    original: ${kb(fs.statSync(entrada).size)}`);
	log(`    imagen:   ${kb(fs.statSync(salida).size)}`);
	log(`    tiempo:   ${ms.toFixed(0)} ms`);
}

async function cmdDecode( [imagen, salida], opts, log ){
	if (!imagen || !salida)
		throw new Error("Faltan argumentos: decode <imagen> <salida>");

	const t0 = process.hrtime.bigint();
	const { nombre, codec } = await decode( imagen, salida );
	const ms = Number(process.hrtime.bigint() - t0) / 1e6;

	console.log(`OK  ${imagen} -> ${salida}`);
	console.log(`    nombre embebido: ${nombre}`);
	console.log(`    códec: ${codec.name}/${codec.version}` +
		(codec.name === "legacy" ? " (la imagen no tiene header)" : " (leído del header)"));
	log(`    salida: ${kb(fs.statSync(salida).size)}`);
	log(`    tiempo: ${ms.toFixed(0)} ms`);
}

// Lee el header sin decodificar la imagen. Es la forma barata de preguntarle a una
// imagen qué es.
function cmdHeader( [imagen] ){
	if (!imagen)
		throw new Error("Falta argumento: header <imagen>");

	const info = container.readFromImage( imagen );

	if (!info){
		console.log("sin header -> se asumiría el códec legacy");
		return;
	}

	console.log(`nombre:  ${info.nombre}`);
	console.log(`códec:   ${info.codec}/${info.version}`);
	console.log(`prólogo: ${info.preludeLen} bytes`);
}

// Encode + decode + comparación byte a byte. Es la prueba manual que más sirve.
// Decodifica SIN indicar el códec: así verifica también que el header se lea bien.
async function cmdRoundtrip( [entrada], opts, log ){
	if (!entrada)
		throw new Error("Falta argumento: roundtrip <entrada>");

	const tmp = fs.mkdtempSync( path.join(os.tmpdir(), "micodec-rt-") );
	const img = path.join(tmp, "rt.png");
	const out = path.join(tmp, "rt.out");

	try{
		const original = fs.readFileSync(entrada);
		const nombre = opts.name || path.basename(entrada);

		const usado = await encode( entrada, img, nombre, opts.codec );
		const { nombre: vuelto, codec: leido } = await decode( img, out );
		const recuperado = fs.readFileSync(out);

		const bytesOk  = Buffer.compare(original, recuperado) === 0;
		const nombreOk = vuelto === nombre;
		const codecOk  = leido.name === usado.name && leido.version === usado.version;

		log(`    imagen: ${kb(fs.statSync(img).size)} (de ${kb(original.length)} originales)`);
		console.log(`${bytesOk  ? "OK  " : "FALLA"} bytes ${bytesOk ? "idénticos" : `DISTINTOS (${original.length} -> ${recuperado.length})`}`);
		console.log(`${nombreOk ? "OK  " : "FALLA"} nombre ${nombreOk ? `"${vuelto}"` : `esperaba "${nombre}", vino "${vuelto}"`}`);
		console.log(`${codecOk  ? "OK  " : "FALLA"} códec  ${codecOk ? `header dice ${leido.name}/${leido.version}` : `codificó ${usado.name}/${usado.version} pero el header dice ${leido.name}/${leido.version}`}`);

		if (!bytesOk || !nombreOk || !codecOk) process.exitCode = 1;
	}finally{
		fs.rmSync( tmp, { recursive: true, force: true } );
	}
}

function cmdCodecs(){
	for (const c of codecs.list()){
		const id = `${c.name}/${c.version}`;
		console.log(`${id.padEnd(10)} ${c.outputExt.padEnd(6)} ${c.description}`);
	}
}

// --- main ------------------------------------------------------------------

async function main(){
	let parsed;
	try{
		parsed = parseArgs({ options: OPCIONES, allowPositionals: true });
	}catch(ex){
		console.error(`error: ${ex.message}`);
		console.error(USO);
		process.exit(2);
	}

	const { values: opts, positionals } = parsed;
	const [comando, ...resto] = positionals;

	if (opts.help || !comando){
		console.log(USO);
		return;
	}

	const log = opts.verbose ? console.log : () => {};

	const comandos = {
		encode: cmdEncode,
		decode: cmdDecode,
		header: cmdHeader,
		roundtrip: cmdRoundtrip,
		codecs: cmdCodecs,
	};

	if (!comandos[comando]){
		console.error(`error: comando desconocido "${comando}"`);
		console.error(USO);
		process.exit(2);
	}

	await comandos[comando]( resto, opts, log );
}

main().catch( ex => {
	console.error(`error: ${ex.message}`);
	process.exit(1);
} );
