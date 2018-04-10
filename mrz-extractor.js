
/**
 * Extracts a MRZ area from an image of an identity document (eg. Passport, Identity card, etc...).
 * 
 * @param {Canvas} canvas - JS object of the canvas where image with MRZ area is painted.
 * @param {boolean} [rotate=false] - Should the image in the canvas be rotated counter-clockwise 90 deg before MRZ area extraction?
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
		// Original image to process
		this.original = cv.imread(this.canvas);
		// Rotate if so directed
		if (this.rotate) {
			this.rotateImage90();
		}
		// Adjust text alignment and find MRZ area
		this.textAlignAdjustment();
		return this.findMRZArea();
	};
	
	/**
	 * Rotates image counter-clockwise for 90 deg.
	 * 
	 * Set input parameter 'rotate' to true if the image in canvas
	 * was taken in portrait mode.
	 */
	this.rotateImage90 = () => {		
		let dsize = new cv.Size(original.cols, original.rows);
		let center = new cv.Point(original.cols / 2, original.rows / 2);				
		let M = cv.getRotationMatrix2D(center, -90, 1);
		cv.warpAffine(original, original, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
		
		// Paint rotated image back to canvas
		cv.imshow(this.canvas, original);

		dsize.delete();
		M.delete();		
	};
	
	/**
	 * Slightly rotates the image (for a few degress) so that the text 
	 * is horizontally aligned as possible.
	 */
	this.textAlignAdjustment = () => {

		// Returns an angle of Hough line
		let houghAngle = (p1,p2) => { Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI); };

		// Convert the original image to maximum height of 1200px
		let scaleW = original.size().height / 1200;
		let dsize = new cv.Size(original.size().width / scaleW, 1200);
		cv.resize(original, original, dsize, 0, 0, cv.INTER_AREA);
	
		// Clone original because we do different things to image further on
		let dst = original.clone();
		
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
		let arrRotateForAngle = new Array();		
		let color = new cv.Scalar(255, 0, 0);		
		for (let i = 0; i < lines.rows; ++i) {					
			let startPoint = new cv.Point(lines.data32S[i * 4], lines.data32S[i * 4 + 1]);
			let endPoint = new cv.Point(lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3]);					
			cv.line(dst, startPoint, endPoint, color);			
			arrRotateForAngle.push(houghAngle(startPoint, endPoint));
		}
		lines.delete();
	
		// Multiple Hough lines can be found with different rotation angles.
		// Here we count in general which angles are most common.
		let counts = {};
		let kotInt = 0;
		arrRotateForAngle.sort();				
		for(let i=0;i<arrRotateForAngle.length; i++) {					
			kotInt = parseInt(arrRotateForAngle[i], 10);
			// Angle is considered only if the difference between int part of
			// the angle and the angle itself is > 0.001
			// We do this, so that angles like 0 or 90 deg. fall out
			if (Math.abs(Math.abs(kotInt) - Math.abs(arrRotateForAngle[i])) > 0.001) {
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
		let rotateForAngle = 0;
		for(let i=0;i<arrRotateForAngle.length; i++) {
			if (parseInt(arrRotateForAngle[i], 10) == maxKot) {
				rotateForAngle = arrRotateForAngle[i];
			}
		}
	
		if (rotateForAngle < 0) {
			rotateForAngle = 360 + rotateForAngle;
		}
	
		// Rotate original canvas image
		let dsize1 = new cv.Size(original.cols, original.rows);
		let center = new cv.Point(original.cols / 2, original.rows / 2);				
		let M1 = cv.getRotationMatrix2D(center, rotateForAngle, 1);
		cv.warpAffine(original, original, M1, dsize1, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
			
		cv.imshow(this.canvas, original);

		M1.delete();		
		dst.delete(); 
		rectKernel.delete(); 
		sqKernel.delete();
	};
	
	/**
	 * Finds a MRZ area/region and crops it.
	 */
	this.findMRZArea = () => {

		let dst = original.clone(); 

		cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);

		let ksize = new cv.Size(3, 3);
		cv.GaussianBlur(dst, dst, ksize, 0, 0);

		let rectKernel = new cv.Mat();
		rectKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(16, 10));
		cv.morphologyEx(dst, dst, cv.MORPH_BLACKHAT, rectKernel);

		cv.Sobel(dst, dst, cv.CV_8U, 1, 0, 1);
		cv.convertScaleAbs(dst, dst, 1, 0);

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
				original = original.roi(rect1);	// Crop MRZ area from original image
	
				mrzAreaFound = true;
	
				break;
			}					
		}
	
		if (mrzAreaFound == false) {			
			return false;
		}
	
		cv.imshow(this.canvas, original);
	
		dst.delete();
		sqKernel.delete(); rectKernel.delete();
		contours.delete(); hierarchy.delete();
		original.delete();
	
		return true;
	};

}

