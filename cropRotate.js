import { GridDrawer } from './GridDrawer.js';
import { CropControls } from './CropControls.js';
import { CropInteraction } from './CropInteraction.js';

export class CropRotate {
    constructor(state, imageProcessor, cropModal, cropCanvas, cropCtx, effectsCanvas, effectsProcessor, mainCanvas, resizeCanvasDisplay) {
        this.state = state;
        this.imageProcessor = imageProcessor;
        this.cropModal = cropModal;
        this.cropCanvas = cropCanvas;
        this.cropCtx = cropCtx;
        this.effectsCanvas = effectsCanvas;
        this.effectsProcessor = effectsProcessor;
        this.mainCanvas = mainCanvas;
        this.resizeCanvasDisplay = resizeCanvasDisplay;

        this.cropImage = new Image();
        this.cropRect = { x: 0, y: 0, width: 0, height: 0 };
        this.lockAspectRatio = false;
        this.aspectRatio = 1;
        this.rotation = 0;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.previousRotation = 0;
        this.maxCanvasWidth = 0;
        this.maxCanvasHeight = 0;
        this.fixedScale = 0;
        this.gridType = 'cross';

        this.cropControls = new CropControls(this);
        this.cropInteraction = new CropInteraction(this);
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    simplifyAspectRatio(width, height) {
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        return `${width / divisor}:${height / divisor}`;
    }

    showCropModal(isBackground = false) {
        this.isBackgroundCrop = isBackground;
        this.cropModal.style.display = 'flex';
        this.cropImage.src = isBackground ? this.state.originalBackgroundImage.src : this.state.originalImage.src;
        this.originalWidth = isBackground ? this.state.originalBackgroundImage.width : this.state.originalImage.width;
        this.originalHeight = isBackground ? this.state.originalBackgroundImage.height : this.state.originalImage.height;
    
        const initializeCrop = () => {
            this.maxCanvasWidth = window.innerWidth * 0.9;
            this.maxCanvasHeight = 700;
            const buffer = 10;
    
            const referenceWidth = this.originalWidth;
            const referenceHeight = this.originalHeight;
            const maxDimension = Math.max(referenceWidth, referenceHeight);
            const maxRotatedSize = maxDimension * Math.sqrt(2);
    
            this.fixedScale = Math.min((this.maxCanvasWidth - buffer) / maxRotatedSize, (this.maxCanvasHeight - buffer) / maxRotatedSize, 1);
    
            const fullWidth = Math.round(maxRotatedSize * this.fixedScale);
            const fullHeight = Math.round(maxRotatedSize * this.fixedScale);
    
            this.cropCanvas.width = fullWidth;
            this.cropCanvas.height = fullHeight;
            this.cropCanvas.dataset.scaleFactor = this.fixedScale;
            this.cropCanvas.style.width = `${fullWidth}px`;
            this.cropCanvas.style.height = `${fullHeight}px`;
    
            this.effectsCanvas.width = fullWidth;
            this.effectsCanvas.height = fullHeight;
            this.effectsProcessor.setImage(this.cropImage);
    
            const currentSettings = isBackground ? this.state.backgroundCropSettings : this.state.cropSettings;
            const rotatedBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, this.rotation, this.fixedScale);
            const lastCropRect = isBackground ? this.state.lastBackgroundCropRect : this.state.lastMainCropRect;
    
            // Prioritize specific lastCropRect if it exists and matches the image dimensions
            if (
                lastCropRect &&
                lastCropRect.originalWidth === this.originalWidth &&
                lastCropRect.originalHeight === this.originalHeight
            ) {
                const last = lastCropRect;
                this.rotation = last.rotation || 0;
                const lastRotatedBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, this.rotation, this.fixedScale);
                this.cropRect = {
                    x: lastRotatedBounds.x + last.normalizedX * lastRotatedBounds.width,
                    y: lastRotatedBounds.y + last.normalizedY * lastRotatedBounds.height,
                    width: last.normalizedWidth * lastRotatedBounds.width,
                    height: last.normalizedHeight * lastRotatedBounds.height
                };
                this.lockAspectRatio = isBackground || (this.state.mainCropAspectRatio !== undefined);
                if (this.lockAspectRatio) {
                    this.aspectRatio = this.state.mainCropAspectRatio || (this.cropRect.width / this.cropRect.height);
                }
            } else if (currentSettings && currentSettings.width && currentSettings.height) {
                const cropWidth = currentSettings.width * this.fixedScale;
                const cropHeight = currentSettings.height * this.fixedScale;
                const cropX = currentSettings.x * this.fixedScale + rotatedBounds.x;
                const cropY = currentSettings.y * this.fixedScale + rotatedBounds.y;
    
                this.cropRect = {
                    x: this.clamp(cropX, rotatedBounds.x, rotatedBounds.x + rotatedBounds.width - cropWidth),
                    y: this.clamp(cropY, rotatedBounds.y, rotatedBounds.y + rotatedBounds.height - cropHeight),
                    width: this.clamp(cropWidth, 10, rotatedBounds.width),
                    height: this.clamp(cropHeight, 10, rotatedBounds.height)
                };
    
                this.lockAspectRatio = isBackground || (this.state.mainCropAspectRatio !== undefined);
                if (this.lockAspectRatio) {
                    this.aspectRatio = this.state.mainCropAspectRatio || (currentSettings.width / currentSettings.height);
                }
                this.rotation = currentSettings.rotation || 0;
            } else {
                this.rotation = 0;
                const bounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, 0, this.fixedScale);
    
                if (!isBackground) {
                    this.cropRect = { 
                        x: bounds.x, 
                        y: bounds.y, 
                        width: bounds.width, 
                        height: bounds.height 
                    };
                    this.lockAspectRatio = false;
                } else if (isBackground && this.state.image) {
                    this.lockAspectRatio = true;
                    this.aspectRatio = this.state.mainCropAspectRatio || (this.state.image.width / this.state.image.height);
    
                    let targetWidth = bounds.width;
                    let targetHeight = targetWidth / this.aspectRatio;
    
                    if (targetHeight > bounds.height) {
                        targetHeight = bounds.height;
                        targetWidth = targetHeight * this.aspectRatio;
                    }
    
                    this.cropRect = {
                        x: bounds.x + (bounds.width - targetWidth) / 2,
                        y: bounds.y + (bounds.height - targetHeight) / 2,
                        width: targetWidth,
                        height: targetHeight
                    };
                }
            }
    
