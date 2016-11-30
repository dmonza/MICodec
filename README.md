# MICodec & PixelCodec.com
A picture is worth a thousand words... Literally! Encoding and transfer data through images

![Encoded Quijote book](https://raw.githubusercontent.com/dmonza/MICodec/master/quijote.png)

Table of Contents
-----------------
  * [Introduction](#introduction)
  * [Encode a File](#encode)
  * [Decode a File](#decode)
  * [Licence](LICENSE.md)

## Introduction
I want to introduce to you a project that I published at PixelCoded.com. It is an application that allows you to transfer data - any kind of file - as a picture. To do that, I use the "MICodec" 'codec - sold by sincrum.com - that I've created.
It started with the idea of creating digital art that could contain – encoded – information about what it represents. You can see an example in the website, in which a picture of "Don Quijote" can be decoded, and becomes the whole book!

Working on the idea, I got to the point where I could encode any file to a picture, and vice-versa.
This could be useful, for example, to send digital works. You could just send the picture from which the whole work could be decoded. Or be used to transfer some files that email servers usually block, or to encrypt sensitive information.
More and more uses for this codec keep coming up!

Something to keep in mind is that some applications, like Whatsapp and Hangouts can "optimize" the picture files being transferred to make them smaller. This will modify the file, and the encoded information will be lost.

I invite you to test it and give your opinion and feedback at: http://pixelcodec.com

## Encode a File
```javascript
const PixerEncode = require("micodec").MIEncode;
var enc = new PixerEncode();

// fileToImage( file_in, file_out, friendlyname(normally same as file_in), callback)
enc.fileToImage( "file_in.xls", "file_to.png", "friendlyname.xls", function(){
	console.log( "File encoded!");
} );
```

## Decode a File
```javascript
const PixerDecode = require("micodec").MIDecode;
var dec = new PixerDecode();

// imageToFile( png_encoded_file, destination_file, callback(err, friendlyname))
dec.imageToFile( "file_to.png", "file_in.xls", (err, name)=>{
	 // name: is the friendly name specified in fileToImage
	 console.log( "File decoded. Friendly name: " + name);
});
```
