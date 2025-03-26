// cropRotate.js
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
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
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

        this.setupEventListeners();
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    showCropModal() {
        this.cropModal.style.display = 'flex';
        this.cropImage.src = this.state.originalImage.src;
        this.originalWidth = this.state.originalImage.width;
        this.originalHeight = this.state.originalImage.height;

        this.cropImage.onload = () => {
            this.maxCanvasWidth = window.innerWidth * 0.9;
            this.maxCanvasHeight = 700;
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

            const boundsWithRotation = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, this.rotation, this.fixedScale);
            const offsetX = (fullWidth - boundsWithRotation.width) / 2;
            const offsetY = (fullHeight - boundsWithRotation.height) / 2;

            if (this.state.cropHistory.length > 0) {
                const lastCrop = this.state.cropHistory[this.state.cropHistory.length - 1];
                const scaleRatio = this.fixedScale / lastCrop.scale;
                const rotatedBounds = this.getRotatedImageBounds(lastCrop.originalWidth, lastCrop.originalHeight, lastCrop.rotation, this.fixedScale);
                this.cropRect = {
                    x: offsetX + (lastCrop.normalizedX * rotatedBounds.width),
                    y: offsetY + (lastCrop.normalizedY * rotatedBounds.height),
                    width: lastCrop.normalizedWidth * rotatedBounds.width,
                    height: lastCrop.normalizedHeight * rotatedBounds.height
                };
                this.rotation = lastCrop.rotation;
            } else if (this.state.lastCropRect) {
                const scaleRatio = this.fixedScale / this.state.lastCropRect.scale;
                const rotatedBounds = this.getRotatedImageBounds(this.state.lastCropRect.originalWidth, this.state.lastCropRect.originalHeight, this.state.lastCropRect.rotation, this.fixedScale);
                this.cropRect = {
                    x: offsetX + (this.state.lastCropRect.normalizedX * rotatedBounds.width),
                    y: offsetY + (this.state.lastCropRect.normalizedY * rotatedBounds.height),
                    width: this.state.lastCropRect.normalizedWidth * rotatedBounds.width,
                    height: this.state.lastCropRect.normalizedHeight * rotatedBounds.height
                };
                this.rotation = this.state.lastCropRect.rotation;
            } else {
                this.cropRect = {
                    x: offsetX,
                    y: offsetY,
                    width: boundsWithRotation.width,
                    height: boundsWithRotation.height
                };
                this.rotation = 0;
            }

            this.cropRect.x = this.clamp(this.cropRect.x, boundsWithRotation.x, boundsWithRotation.x + boundsWithRotation.width - this.cropRect.width);
            this.cropRect.y = this.clamp(this.cropRect.y, boundsWithRotation.y, boundsWithRotation.y + boundsWithRotation.height - this.cropRect.height);
            this.cropRect.width = this.clamp(this.cropRect.width, 10, boundsWithRotation.width);
            this.cropRect.height = this.clamp(this.cropRect.height, 10, boundsWithRotation.height);

            this.lockAspectRatio = false;
            this.previousRotation = this.rotation;
            this.gridType = 'cross';
            this.setupCropControls();
            this.drawCropOverlay();
        };

        if (this.cropImage.complete && this.cropImage.naturalWidth !== 0) {
            this.cropImage.onload();
        }
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

        this.state.lastCropRect = {
            normalizedX: normalizedX,
            normalizedY: normalizedY,
            normalizedWidth: normalizedWidth,
            normalizedHeight: normalizedHeight,
            rotation: this.rotation,
            scale: scaleFactor,
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight
        };

        this.cropModal.style.display = 'none';
        this.isDragging = false;
        this.cropCanvas.style.cursor = 'default';
    }

    setupCropControls() {
        const cropControls = document.getElementById('crop-controls');
        cropControls.innerHTML = `
            <div class="crop-control-group">
                <label for="cropRotation">Rotation:</label>
                <input type="range" id="cropRotation" min="-180" max="180" value="${this.rotation}">
                <span id="rotation-value" style="cursor: pointer;">${this.rotation}°</span>
            </div>
            <div class="crop-control-group aspect-lock-group">
                <div class="aspect-ratio-wrapper">
                    <label for="aspect-ratio">Aspect Ratio:</label>
                    <select id="aspect-ratio">
                        <option value="free">Free</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="4:3">4:3</option>
                        <option value="3:2">3:2</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="5:4">5:4</option>
                        <option value="4:5">4:5</option>
                    </select>
                </div>
                <div class="crop-lock-group">
                    <input type="checkbox" id="lock-aspect" ${this.lockAspectRatio ? 'checked' : ''}>
                    <label for="lock-aspect">Lock Aspect Ratio</label>
                </div>
            </div>
            <div class="crop-control-group">
                <label for="grid-type">Grid Overlay:</label>
                <select id="grid-type">
                    <option value="none">None</option>
                    <option value="cross" selected>Cross</option>
                    <option value="rule-of-thirds">Rule of Thirds</option>
                    <option value="golden-ratio">Golden Ratio</option>
                    <option value="grid-3x3">3x3 Grid</option>
                    <option value="grid-4x4">4x4 Grid</option>
                </select>
            </div>
            <div class="crop-button-group">
                <button id="crop-restore">Reset</button>
                <button id="crop-confirm">Apply</button>
                <button id="crop-skip">Cancel</button>
            </div>
        `;

        const rotationInput = document.getElementById('cropRotation');
        const rotationValue = document.getElementById('rotation-value');
        const aspectRatioSelect = document.getElementById('aspect-ratio');
        const gridTypeSelect = document.getElementById('grid-type');
        const restoreBtn = document.getElementById('crop-restore');
        const confirmBtn = document.getElementById('crop-confirm');
        const skipBtn = document.getElementById('crop-skip');
        const lockCheckbox = document.getElementById('lock-aspect');

        rotationInput.addEventListener('input', (e) => {
            this.rotation = parseInt(e.target.value);
            rotationValue.textContent = `${this.rotation}°`;
            this.drawCropOverlay();
        });

        rotationValue.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'number';
            input.min = -180;
            input.max = 180;
            input.value = this.rotation;
            input.style.width = '60px';
            input.style.fontSize = '13px';
            input.style.padding = '2px';

            rotationValue.replaceWith(input);
            input.focus();

            input.addEventListener('change', (e) => {
                const newValue = this.clamp(parseInt(e.target.value) || 0, -180, 180);
                this.rotation = newValue;
                rotationInput.value = newValue;
                this.drawCropOverlay();
                input.replaceWith(rotationValue);
                rotationValue.textContent = `${this.rotation}°`;
            });

            input.addEventListener('blur', () => {
                const newValue = this.clamp(parseInt(input.value) || 0, -180, 180);
                this.rotation = newValue;
                rotationInput.value = newValue;
                this.drawCropOverlay();
                input.replaceWith(rotationValue);
                rotationValue.textContent = `${this.rotation}°`;
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });
        });

        aspectRatioSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            this.applyAspectRatio(value);
            this.drawCropOverlay();
        });

        gridTypeSelect.addEventListener('change', (e) => {
            this.gridType = e.target.value;
            this.drawCropOverlay();
        });

        restoreBtn.addEventListener('click', () => {
            this.rotation = 0;
            rotationInput.value = 0;
            rotationValue.textContent = '0°';
            this.lockAspectRatio = false;
            lockCheckbox.checked = false;
            aspectRatioSelect.value = 'free';
            this.gridType = 'cross';
            gridTypeSelect.value = 'cross';

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

            const initialBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, 0, this.fixedScale);
            this.cropRect = {
                x: initialBounds.x,
                y: initialBounds.y,
                width: initialBounds.width,
                height: initialBounds.height
            };
            this.drawCropOverlay();
        });

        confirmBtn.addEventListener('click', () => {
            this.closeModal();
            this.applyCrop();
            this.state.commitAdjustment();
        });

        skipBtn.addEventListener('click', () => this.closeModal());

        lockCheckbox.addEventListener('change', (e) => {
            this.lockAspectRatio = e.target.checked;
            lockCheckbox.checked = this.lockAspectRatio; // Ensure checkbox reflects the state
            if (this.lockAspectRatio && aspectRatioSelect.value === 'free') {
                this.aspectRatio = this.cropRect.width / this.cropRect.height;
            }
            this.drawCropOverlay(); // Redraw to apply the lock if needed
        });

        const closeBtn = this.cropModal.querySelector('.modal-close-btn');
        closeBtn.addEventListener('click', () => this.closeModal());
    }

    applyAspectRatio(ratioStr) {
        const rotatedBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, this.rotation, this.fixedScale);
        let newWidth, newHeight;

        const lockCheckbox = document.getElementById('lock-aspect');

        if (ratioStr === 'free') {
            this.lockAspectRatio = false;
            lockCheckbox.checked = false;
            return;
        }

        this.lockAspectRatio = true;
        lockCheckbox.checked = true;

        const [widthRatio, heightRatio] = ratioStr.split(':').map(Number);
        this.aspectRatio = widthRatio / heightRatio;

        const currentCenterX = this.cropRect.x + this.cropRect.width / 2;
        const currentCenterY = this.cropRect.y + this.cropRect.height / 2;

        if (this.cropRect.width / this.cropRect.height > this.aspectRatio) {
            newWidth = this.cropRect.height * this.aspectRatio;
            newHeight = this.cropRect.height;
        } else {
            newWidth = this.cropRect.width;
            newHeight = this.cropRect.width / this.aspectRatio;
        }

        newWidth = this.clamp(newWidth, 10, rotatedBounds.width);
        newHeight = this.clamp(newHeight, 10, rotatedBounds.height);

        this.cropRect.width = newWidth;
        this.cropRect.height = newHeight;

        this.cropRect.x = currentCenterX - newWidth / 2;
        this.cropRect.y = currentCenterY - newHeight / 2;

        this.cropRect.x = this.clamp(this.cropRect.x, rotatedBounds.x, rotatedBounds.x + rotatedBounds.width - newWidth);
        this.cropRect.y = this.clamp(this.cropRect.y, rotatedBounds.y, rotatedBounds.y + rotatedBounds.height - newHeight);
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
        tempCtx.drawImage(this.state.originalImage, 0, 0, this.originalWidth, this.originalHeight);

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
            normalizedX: normalizedX,
            normalizedY: normalizedY,
            normalizedWidth: normalizedWidth,
            normalizedHeight: normalizedHeight,
            rotation: this.rotation,
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight,
            scale: scaleFactor
        };
        this.state.cropHistory.push(cropSettings);
        this.state.lastCropRect = { ...cropSettings };

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
            this.mainCanvas.removeAttribute('width');
            this.mainCanvas.removeAttribute('height');
            this.mainCanvas.removeAttribute('style');

            this.mainCanvas.width = croppedImage.width;
            this.mainCanvas.height = croppedImage.height;

            this.state.setImage(croppedImage);
            this.state.cropSettings = {
                x: 0,
                y: 0,
                width: cropWidth,
                height: cropHeight,
                rotation: 0,
                scale: 1
            };
            this.imageProcessor.setImage(croppedImage);
            this.imageProcessor.render();

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

            this.resizeCanvasDisplay();
        };
        croppedImage.src = croppedCanvas.toDataURL('image/png');
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

        this.cropRect.x = this.clamp(this.cropRect.x, offsetX, offsetX + scaledRotatedWidth - this.cropRect.width);
        this.cropRect.y = this.clamp(this.cropRect.y, offsetY, offsetY + scaledRotatedHeight - this.cropRect.height);
        this.cropRect.width = this.clamp(this.cropRect.width, 10, scaledRotatedWidth - (this.cropRect.x - offsetX));
        this.cropRect.height = this.clamp(this.cropRect.height, 10, scaledRotatedHeight - (this.cropRect.y - offsetY));

        this.cropCtx.clearRect(0, 0, this.cropCanvas.width, this.cropCanvas.height);

        this.renderEffectsWithTransform(offsetX, offsetY, scaledRotatedWidth, scaledRotatedHeight, angleRad, scale);
        this.cropCtx.drawImage(this.effectsCanvas, 0, 0);

        // Draw overlay
        this.cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.cropCtx.fillRect(0, 0, this.cropCanvas.width, this.cropRect.y);
        this.cropCtx.fillRect(0, this.cropRect.y + this.cropRect.height, this.cropCanvas.width, this.cropCanvas.height - (this.cropRect.y + this.cropRect.height));
        this.cropCtx.fillRect(0, this.cropRect.y, this.cropRect.x, this.cropRect.height);
        this.cropCtx.fillRect(this.cropRect.x + this.cropRect.width, this.cropRect.y, this.cropCanvas.width - (this.cropRect.x + this.cropRect.width), this.cropRect.height);

        // Draw crop rectangle
        this.cropCtx.strokeStyle = '#fff';
        this.cropCtx.lineWidth = 2;
        this.cropCtx.setLineDash([5, 5]);
        this.cropCtx.strokeRect(this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height);
        this.cropCtx.setLineDash([]);

        // Draw grid
        this.drawGrid();

        this.previousRotation = this.rotation;
    }

    drawGrid() {
        this.cropCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        this.cropCtx.lineWidth = 1;

        switch (this.gridType) {
            case 'none':
                break;
            case 'cross':
                this.cropCtx.beginPath();
                this.cropCtx.moveTo(this.cropRect.x + this.cropRect.width / 2, this.cropRect.y);
                this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width / 2, this.cropRect.y + this.cropRect.height);
                this.cropCtx.moveTo(this.cropRect.x, this.cropRect.y + this.cropRect.height / 2);
                this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width, this.cropRect.y + this.cropRect.height / 2);
                this.cropCtx.stroke();
                break;
            case 'rule-of-thirds':
                this.cropCtx.beginPath();
                this.cropCtx.moveTo(this.cropRect.x + this.cropRect.width / 3, this.cropRect.y);
                this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width / 3, this.cropRect.y + this.cropRect.height);
                this.cropCtx.moveTo(this.cropRect.x + 2 * this.cropRect.width / 3, this.cropRect.y);
                this.cropCtx.lineTo(this.cropRect.x + 2 * this.cropRect.width / 3, this.cropRect.y + this.cropRect.height);
                this.cropCtx.moveTo(this.cropRect.x, this.cropRect.y + this.cropRect.height / 3);
                this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width, this.cropRect.y + this.cropRect.height / 3);
                this.cropCtx.moveTo(this.cropRect.x, this.cropRect.y + 2 * this.cropRect.height / 3);
                this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width, this.cropRect.y + 2 * this.cropRect.height / 3);
                this.cropCtx.stroke();
                break;
            case 'golden-ratio':
                const phi = (1 + Math.sqrt(5)) / 2;
                const goldenWidth1 = this.cropRect.width / (phi + 1);
                const goldenWidth2 = this.cropRect.width - goldenWidth1;
                const goldenHeight1 = this.cropRect.height / (phi + 1);
                const goldenHeight2 = this.cropRect.height - goldenHeight1;

                this.cropCtx.beginPath();
                this.cropCtx.moveTo(this.cropRect.x + goldenWidth1, this.cropRect.y);
                this.cropCtx.lineTo(this.cropRect.x + goldenWidth1, this.cropRect.y + this.cropRect.height);
                this.cropCtx.moveTo(this.cropRect.x + goldenWidth2, this.cropRect.y);
                this.cropCtx.lineTo(this.cropRect.x + goldenWidth2, this.cropRect.y + this.cropRect.height);
                this.cropCtx.moveTo(this.cropRect.x, this.cropRect.y + goldenHeight1);
                this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width, this.cropRect.y + goldenHeight1);
                this.cropCtx.moveTo(this.cropRect.x, this.cropRect.y + goldenHeight2);
                this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width, this.cropRect.y + goldenHeight2);
                this.cropCtx.stroke();
                break;
            case 'grid-3x3':
                this.cropCtx.beginPath();
                for (let i = 1; i < 3; i++) {
                    this.cropCtx.moveTo(this.cropRect.x + (i * this.cropRect.width) / 3, this.cropRect.y);
                    this.cropCtx.lineTo(this.cropRect.x + (i * this.cropRect.width) / 3, this.cropRect.y + this.cropRect.height);
                    this.cropCtx.moveTo(this.cropRect.x, this.cropRect.y + (i * this.cropRect.height) / 3);
                    this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width, this.cropRect.y + (i * this.cropRect.height) / 3);
                }
                this.cropCtx.stroke();
                break;
            case 'grid-4x4':
                this.cropCtx.beginPath();
                for (let i = 1; i < 4; i++) {
                    this.cropCtx.moveTo(this.cropRect.x + (i * this.cropRect.width) / 4, this.cropRect.y);
                    this.cropCtx.lineTo(this.cropRect.x + (i * this.cropRect.width) / 4, this.cropRect.y + this.cropRect.height);
                    this.cropCtx.moveTo(this.cropRect.x, this.cropRect.y + (i * this.cropRect.height) / 4);
                    this.cropCtx.lineTo(this.cropRect.x + this.cropRect.width, this.cropRect.y + (i * this.cropRect.height) / 4);
                }
                this.cropCtx.stroke();
                break;
        }
    }

    renderEffectsWithTransform(offsetX, offsetY, width, height, angleRad, scale) {
        if (!this.effectsProcessor.texture || !this.state.image) return;

        const canvasWidth = this.effectsCanvas.width;
        const canvasHeight = this.effectsCanvas.height;

        const unscaledWidth = (this.originalWidth * scale) / canvasWidth * 2;
        const unscaledHeight = (this.originalHeight * scale) / canvasHeight * 2;

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

        // Set all uniforms, including glitch effects
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_brightness'), this.state.adjustments.brightness);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_contrast'), this.state.adjustments.contrast);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_saturation'), this.state.adjustments.saturation);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_hue'), this.state.adjustments.hue);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_exposure'), this.state.adjustments.exposure);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_highlights'), this.state.adjustments.highlights);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_shadows'), this.state.adjustments.shadows);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_blacks'), this.state.adjustments.blacks);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_whites'), this.state.adjustments.whites);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_temperature'), this.state.adjustments.temperature);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_tint'), this.state.adjustments.tint);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_sharpness'), this.state.adjustments.sharpness);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_vignette'), this.state.adjustments.vignette);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_noise'), this.state.adjustments.noise);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_clarity'), this.state.adjustments.clarity);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_opacity'), this.state.adjustments.opacity);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_gamma'), this.state.adjustments.gamma);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_sepia'), this.state.adjustments.sepia);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_vibrance'), this.state.adjustments.vibrance);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_grayscale'), this.state.adjustments.grayscale);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_invert'), this.state.adjustments.invert);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_rgbSplit'), this.state.adjustments.rgbSplit);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_filmGrain'), this.state.adjustments.filmGrain);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_waveDistortion'), this.state.adjustments.waveDistortion);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_blockGlitch'), this.state.adjustments.blockGlitch);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_ghosting'), this.state.adjustments.ghosting);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_fractalDistortion'), this.state.adjustments.fractalDistortion);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_colorShift'), this.state.adjustments.colorShift);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_pixelNoise'), this.state.adjustments.pixelNoise);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_scratchTexture'), this.state.adjustments.scratchTexture);
        gl.uniform1f(gl.getUniformLocation(this.effectsProcessor.program, 'u_organicDistortion'), this.state.adjustments.organicDistortion);
        gl.uniform1i(gl.getUniformLocation(this.effectsProcessor.program, 'u_showOriginal'), this.state.showOriginal ? 1 : 0);

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

    nearCorner(x, y, cornerX, cornerY, margin) {
        return Math.abs(x - cornerX) < margin && Math.abs(y - cornerY) < margin;
    }

    nearSide(x, y, rectX, rectY, width, height, side, margin) {
        switch (side) {
            case 'left':
                return Math.abs(x - rectX) < margin && y > rectY && y < rectY + height;
            case 'right':
                return Math.abs(x - (rectX + width)) < margin && y > rectY && y < rectY + height;
            case 'top':
                return Math.abs(y - rectY) < margin && x > rectX && x < rectX + width;
            case 'bottom':
                return Math.abs(y - (rectY + height)) < margin && x > rectX && x < rectX + width;
            default:
                return false;
        }
    }

    insideCrop(x, y) {
        return x >= this.cropRect.x && x <= this.cropRect.x + this.cropRect.width &&
               y >= this.cropRect.y && y <= this.cropRect.y + this.cropRect.height;
    }

    setupEventListeners() {
        this.cropCanvas.addEventListener('mousedown', this.startCropDrag.bind(this));
        this.cropCanvas.addEventListener('mousemove', this.adjustCropDrag.bind(this));
        this.cropCanvas.addEventListener('mouseup', this.stopCropDrag.bind(this));
        document.addEventListener('mousemove', this.handleDragOutside.bind(this));
        document.addEventListener('mouseup', this.stopCropDrag.bind(this));
        this.cropCanvas.addEventListener('touchstart', this.startCropDrag.bind(this), { passive: false });
        this.cropCanvas.addEventListener('touchmove', this.adjustCropDrag.bind(this), { passive: false });
        this.cropCanvas.addEventListener('touchend', this.stopCropDrag.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleDragOutside.bind(this), { passive: false });
        document.addEventListener('touchend', this.stopCropDrag.bind(this), { passive: false });

        this.cropCanvas.addEventListener('mousemove', (e) => {
            const rect = this.cropCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const resizeMargin = 20;

            if (this.nearCorner(x, y, this.cropRect.x, this.cropRect.y, resizeMargin)) {
                this.cropCanvas.style.cursor = 'nwse-resize';
            } else if (this.nearCorner(x, y, this.cropRect.x + this.cropRect.width, this.cropRect.y, resizeMargin)) {
                this.cropCanvas.style.cursor = 'nesw-resize';
            } else if (this.nearCorner(x, y, this.cropRect.x, this.cropRect.y + this.cropRect.height, resizeMargin)) {
                this.cropCanvas.style.cursor = 'nesw-resize';
            } else if (this.nearCorner(x, y, this.cropRect.x + this.cropRect.width, this.cropRect.y + this.cropRect.height, resizeMargin)) {
                this.cropCanvas.style.cursor = 'nwse-resize';
            } else if (this.nearSide(x, y, this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height, 'left', resizeMargin)) {
                this.cropCanvas.style.cursor = 'ew-resize';
            } else if (this.nearSide(x, y, this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height, 'right', resizeMargin)) {
                this.cropCanvas.style.cursor = 'ew-resize';
            } else if (this.nearSide(x, y, this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height, 'top', resizeMargin)) {
                this.cropCanvas.style.cursor = 'ns-resize';
            } else if (this.nearSide(x, y, this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height, 'bottom', resizeMargin)) {
                this.cropCanvas.style.cursor = 'ns-resize';
            } else if (this.insideCrop(x, y)) {
                this.cropCanvas.style.cursor = 'move';
            } else {
                this.cropCanvas.style.cursor = 'default';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.cropModal.style.display === 'flex') {
                this.closeModal();
            }
        });
    }

    startCropDrag(e) {
        e.preventDefault();
        const rect = this.cropCanvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        const resizeMargin = 20;

        if (this.nearCorner(x, y, this.cropRect.x, this.cropRect.y, resizeMargin)) {
            this.isDragging = 'top-left';
        } else if (this.nearCorner(x, y, this.cropRect.x + this.cropRect.width, this.cropRect.y, resizeMargin)) {
            this.isDragging = 'top-right';
        } else if (this.nearCorner(x, y, this.cropRect.x, this.cropRect.y + this.cropRect.height, resizeMargin)) {
            this.isDragging = 'bottom-left';
        } else if (this.nearCorner(x, y, this.cropRect.x + this.cropRect.width, this.cropRect.y + this.cropRect.height, resizeMargin)) {
            this.isDragging = 'bottom-right';
        } else if (this.nearSide(x, y, this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height, 'left', resizeMargin)) {
            this.isDragging = 'left';
        } else if (this.nearSide(x, y, this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height, 'right', resizeMargin)) {
            this.isDragging = 'right';
        } else if (this.nearSide(x, y, this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height, 'top', resizeMargin)) {
            this.isDragging = 'top';
        } else if (this.nearSide(x, y, this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height, 'bottom', resizeMargin)) {
            this.isDragging = 'bottom';
        } else if (this.insideCrop(x, y)) {
            this.isDragging = 'move';
            this.startX = x - this.cropRect.x;
            this.startY = y - this.cropRect.y;
        }
        if (this.isDragging) this.drawCropOverlay();
    }

    adjustCropDrag(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        const rect = this.cropCanvas.getBoundingClientRect();
        let x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        let y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        x = this.clamp(x, 0, this.cropCanvas.width);
        y = this.clamp(y, 0, this.cropCanvas.height);

        const rotatedBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, this.rotation, parseFloat(this.cropCanvas.dataset.scaleFactor));

        if (this.isDragging === 'move') {
            this.cropRect.x = this.clamp(x - this.startX, rotatedBounds.x, rotatedBounds.x + rotatedBounds.width - this.cropRect.width);
            this.cropRect.y = this.clamp(y - this.startY, rotatedBounds.y, rotatedBounds.y + rotatedBounds.height - this.cropRect.height);
        } else {
            this.resizeCrop(x, y, rotatedBounds);
        }
        this.drawCropOverlay();
    }

    handleDragOutside(e) {
        if (!this.isDragging) return;
        const rect = this.cropCanvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        if (x < 0 || x > this.cropCanvas.width || y < 0 || y > this.cropCanvas.height) {
            this.adjustCropDrag(e);
        } else {
            this.adjustCropDrag(e);
        }
    }

    stopCropDrag(e) {
        if (this.isDragging) {
            e.preventDefault();
            this.isDragging = false;
            this.cropCanvas.style.cursor = 'default';
            const rotatedBounds = this.getRotatedImageBounds(this.originalWidth, this.originalHeight, this.rotation, parseFloat(this.cropCanvas.dataset.scaleFactor));
            this.cropRect.x = this.clamp(this.cropRect.x, rotatedBounds.x, rotatedBounds.x + rotatedBounds.width - this.cropRect.width);
            this.cropRect.y = this.clamp(this.cropRect.y, rotatedBounds.y, rotatedBounds.y + rotatedBounds.height - this.cropRect.height);
            this.cropRect.width = this.clamp(this.cropRect.width, 10, rotatedBounds.width);
            this.cropRect.height = this.clamp(this.cropRect.height, 10, rotatedBounds.height);
            this.drawCropOverlay();
        }
    }

    resizeCrop(x, y, bounds) {
        let newWidth, newHeight;

        if (this.isDragging === 'top-left') {
            newWidth = this.clamp(this.cropRect.x + this.cropRect.width - x, 10, this.cropRect.x + this.cropRect.width - bounds.x);
            if (this.lockAspectRatio) {
                newHeight = newWidth / this.aspectRatio;
                if (newHeight > this.cropRect.y + this.cropRect.height - bounds.y) {
                    newHeight = this.cropRect.y + this.cropRect.height - bounds.y;
                    newWidth = newHeight * this.aspectRatio;
                }
            } else {
                newHeight = this.clamp(this.cropRect.y + this.cropRect.height - y, 10, this.cropRect.y + this.cropRect.height - bounds.y);
            }
            this.cropRect.x = this.clamp(x, bounds.x, this.cropRect.x + this.cropRect.width - 10);
            this.cropRect.y = this.lockAspectRatio ? this.cropRect.y + this.cropRect.height - newHeight : this.clamp(y, bounds.y, this.cropRect.y + this.cropRect.height - 10);
            this.cropRect.width = newWidth;
            this.cropRect.height = newHeight;
        } else if (this.isDragging === 'top-right') {
            newWidth = this.clamp(x - this.cropRect.x, 10, bounds.x + bounds.width - this.cropRect.x);
            if (this.lockAspectRatio) {
                newHeight = newWidth / this.aspectRatio;
                if (newHeight > this.cropRect.y + this.cropRect.height - bounds.y) {
                    newHeight = this.cropRect.y + this.cropRect.height - bounds.y;
                    newWidth = newHeight * this.aspectRatio;
                }
            } else {
                newHeight = this.clamp(this.cropRect.y + this.cropRect.height - y, 10, this.cropRect.y + this.cropRect.height - bounds.y);
            }
            this.cropRect.y = this.lockAspectRatio ? this.cropRect.y + this.cropRect.height - newHeight : this.clamp(y, bounds.y, this.cropRect.y + this.cropRect.height - 10);
            this.cropRect.width = newWidth;
            this.cropRect.height = newHeight;
        } else if (this.isDragging === 'bottom-left') {
            newWidth = this.clamp(this.cropRect.x + this.cropRect.width - x, 10, this.cropRect.x + this.cropRect.width - bounds.x);
            if (this.lockAspectRatio) {
                newHeight = newWidth / this.aspectRatio;
                if (newHeight > bounds.y + bounds.height - this.cropRect.y) {
                    newHeight = bounds.y + bounds.height - this.cropRect.y;
                    newWidth = newHeight * this.aspectRatio;
                }
            } else {
                newHeight = this.clamp(y - this.cropRect.y, 10, bounds.y + bounds.height - this.cropRect.y);
            }
            this.cropRect.x = this.clamp(x, bounds.x, this.cropRect.x + this.cropRect.width - 10);
            this.cropRect.width = newWidth;
            this.cropRect.height = newHeight;
        } else if (this.isDragging === 'bottom-right') {
            newWidth = this.clamp(x - this.cropRect.x, 10, bounds.x + bounds.width - this.cropRect.x);
            if (this.lockAspectRatio) {
                newHeight = newWidth / this.aspectRatio;
                if (newHeight > bounds.y + bounds.height - this.cropRect.y) {
                    newHeight = bounds.y + bounds.height - this.cropRect.y;
                    newWidth = newHeight * this.aspectRatio;
                }
            } else {
                newHeight = this.clamp(y - this.cropRect.y, 10, bounds.y + bounds.height - this.cropRect.y);
            }
            this.cropRect.width = newWidth;
            this.cropRect.height = newHeight;
        } else if (this.isDragging === 'left') {
            newWidth = this.clamp(this.cropRect.x + this.cropRect.width - x, 10, this.cropRect.x + this.cropRect.width - bounds.x);
            if (this.lockAspectRatio) {
                newHeight = newWidth / this.aspectRatio;
                if (newHeight > bounds.y + bounds.height - this.cropRect.y) {
                    newHeight = bounds.y + bounds.height - this.cropRect.y;
                    newWidth = newHeight * this.aspectRatio;
                }
                this.cropRect.height = newHeight;
            } else {
                newHeight = this.cropRect.height;
            }
            this.cropRect.x = this.clamp(x, bounds.x, this.cropRect.x + this.cropRect.width - 10);
            this.cropRect.width = newWidth;
        } else if (this.isDragging === 'right') {
            newWidth = this.clamp(x - this.cropRect.x, 10, bounds.x + bounds.width - this.cropRect.x);
            if (this.lockAspectRatio) {
                newHeight = newWidth / this.aspectRatio;
                if (newHeight > bounds.y + bounds.height - this.cropRect.y) {
                    newHeight = bounds.y + bounds.height - this.cropRect.y;
                    newWidth = newHeight * this.aspectRatio;
                }
                this.cropRect.height = newHeight;
            } else {
                newHeight = this.cropRect.height;
            }
            this.cropRect.width = newWidth;
        } else if (this.isDragging === 'top') {
            newHeight = this.clamp(this.cropRect.y + this.cropRect.height - y, 10, this.cropRect.y + this.cropRect.height - bounds.y);
            if (this.lockAspectRatio) {
                newWidth = newHeight * this.aspectRatio;
                if (newWidth > bounds.x + bounds.width - this.cropRect.x) {
                    newWidth = bounds.x + bounds.width - this.cropRect.x;
                    newHeight = newWidth / this.aspectRatio;
                }
                this.cropRect.width = newWidth;
            } else {
                newWidth = this.cropRect.width;
            }
            this.cropRect.y = this.clamp(y, bounds.y, this.cropRect.y + this.cropRect.height - 10);
            this.cropRect.height = newHeight;
        } else if (this.isDragging === 'bottom') {
            newHeight = this.clamp(y - this.cropRect.y, 10, bounds.y + bounds.height - this.cropRect.y);
            if (this.lockAspectRatio) {
                newWidth = newHeight * this.aspectRatio;
                if (newWidth > bounds.x + bounds.width - this.cropRect.x) {
                    newWidth = bounds.x + bounds.width - this.cropRect.x;
                    newHeight = newWidth / this.aspectRatio;
                }
                this.cropRect.width = newWidth;
            } else {
                newWidth = this.cropRect.width;
            }
            this.cropRect.height = newHeight;
        }
    }
}