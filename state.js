export class State {
    constructor(canvas) {
        this.canvas = canvas;
        this.originalImage = null;
        this.image = null;
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
            scanLines: 0.0,
            waveDistortion: 0.0,
            chromaticAberration: 0.0,
            digitalNoise: 0.0,
            blockGlitch: 0.0,
            ghosting: 0.0,
            colorBleed: 0.0,
            fractalDistortion: 0.0,
            randomTint: 0.0
        };
        this.aspectRatio = 1;
        this.history = [];
        this.historyIndex = -1;
        this.redoStack = [];
        this.showOriginal = false;
        this.cropSettings = null;
        this.cropHistory = [];
        this.lastCropRect = null;
    }

    setImage(img) {
        if (!this.originalImage) {
            this.originalImage = img;
            this.addInitialStateToHistory();
        }
        this.image = img;
        this.aspectRatio = img.width / img.height;
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
            scanLines: 0.0,
            waveDistortion: 0.0,
            chromaticAberration: 0.0,
            digitalNoise: 0.0,
            blockGlitch: 0.0,
            ghosting: 0.0,
            colorBleed: 0.0,
            fractalDistortion: 0.0,
            randomTint: 0.0
        };
        this.showOriginal = false;
        this.history = [];
        this.historyIndex = -1;
        this.redoStack = [];
        this.lastCropRect = null;
        this.addInitialStateToHistory();
    }

    resetForNewImage(img) {
        this.originalImage = null;
        this.image = null;
        this.cropHistory = [];
        this.lastCropRect = null;
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
            scanLines: 0.0,
            waveDistortion: 0.0,
            chromaticAberration: 0.0,
            digitalNoise: 0.0,
            blockGlitch: 0.0,
            ghosting: 0.0,
            colorBleed: 0.0,
            fractalDistortion: 0.0,
            randomTint: 0.0
        };
        this.aspectRatio = 1;
        this.history = [];
        this.historyIndex = -1;
        this.redoStack = [];
        this.showOriginal = false;
        this.cropSettings = null;
        this.setImage(img);
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
}