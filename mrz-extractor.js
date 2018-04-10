
/**
 * 
 * Extracts a MRZ area from a image of a identity document (eg. Passport, Identity card, etc...).
 * 
 * @param {Canvas} canvas - JS object of the canvas where image with MRZ area is painted.
 * @param {boolean} [rotate=false] - Should the image in the canvas be rotated counter-clockwise 90 deg before MRZ area extraction.
 */
function MrzExtractor(canvas, rotate  = false) {
	
	this.canvas = canvas;
	this.rotate = rotate;

	this.original = null;		
	
	/**
	 * Main entry method to extract MRZ area from
	 * an image loaded into a canvas. 
	 * MRZ area is croped from the image and placed
	 * into the canvas.
	 */
	this.extractMRZ = () => {
		if (this.rotate) {
			this.rotateImage90();
		}

		this.poravnaj();
		this.mrz()	
	};
	
	/**
	 * Rotates image counter-clockwise for 90 deg.
	 * 
	 * Set input parameter 'rotate' to true if the image in canvas
	 * was taken in portrait mode.
	 */
	this.rotateImage90 = () => {
		let src = cv.imread('canvas');
		let dsize = new cv.Size(src.cols, src.rows);
		let center = new cv.Point(src.cols / 2, src.rows / 2);				
		let M = cv.getRotationMatrix2D(center, -90, 1);
		cv.warpAffine(src, src, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
		
		// Paint rotated image to canvas
		cv.imshow('canvas', src);

		dsize.delete();
		M.delete();
		src.delete();
	};
	
	/**
	 * Slightly rotates the image (for a few degress) so that the text 
	 * is horizontally aligned as possible.
	 */
	this.textAlignAdjustment = function() {

		// Returns an angle of Hough line
		let houghAngle = (p1,p2) => { Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI); };

		let src = cv.imread('canvas');
		let dst = new cv.Mat();
	
		// Convert the image to maximum height of 1200px
		let scaleW = src.size().height / 1200;
		let dsize = new cv.Size(src.size().width / scaleW, 1200);
		cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);
	
		// Kloniraj original
		original = dst.clone();
	
		
		cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
		let ksize = new cv.Size(3, 3);
		cv.GaussianBlur(dst, dst, ksize, 0, 0);
		
		// Blackhat morphology to identify black areas on light background
		let rectKernel = new cv.Mat();
		rectKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(16, 10));

		cv.Sobel(dst, dst, cv.CV_8U, 1, 0, 1);
		cv.convertScaleAbs(dst, dst, 1, 0);
	
		// Areas with text
		cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, rectKernel);
		cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
		
		let sqKernel = new cv.Mat();
		sqKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(31, 31));
		cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, sqKernel);
		let M = cv.Mat.ones(3, 3, cv.CV_8U);
		cv.erode(dst, dst, M, new cv.Point(-1,-1), 4);
		M.delete();
						
		// Hough lines				
		let lines = new cv.Mat();
		cv.Canny(dst, dst, 50, 200, 3);
		cv.HoughLinesP(dst, lines, 1, Math.PI / 180, 10, 100, 10);	
		let arrRotirajZa = new Array();		
		let color = new cv.Scalar(255, 0, 0);		
		for (let i = 0; i < lines.rows; ++i) {					
			let startPoint = new cv.Point(lines.data32S[i * 4], lines.data32S[i * 4 + 1]);
			let endPoint = new cv.Point(lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3]);					
			cv.line(dst, startPoint, endPoint, color);			
			arrRotirajZa.push(houghAngle(startPoint, endPoint));
		}
		lines.delete();
	
		// Multiple Hough lines can be found with different rotation angles.
		// Here we count in general which angles are most common.
		let counts = {};
		let kotInt = 0;
		arrRotirajZa.sort();				
		for(let i=0;i<arrRotirajZa.length; i++) {					
			kotInt = parseInt(arrRotirajZa[i], 10);
			// Angle is considered only if the difference between int part of
			// the angle and the angle itself is > 0.001
			// We do this, so that angles like 0 or 90 deg. fall out
			if (Math.abs(Math.abs(kotInt) - Math.abs(arrRotirajZa[i])) > 0.001) {
				counts[kotInt] = 1 + (counts[kotInt] || 0);
			}
		};
		let maxKotIdx = 0;
		let maxKot = 0;
		for(let i=0; i<Object.keys(counts).length; i++) {
			if (counts[Object.keys(counts)[i]] > maxKotIdx) {
				maxKotIdx = counts[Object.keys(counts)[i]];
				maxKot = Object.keys(counts)[i];
			}					
		};
		let rotirajZa = 0;
		for(let i=0;i<arrRotirajZa.length; i++) {
			if (parseInt(arrRotirajZa[i], 10) == maxKot) {
				rotirajZa = arrRotirajZa[i];
			}
		}
	
		if (rotirajZa < 0) {
			rotirajZa = 360 + rotirajZa;
		}
	
		// Make a rotation
		let dsize1 = new cv.Size(original.cols, original.rows);
		let center = new cv.Point(original.cols / 2, original.rows / 2);				
		let M1 = cv.getRotationMatrix2D(center, rotirajZa, 1);
		cv.warpAffine(original, original, M1, dsize1, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
		M1.delete();
	
		cv.imshow('canvas', original);

		src.delete(); dst.delete(); rectKernel.delete(); sqKernel.delete();
	};
	
	/**
	 * Finds a MRZ area/region and crops it.
	 */
	this.mrz = () => {
						
		let dst = new cv.Mat();
	
		// Jo pretvorimo v največ 1200px višine
		let scaleW = original.size().height / 1200;
		let dsize = new cv.Size(original.size().width / scaleW, 1200);
		cv.resize(original, dst, dsize, 0, 0, cv.INTER_AREA);
	
		// Kloniraj original
		original = dst.clone();
	
		// Pretvorimo v Greyscale
		cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
		
		// Smooth sliko z 3x3 Gaussian
		let ksize = new cv.Size(3, 3);
		cv.GaussianBlur(dst, dst, ksize, 0, 0);
		
		// Naredi Blackhat morfologijo, da identificiraš temna področja na svetlem ozadju				
		let rectKernel = new cv.Mat();
		rectKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(16, 10));
		cv.morphologyEx(dst, dst, cv.MORPH_BLACKHAT, rectKernel);
	
		// Izračunaj magnitudo gradienta z uporabo operatorja Scharr/Sobel
		cv.Sobel(dst, dst, cv.CV_8U, 1, 0, 1);
		cv.convertScaleAbs(dst, dst, 1, 0);
	
		//cv.imshow('canvas', dst);
	
		// Najdi območja, ki so tekstovno povezana
		cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, rectKernel);
		cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
		
		let sqKernel = new cv.Mat();
		sqKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(31, 31));
		cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, sqKernel);
		let M = cv.Mat.ones(3, 3, cv.CV_8U);
		cv.erode(dst, dst, M, new cv.Point(-1,-1), 4);
		M.delete();
	
		let contours = new cv.MatVector();
		let hierarchy = new cv.Mat();
		cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
		
		let mrzAreaFound = false;
	
		for (let i = 0; i < contours.size(); ++i) {
			let rect = cv.boundingRect(contours.get(i));
			
			let x = rect.x;
			let y = rect.y;
			let w = rect.width;
			let h = rect.height;
	
			let ar = rect.width / rect.height;
	
			if (ar > 5.0) {
				let pX = Math.floor((x+w) * 0.03);
				let pY = Math.floor((y+h) * 0.03);
				x = x - pX;
				y = y - pY;
				w = w + (pX * 2);
				h = h + (pY * 2);
	
				if (x < 0) { x = 0; };
				if (y < 0) { y = 0; };
				if (w < 0) { w = 0; };
				if (h < 0) { h = 0; };
	
				rect1 = new cv.Rect(x,y,w,h);						
				original = original.roi(rect1);
	
				mrzAreaFound = true;
	
				break;
			}					
		}
	
		if (mrzAreaFound == false) {			
			return false;
		}
	
		cv.imshow('canvas', original);
	
		dst.delete();
		sqKernel.delete(); rectKernel.delete();
		contours.delete(); hierarchy.delete();
		original.delete();
	
		return true;
	};

}

