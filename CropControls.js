export class CropControls {
    constructor(cropRotate) {
        this.cropRotate = cropRotate;
    }

    setupCropControls() {
        const mainAspectRatio = this.cropRotate.state.image 
            ? this.cropRotate.simplifyAspectRatio(this.cropRotate.state.image.width, this.cropRotate.state.image.height) 
            : 'N/A';
        const cropControls = document.getElementById('crop-controls');
        if (!cropControls) {
            console.error("Crop controls container (#crop-controls) not found in DOM.");
            return;
        }

        cropControls.innerHTML = `
            <div class="crop-control-row">
                <div class="crop-control-group">
                    <label for="cropRotation">Rotation:</label>
                    <input type="range" id="cropRotation" min="-180" max="180" value="${this.cropRotate.rotation}">
                    <span id="rotation-value" style="cursor: pointer;">${this.cropRotate.rotation}°</span>
                </div>
                ${!this.cropRotate.isBackgroundCrop ? `
                <div class="crop-control-group aspect-lock-group">
                    <div class="aspect-ratio-wrapper">
                        <label for="aspect-ratio">Aspect Ratio:</label>
                        <select id="aspect-ratio">
                            <option value="free">Free</option>
                            <option value="main">${mainAspectRatio} (Current Main Image)</option>
                            <option value="1:1">1:1 (Square)</option>
                            <option value="4:3">4:3</option>
                            <option value="3:2">3:2</option>
                            <option value="16:9">16:9</option>
                            <option value="9:16">9:16</option>
                            <option value="5:4">5:4</option>
                            <option value="4:5">4:5</option>
                        </select>
                    </div>
                </div>` : `
                <div class="crop-control-group">
                    <label>Aspect Ratio:</label>
                    <span>Locked to Main Image (${this.cropRotate.simplifyAspectRatio(this.cropRotate.state.mainCropAspectRatio * 100, 100)})</span>
                </div>`}
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
            </div>
            <div class="crop-button-row">
                <button id="crop-restore">Reset</button>
                <button id="crop-confirm">Apply</button>
                <button id="crop-skip">Cancel</button>
                ${!this.cropRotate.isBackgroundCrop ? `
                <div class="crop-lock-group">
                    <input type="checkbox" id="lock-aspect" ${this.cropRotate.lockAspectRatio ? 'checked' : ''}>
                    <label for="lock-aspect">Lock Aspect Ratio</label>
                </div>` : ''}
            </div>
        `;

        requestAnimationFrame(() => {
            const rotationInput = document.getElementById('cropRotation');
            const rotationValue = document.getElementById('rotation-value');
            const aspectRatioSelect = document.getElementById('aspect-ratio');
            const gridTypeSelect = document.getElementById('grid-type');
            const restoreBtn = document.getElementById('crop-restore');
            const confirmBtn = document.getElementById('crop-confirm');
            const skipBtn = document.getElementById('crop-skip');
            const lockCheckbox = document.getElementById('lock-aspect');

            rotationInput.addEventListener('input', (e) => {
                this.cropRotate.rotation = parseInt(e.target.value);
                rotationValue.textContent = `${this.cropRotate.rotation}°`;
                this.cropRotate.drawCropOverlay();
            });

            rotationValue.addEventListener('click', () => {
                this.cropRotate.rotation = 0;
                rotationInput.value = 0;
                rotationValue.textContent = '0°';
                this.cropRotate.drawCropOverlay();
            });

            if (!this.cropRotate.isBackgroundCrop && aspectRatioSelect) {
                aspectRatioSelect.addEventListener('change', (e) => {
                    this.applyAspectRatio(e.target.value);
                    this.cropRotate.drawCropOverlay();
                });
            }

            gridTypeSelect.addEventListener('change', (e) => {
                this.cropRotate.gridType = e.target.value;
                this.cropRotate.drawCropOverlay();
            });

            restoreBtn.addEventListener('click', () => {
                rotationInput.value = 0;
                rotationValue.textContent = '0°';
                gridTypeSelect.value = 'cross';
                if (!this.cropRotate.isBackgroundCrop && aspectRatioSelect) {
                    aspectRatioSelect.value = 'free';
                    lockCheckbox.checked = false;
                }
                this.cropRotate.resetCropRect(0);
            });

            confirmBtn.addEventListener('click', () => {
                this.cropRotate.closeModal();
                this.cropRotate.applyCrop();
                this.cropRotate.state.commitAdjustment();
            });

            skipBtn.addEventListener('click', () => this.cropRotate.closeModal());

            if (!this.cropRotate.isBackgroundCrop && lockCheckbox) {
                lockCheckbox.addEventListener('change', (e) => {
                    this.cropRotate.lockAspectRatio = e.target.checked;
                    if (this.cropRotate.lockAspectRatio && aspectRatioSelect.value === 'free') {
                        this.cropRotate.aspectRatio = this.cropRotate.cropRect.width / this.cropRotate.cropRect.height;
                    }
                    this.cropRotate.drawCropOverlay();
                });
            }

            const closeBtn = this.cropRotate.cropModal.querySelector('.modal-close-btn');
            closeBtn.addEventListener('click', () => this.cropRotate.closeModal());
        });
    }

    applyAspectRatio(ratioStr) {
        const rotatedBounds = this.cropRotate.getRotatedImageBounds(this.cropRotate.originalWidth, this.cropRotate.originalHeight, this.cropRotate.rotation, this.cropRotate.fixedScale);
        let newWidth, newHeight;

        const lockCheckbox = document.getElementById('lock-aspect');

        if (ratioStr === 'free') {
            this.cropRotate.lockAspectRatio = false;
            if (lockCheckbox) lockCheckbox.checked = false;
            return;
        }

        this.cropRotate.lockAspectRatio = true;
        if (lockCheckbox) lockCheckbox.checked = true;

        if (ratioStr === 'main' && this.cropRotate.state.image) {
            this.cropRotate.aspectRatio = this.cropRotate.state.mainCropAspectRatio || (this.cropRotate.state.image.width / this.cropRotate.state.image.height);
        } else {
            const [widthRatio, heightRatio] = ratioStr.split(':').map(Number);
            this.cropRotate.aspectRatio = widthRatio / heightRatio;
        }

        const currentCenterX = this.cropRotate.cropRect.x + this.cropRotate.cropRect.width / 2;
        const currentCenterY = this.cropRotate.cropRect.y + this.cropRotate.cropRect.height / 2;

        if (this.cropRotate.cropRect.width / this.cropRotate.cropRect.height > this.cropRotate.aspectRatio) {
            newWidth = this.cropRotate.cropRect.height * this.cropRotate.aspectRatio;
            newHeight = this.cropRotate.cropRect.height;
        } else {
            newWidth = this.cropRotate.cropRect.width;
            newHeight = this.cropRotate.cropRect.width / this.cropRotate.aspectRatio;
        }

        newWidth = this.cropRotate.clamp(newWidth, 10, rotatedBounds.width);
        newHeight = this.cropRotate.clamp(newHeight, 10, rotatedBounds.height);

        this.cropRotate.cropRect.width = newWidth;
        this.cropRotate.cropRect.height = newHeight;

        this.cropRotate.cropRect.x = currentCenterX - newWidth / 2;
        this.cropRotate.cropRect.y = currentCenterY - newHeight / 2;

        this.cropRotate.cropRect.x = this.cropRotate.clamp(this.cropRotate.cropRect.x, rotatedBounds.x, rotatedBounds.x + rotatedBounds.width - newWidth);
        this.cropRotate.cropRect.y = this.cropRotate.clamp(this.cropRotate.cropRect.y, rotatedBounds.y, rotatedBounds.y + rotatedBounds.height - newHeight);
    }
}