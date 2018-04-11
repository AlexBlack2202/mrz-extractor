# MRZ Extractor

Extracts a MRZ area from an image of an identity document (eg. passport, identity card, ...)

## Installation

Link the `mrz-extractor.js` file in the `<head>` section of the HTML file as:

```javascript
...
<head>
  <src script="mrz-extractor.js"/>
</head>
...
```

## Prerequisites

Link to `opencv.js` is also mandatory, because _mrz-extractor_ depends heavily on this library. Check out [OpenCV.js](https://docs.opencv.org/3.4.1/d5/d10/tutorial_js_root.html) tutorials and you can also use `opencv.js` file found in `test` folder.

### Usage

First, load any kind of image with an identity document to a canvas object. When canvas is painted, a call to `MrzExtractor` object can be made as:

```javascript
let canvas = document.querySelector('canvas');
...
let mrzExtractor = new MrzExtractor(canvas, false);
mrzExtractor.extractMRZ();
```

Function `extractMRZ()` extracts a MRZ area (if found) from the image and repaints the original image in the canvas with the extracted one. It also returns `true` or `false` if MRZ area is found on the image.

Second input attribute (eg. `new MrzExtractor(_, true|false)`) defines if the image is rotated 90 deg. clockwise before extraction. This is useful if the image of the document is taken with a mobile device in _portrait_ mode.

### Accuracy & precision

<a href="https://youtu.be/pjvQFtlNQ-M">Enough said</a>. But seriously. Some documents work like magic, others don't. It helps if the document occupies 2/3 of the view of the whole image and is aligned horizontally.

### Testing

Check out `test` folder where you can upload your own images of documents and test extraction of MRZ areas. 

__A note of warning__: currently extraction works only for two and three line MRZ areas.

### Contributing

I am __not__ a professional JavaScript developer and this is my first try at creating something useful with JavaScript. Any contribution to this repository is welcome via pull request.

#### References

This work is a partial rewrite of [Detecting MRZ in passport](https://www.pyimagesearch.com/2015/11/30/detecting-machine-readable-zones-in-passport-images/).