            this.cropControls.setupCropControls();
            this.drawCropOverlay();
        };
    
        if (this.cropImage.complete && this.cropImage.naturalWidth !== 0) {
            initializeCrop();
        } else {
            this.cropImage.onload = initializeCrop;
        }
    }

    applyCrop() {
        const angleRad = this.rotation * Math.PI / 180;
        const cosA = Math.abs(Math.cos(angleRad));
        const sinA = Math.abs(Math.sin(angleRad));
        const fullRotatedWidth = Math.ceil(this.originalWidth * cosA + this.originalHeight * sinA);
        const fullRotatedHeight = Math.ceil(this.originalWidth * sinA + this.originalHeight * cosA);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = fullRotatedWidth;
        tempCanvas.height = fullRotatedHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.translate(fullRotatedWidth / 2, fullRotatedHeight / 2);
        tempCtx.rotate(angleRad);
        tempCtx.translate(-this.originalWidth / 2, -this.originalHeight / 2);
        tempCtx.drawImage(this.isBackgroundCrop ? this.state.originalBackgroundImage : this.state.originalImage, 0, 0, this.originalWidth, this.originalHeight);

        const scaleFactor = parseFloat(this.cropCanvas.dataset.scaleFactor) || 1;
        const rotatedBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, this.rotation, scaleFactor);
        const offsetX = (this.cropCanvas.width - rotatedBounds.width) / 2;
        const offsetY = (this.cropCanvas.height - rotatedBounds.height) / 2;

        const cropX = Math.round((this.cropRect.x - offsetX) / scaleFactor);
        const cropY = Math.round((this.cropRect.y - offsetY) / scaleFactor);
        const cropWidth = Math.round(this.cropRect.width / scaleFactor);
        const cropHeight = Math.round(this.cropRect.height / scaleFactor);
        const normalizedX = (this.cropRect.x - offsetX) / rotatedBounds.width;
        const normalizedY = (this.cropRect.y - offsetY) / rotatedBounds.height;
        const normalizedWidth = this.cropRect.width / rotatedBounds.width;
        const normalizedHeight = this.cropRect.height / rotatedBounds.height;

        const cropSettings = {
            normalizedX,
            normalizedY,
            normalizedWidth,
            normalizedHeight,
            rotation: this.rotation,
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight,
            scale: scaleFactor,
            timestamp: Date.now()
        };

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.imageSmoothingEnabled = true;
        croppedCtx.drawImage(
            tempCanvas,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );

        const croppedImage = new Image();
        croppedImage.onload = () => {
            if (this.isBackgroundCrop) {
                this.state.setBackgroundImage(croppedImage);
                this.state.backgroundCropSettings = {
                    x: 0,
                    y: 0,
                    width: cropWidth,
                    height: cropHeight,
                    rotation: this.rotation,
                    scale: 1
                };
                this.imageProcessor.setBackgroundImage(croppedImage);
                this.imageProcessor.render();
                this.cropImage.src = croppedImage.src;
                this.originalWidth = cropWidth;
                this.originalHeight = cropHeight;
                this.effectsProcessor.setImage(croppedImage);
                this.drawCropOverlay();
            } else {
                const preCropDisplayWidth = parseFloat(this.mainCanvas.style.width) || this.mainCanvas.width;
                const preCropDisplayHeight = parseFloat(this.mainCanvas.style.height) || this.mainCanvas.height;

                this.mainCanvas.width = cropWidth;
                this.mainCanvas.height = cropHeight;

                this.state.setImage(croppedImage);
                this.state.cropSettings = { x: 0, y: 0, width: cropWidth, height: cropHeight, rotation: 0, scale: 1 };
                this.state.lastMainCropRect = { ...cropSettings };
                this.state.updateMainCropAspectRatio(cropWidth, cropHeight);
                this.imageProcessor.setImage(croppedImage);

                if (this.state.originalBackgroundImage) {
                    const bgOriginalWidth = this.state.originalBackgroundImage.width;
                    const bgOriginalHeight = this.state.originalBackgroundImage.height;
                
                    const maxDimension = Math.max(bgOriginalWidth, bgOriginalHeight);
                    const maxRotatedSize = maxDimension * Math.sqrt(2);
                    const buffer = 10;
                    const bgScale = Math.min((this.maxCanvasWidth - buffer) / maxRotatedSize, (this.maxCanvasHeight - buffer) / maxRotatedSize, 1);
                    const fullWidth = Math.round(maxRotatedSize * bgScale);
                    const fullHeight = Math.round(maxRotatedSize * bgScale);
                
                    const tempCropCanvas = document.createElement('canvas');
                    tempCropCanvas.width = fullWidth;
                    tempCropCanvas.height = fullHeight;
                    tempCropCanvas.dataset.scaleFactor = bgScale;
                
                    const bounds = this.getRotatedImageBounds(bgOriginalWidth, bgOriginalHeight, 0, bgScale);
                    const aspectRatio = this.state.mainCropAspectRatio;
                
                    let targetWidth = bounds.width;
                    let targetHeight = targetWidth / aspectRatio;
                
                    if (targetHeight > bounds.height) {
                        targetHeight = bounds.height;
                        targetWidth = targetHeight * aspectRatio;
                    }
                
                    const bgCropRect = {
                        x: bounds.x + (bounds.width - targetWidth) / 2,
                        y: bounds.y + (bounds.height - targetHeight) / 2,
                        width: targetWidth,
                        height: targetHeight
                    };
                    const existingBgRotation = this.state.backgroundCropSettings?.rotation || 0; // Simplified, as it’s now preserved
                    const bgAngleRad = existingBgRotation * Math.PI / 180; // Convert to radians
    const cosA = Math.abs(Math.cos(bgAngleRad));
    const sinA = Math.abs(Math.sin(bgAngleRad));
    const bgFullRotatedWidth = Math.ceil(bgOriginalWidth * cosA + bgOriginalHeight * sinA);
    const bgFullRotatedHeight = Math.ceil(bgOriginalWidth * sinA + bgOriginalHeight * cosA);

                    const bgTempCanvas = document.createElement('canvas');
                    bgTempCanvas.width = bgFullRotatedWidth;
                    bgTempCanvas.height = bgFullRotatedHeight;
                    const bgTempCtx = bgTempCanvas.getContext('2d');
                    bgTempCtx.imageSmoothingEnabled = true;
                    bgTempCtx.translate(bgFullRotatedWidth / 2, bgFullRotatedHeight / 2);
                 bgTempCtx.rotate(bgAngleRad);
                    bgTempCtx.translate(-bgOriginalWidth / 2, -bgOriginalHeight / 2);
                    bgTempCtx.drawImage(this.state.originalBackgroundImage, 0, 0, bgOriginalWidth, bgOriginalHeight);

                    const bgOffsetX = (tempCropCanvas.width - bounds.width) / 2;
                    const bgOffsetY = (tempCropCanvas.height - bounds.height) / 2;

                    const bgCropX = Math.round((bgCropRect.x - bgOffsetX) / bgScale);
                    const bgCropY = Math.round((bgCropRect.y - bgOffsetY) / bgScale);
                    const bgCropWidth = Math.round(bgCropRect.width / bgScale);
                    const bgCropHeight = Math.round(bgCropRect.height / bgScale);

                    const bgCroppedCanvas = document.createElement('canvas');
                    bgCroppedCanvas.width = bgCropWidth;
                    bgCroppedCanvas.height = bgCropHeight;
                    const bgCroppedCtx = bgCroppedCanvas.getContext('2d');
                    bgCroppedCtx.imageSmoothingEnabled = true;
                    bgCroppedCtx.drawImage(
                        bgTempCanvas,
                        bgCropX, bgCropY, bgCropWidth, bgCropHeight,
                        0, 0, bgCropWidth, bgCropHeight
                    );

                    const bgCroppedImage = new Image();
                    bgCroppedImage.onload = () => {
                        this.state.setBackgroundImage(bgCroppedImage);
                        this.state.backgroundCropSettings = {
                            x: 0,
                            y: 0,
                            width: bgCropWidth,
                            height: bgCropHeight,
                            rotation: existingBgRotation, // Preserve the rotation
                            scale: 1
                        };
                        this.state.lastBackgroundCropRect = { ...cropSettings };
                        this.imageProcessor.setBackgroundImage(bgCroppedImage);
                        this.imageProcessor.render();
                    };
                    bgCroppedImage.src = bgCroppedCanvas.toDataURL('image/png');
                }

                this.imageProcessor.render();

                this.mainCanvas.style.width = `${preCropDisplayWidth}px`;
                this.mainCanvas.style.height = `${preCropDisplayHeight}px`;
                this.resizeCanvasDisplay();

                this.cropImage.src = croppedImage.src;
                this.originalWidth = cropWidth;
                this.originalHeight = cropHeight;
                this.effectsProcessor.setImage(croppedImage);

                const newBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, 0, scaleFactor);
                this.cropRect = {
                    x: (this.cropCanvas.width - newBounds.width) / 2,
                    y: (this.cropCanvas.height - newBounds.height) / 2,
                    width: newBounds.width,
                    height: newBounds.height
                    
                };

                this.state.cropHistory.push(cropSettings);
                this.drawCropOverlay();
            }
        };
        croppedImage.src = croppedCanvas.toDataURL('image/png');
    }

    closeModal() {
        const scaleFactor = parseFloat(this.cropCanvas.dataset.scaleFactor) || 1;
        const rotatedBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, this.rotation, scaleFactor);
        const offsetX = (this.cropCanvas.width - rotatedBounds.width) / 2;
        const offsetY = (this.cropCanvas.height - rotatedBounds.height) / 2;

        const normalizedX = (this.cropRect.x - offsetX) / rotatedBounds.width;
        const normalizedY = (this.cropRect.y - offsetY) / rotatedBounds.height;
        const normalizedWidth = this.cropRect.width / rotatedBounds.width;
        const normalizedHeight = this.cropRect.height / rotatedBounds.height;

        const lastCropRect = {
            normalizedX,
            normalizedY,
            normalizedWidth,
            normalizedHeight,
            rotation: this.rotation,
            scale: scaleFactor,
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight,
            timestamp: Date.now()
        };

        if (this.isBackgroundCrop) {
            this.state.lastBackgroundCropRect = lastCropRect;
        } else {
            this.state.lastMainCropRect = lastCropRect;
        }

        this.cropModal.style.display = 'none';
        this.cropCanvas.style.cursor = 'default';
    }

    resetCropRect(rotation = 0) {
        const buffer = 10;
        const maxDimension = Math.max(this.originalWidth, this.originalHeight);
        const maxRotatedSize = maxDimension * Math.sqrt(2);
        this.fixedScale = Math.min((this.maxCanvasWidth - buffer) / maxRotatedSize, (this.maxCanvasHeight - buffer) / maxRotatedSize, 1);

        const fullWidth = Math.round(maxRotatedSize * this.fixedScale);
        const fullHeight = Math.round(maxRotatedSize * this.fixedScale);
        this.cropCanvas.width = fullWidth;
        this.cropCanvas.height = fullHeight;
        this.cropCanvas.dataset.scaleFactor = this.fixedScale;
        this.cropCanvas.style.width = `${fullWidth}px`;
        this.cropCanvas.style.height = `${fullHeight}px`;

        this.effectsCanvas.width = fullWidth;
        this.effectsCanvas.height = fullHeight;
        this.effectsProcessor.setImage(this.cropImage);

        const bounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, rotation, this.fixedScale);
        if (this.isBackgroundCrop && this.state.image) {
            this.lockAspectRatio = true;
            this.aspectRatio = this.state.mainCropAspectRatio || (this.state.image.width / this.state.image.height);

            let targetWidth = bounds.width;
            let targetHeight = targetWidth / this.aspectRatio;

            if (targetHeight > bounds.height) {
                targetHeight = bounds.height;
                targetWidth = targetHeight * this.aspectRatio;
            }

            this.cropRect = {
                x: bounds.x + (bounds.width - targetWidth) / 2,
                y: bounds.y + (bounds.height - targetHeight) / 2,
                width: targetWidth,
                height: targetHeight
            };
        } else {
            this.cropRect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
            this.lockAspectRatio = false;
        }

        this.rotation = rotation;
        this.gridType = 'cross';
        this.drawCropOverlay();
    }

    drawCropOverlay() {
        const scale = parseFloat(this.cropCanvas.dataset.scaleFactor) || 1;
        const angleRad = this.rotation * Math.PI / 180;
        const cosA = Math.abs(Math.cos(angleRad));
        const sinA = Math.abs(Math.sin(angleRad));
        const rotatedWidth = this.originalWidth * cosA + this.originalHeight * sinA;
        const rotatedHeight = this.originalWidth * sinA + this.originalHeight * cosA;
        const scaledRotatedWidth = rotatedWidth * scale;
        const scaledRotatedHeight = rotatedHeight * scale;

        const offsetX = (this.cropCanvas.width - scaledRotatedWidth) / 2;
        const offsetY = (this.cropCanvas.height - scaledRotatedHeight) / 2;

        if (this.lockAspectRatio) {
            if (this.cropRect.width / this.cropRect.height !== this.aspectRatio) {
                this.cropRect.height = this.cropRect.width / this.aspectRatio;
                if (this.cropRect.height > scaledRotatedHeight) {
                    this.cropRect.height = scaledRotatedHeight;
                    this.cropRect.width = this.cropRect.height * this.aspectRatio;
                }
            }
        }

        this.cropRect.x = this.clamp(this.cropRect.x, Math.max(0, offsetX), offsetX + scaledRotatedWidth - this.cropRect.width);
        this.cropRect.y = this.clamp(this.cropRect.y, Math.max(0, offsetY), offsetY + scaledRotatedHeight - this.cropRect.height);
        this.cropRect.width = this.clamp(this.cropRect.width, 10, scaledRotatedWidth - (this.cropRect.x - offsetX));
        this.cropRect.height = this.clamp(this.cropRect.height, 10, scaledRotatedHeight - (this.cropRect.y - offsetY));
        this.cropCtx.clearRect(0, 0, this.cropCanvas.width, this.cropCanvas.height);

        const imageToRender = this.isBackgroundCrop ? this.state.originalBackgroundImage : this.state.originalImage;
        if (imageToRender) {
            this.effectsProcessor.setImage(imageToRender);
            this.renderEffectsWithTransform(offsetX, offsetY, scaledRotatedWidth, scaledRotatedHeight, angleRad, scale);
            this.cropCtx.drawImage(this.effectsCanvas, 0, 0);
        }

        this.cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.cropCtx.fillRect(0, 0, this.cropCanvas.width, this.cropRect.y);
        this.cropCtx.fillRect(0, this.cropRect.y + this.cropRect.height, this.cropCanvas.width, this.cropCanvas.height - (this.cropRect.y + this.cropRect.height));
        this.cropCtx.fillRect(0, this.cropRect.y, this.cropRect.x, this.cropRect.height);
        this.cropCtx.fillRect(this.cropRect.x + this.cropRect.width, this.cropRect.y, this.cropCanvas.width - (this.cropRect.x + this.cropRect.width), this.cropRect.height);

        this.cropCtx.strokeStyle = '#fff';
        this.cropCtx.lineWidth = 2;
        this.cropCtx.setLineDash([5, 5]);
        this.cropCtx.strokeRect(this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height);
        this.cropCtx.setLineDash([]);

        if (this.lockAspectRatio && this.isBackgroundCrop) {
            this.cropCtx.fillStyle = '#fff';
            this.cropCtx.font = '12px Arial';
            this.cropCtx.fillText('Locked to Main', this.cropRect.x + 5, this.cropRect.y - 5);
        }

        GridDrawer.draw(this.cropCtx, this.cropRect, this.gridType);
        this.previousRotation = this.rotation;
    }

    renderEffectsWithTransform(offsetX, offsetY, width, height, angleRad, scale) {
        const image = this.isBackgroundCrop ? this.state.originalBackgroundImage : this.state.originalImage;
        if (!this.effectsProcessor.texture || !image) return;

        const canvasWidth = this.effectsCanvas.width;
        const canvasHeight = this.effectsCanvas.height;

        const aspectRatio = image.width / image.height;
        const unscaledWidth = (image.width * scale) / canvasWidth * 2;
        const unscaledHeight = unscaledWidth / aspectRatio;

        let vertices = new Float32Array([
            -unscaledWidth / 2,  unscaledHeight / 2,
             unscaledWidth / 2,  unscaledHeight / 2,
            -unscaledWidth / 2, -unscaledHeight / 2,
             unscaledWidth / 2, -unscaledHeight / 2
        ]);

        const cosA = Math.cos(-angleRad);
        const sinA = Math.sin(-angleRad);
        const rotatedVertices = new Float32Array(8);
        for (let i = 0; i < 4; i++) {
            const x = vertices[i * 2];
            const y = vertices[i * 2 + 1];
            rotatedVertices[i * 2] = x * cosA - y * sinA;
            rotatedVertices[i * 2 + 1] = x * sinA + y * cosA;
        }

        const normalizedOffsetX = (offsetX / canvasWidth) * 2 - 1;
        const normalizedOffsetY = 1 - (offsetY / canvasHeight) * 2;
        const translateX = normalizedOffsetX + (width / canvasWidth) * 2 / 2;
        const translateY = normalizedOffsetY - (height / canvasHeight) * 2 / 2;

        const positions = new Float32Array(8);
        for (let i = 0; i < 4; i++) {
            positions[i * 2] = rotatedVertices[i * 2] + translateX;
            positions[i * 2 + 1] = rotatedVertices[i * 2 + 1] + translateY;
        }

        const texCoords = new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ]);

        const gl = this.effectsProcessor.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(this.effectsProcessor.program);

        if (!this.effectsProcessor.positionBuffer) {
            this.effectsProcessor.positionBuffer = gl.createBuffer();
        }
        if (!this.effectsProcessor.texCoordBuffer) {
            this.effectsProcessor.texCoordBuffer = gl.createBuffer();
        }

        const positionLoc = gl.getAttribLocation(this.effectsProcessor.program, 'a_position');
        gl.enableVertexAttribArray(positionLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.effectsProcessor.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        const texCoordLoc = gl.getAttribLocation(this.effectsProcessor.program, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.effectsProcessor.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.effectsProcessor.texture);
        gl.uniform1i(gl.getUniformLocation(this.effectsProcessor.program, 'u_image'), 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    getRotatedImageBounds(width, height, rotationDeg, scale) {
        const rad = rotationDeg * Math.PI / 180;
        const cosA = Math.abs(Math.cos(rad));
        const sinA = Math.abs(Math.sin(rad));
        const rotatedWidth = (width * cosA + height * sinA) * scale;
        const rotatedHeight = (width * sinA + height * cosA) * scale;
        const x = (this.cropCanvas.width - rotatedWidth) / 2;
        const y = (this.cropCanvas.height - rotatedHeight) / 2;
        return { x, y, width: rotatedWidth, height: rotatedHeight };
    }
}