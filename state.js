export class State {
    constructor(canvas) {
        this.canvas = canvas;
        this.originalImage = null;
        this.image = null;
        this.originalBackgroundImage = null;
        this.backgroundImage = null;
        this.adjustments = {
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            hue: 0.0,
            exposure: 1.0,
            highlights: 0.0,
            shadows: 0.0,
            blacks: 0.0,
            whites: 0.0,
            temperature: 0.0,
            tint: 0.0,
            sharpness: 0.0,
            vignette: 0.0,
            noise: 0.0,
            clarity: 0.0,
            opacity: 1.0,
            gamma: 1.0,
            sepia: 0.0,
            vibrance: 0.0,
            grayscale: 0.0,
            invert: 0.0,
            rgbSplit: 0.0,
            filmGrain: 0.0,
            waveDistortion: 0.0,
            blockGlitch: 0.0,
            ghosting: 0.0,
            fractalDistortion: 0.0,
            colorShift: 0.0,
            pixelNoise: 0.0,
            scratchTexture: 0.0,
            organicDistortion: 0.0
        };
        this.aspectRatio = 1;
        this.mainCropAspectRatio = null;
        this.history = [];
        this.historyIndex = -1;
        this.redoStack = [];
        this.showOriginal = false;
        this.cropSettings = null;
        this.cropHistory = [];
        this.backgroundCropSettings = null;
        this.backgroundCropHistory = [];
        this.lastMainCropRect = null;      // Separate state for main image last crop
        this.lastBackgroundCropRect = null; // Separate state for background image last crop
    }

    setImage(img) {
        if (!this.originalImage) {
            this.originalImage = img;
            this.addInitialStateToHistory();
        }
        this.image = img;
        this.aspectRatio = img.width / img.height;
        if (!this.mainCropAspectRatio) {
            this.mainCropAspectRatio = this.aspectRatio;
        }
    }

    setBackgroundImage(img) {
        if (!this.originalBackgroundImage) {
            this.originalBackgroundImage = img;
        }
        this.backgroundImage = img;
    }

    setAdjustment(key, value) {
        let parsedValue = parseFloat(value);
        if (key === 'contrast') {
            parsedValue = Math.max(0, parsedValue);
        }
        this.adjustments[key] = parsedValue;
    }

    commitAdjustment() {
        this.addToHistory();
    }

    reset() {
        this.adjustments = {
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            hue: 0.0,
            exposure: 1.0,
            highlights: 0.0,
            shadows: 0.0,
            blacks: 0.0,
            whites: 0.0,
            temperature: 0.0,
            tint: 0.0,
            sharpness: 0.0,
            vignette: 0.0,
            noise: 0.0,
            clarity: 0.0,
            opacity: 1.0,
            gamma: 1.0,
            sepia: 0.0,
            vibrance: 0.0,
            grayscale: 0.0,
            invert: 0.0,
            rgbSplit: 0.0,
            filmGrain: 0.0,
            waveDistortion: 0.0,
            blockGlitch: 0.0,
            ghosting: 0.0,
            fractalDistortion: 0.0,
            colorShift: 0.0,
            pixelNoise: 0.0,
            scratchTexture: 0.0,
            organicDistortion: 0.0
        };
        this.showOriginal = false;
        this.history = [];
        this.historyIndex = -1;
        this.redoStack = [];
        this.lastMainCropRect = null;
        this.lastBackgroundCropRect = null;
        this.addInitialStateToHistory();
    }

    resetForNewImage(img) {
        this.originalImage = null;
        this.image = null;
        this.originalBackgroundImage = null;
        this.backgroundImage = null;
        this.cropHistory = [];
        this.backgroundCropHistory = [];
        this.lastMainCropRect = null;
        this.lastBackgroundCropRect = null;
        this.adjustments = {
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            hue: 0.0,
            exposure: 1.0,
            highlights: 0.0,
            shadows: 0.0,
            blacks: 0.0,
            whites: 0.0,
            temperature: 0.0,
            tint: 0.0,
            sharpness: 0.0,
            vignette: 0.0,
            noise: 0.0,
            clarity: 0.0,
            opacity: 1.0,
            gamma: 1.0,
            sepia: 0.0,
            vibrance: 0.0,
            grayscale: 0.0,
            invert: 0.0,
            rgbSplit: 0.0,
            filmGrain: 0.0,
            waveDistortion: 0.0,
            blockGlitch: 0.0,
            ghosting: 0.0,
            fractalDistortion: 0.0,
            colorShift: 0.0,
            pixelNoise: 0.0,
            scratchTexture: 0.0,
            organicDistortion: 0.0
        };
        this.aspectRatio = 1;
        this.mainCropAspectRatio = null;
        this.history = [];
        this.historyIndex = -1;
        this.redoStack = [];
        this.showOriginal = false;
        this.cropSettings = null;
        this.backgroundCropSettings = null;
        this.setImage(img);
    }

    resetBackgroundToOriginal() {
        if (this.originalBackgroundImage) {
            this.backgroundImage = this.originalBackgroundImage;
            this.backgroundCropSettings = null;
            this.backgroundCropHistory = [];
            this.lastBackgroundCropRect = null;
        }
    }

    toggleOriginal() {
        this.showOriginal = !this.showOriginal;
    }

    addInitialStateToHistory() {
        const stateSnapshot = {
            adjustments: { ...this.adjustments }
        };
        this.history = [stateSnapshot];
        this.historyIndex = 0;
        this.redoStack = [];
    }

    addToHistory() {
        const stateSnapshot = {
            adjustments: { ...this.adjustments }
        };

        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(stateSnapshot);
        this.historyIndex = this.history.length - 1;
        this.redoStack = [];
    }

    undo() {
        if (this.historyIndex <= 0) return false;

        const currentState = {
            adjustments: { ...this.adjustments }
        };
        this.redoStack.push(currentState);
        this.historyIndex--;
        this.applyState(this.history[this.historyIndex]);
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;

        this.historyIndex++;
        const stateToApply = this.redoStack.pop();
        this.history[this.historyIndex] = stateToApply;
        this.applyState(stateToApply);
        return true;
    }

    applyState(stateSnapshot) {
        this.adjustments = { ...stateSnapshot.adjustments };
    }

    updateMainCropAspectRatio(width, height) {
        const previousBgRotation = this.backgroundCropSettings?.rotation || this.lastBackgroundCropRect?.rotation || 0; // Capture current rotation
        this.mainCropAspectRatio = width / height;
        // Clear background crop settings to force update
        this.backgroundCropSettings = null;
        this.backgroundCropHistory = [];
        this.lastBackgroundCropRect = null;
        // Restore the rotation if it existed
        if (this.backgroundImage) {
            this.backgroundCropSettings = {
                x: 0,
                y: 0,
                width: this.backgroundImage.width,
                height: this.backgroundImage.height,
                rotation: previousBgRotation,
                scale: 1
            };
        }
    }
}