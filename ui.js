export class UI {
    constructor(state, imageProcessor, canvas) {
        this.state = state;
        this.imageProcessor = imageProcessor;
        this.canvas = canvas;
        this.renderTimeout = null;
        this.initUI();
    }

    initUI() {
        const sliders = [
            'brightness', 'contrast', 'saturation', 'hue', 'exposure', 'highlights', 'shadows',
            'blacks', 'whites', 'temperature', 'tint', 'sharpness', 'vignette', 'noise',
            'clarity', 'opacity', 'gamma', 'sepia', 'vibrance', 'grayscale', 'invert',
            'rgbSplit', 'filmGrain', 'waveDistortion', 'blockGlitch', 'ghosting',
            'fractalDistortion', 'colorShift', 'pixelNoise', 'scratchTexture',
            'organicDistortion'
        ];

        sliders.forEach(slider => {
            const element = document.getElementById(slider);
            element.addEventListener('input', (e) => {
                this.state.setAdjustment(slider, e.target.value);
                this.debounceRender();
            }, { passive: true });
            element.addEventListener('change', () => this.state.commitAdjustment());
        });

        document.getElementById('reset').addEventListener('click', () => {
            this.state.reset();
            this.imageProcessor.setImage(this.state.image);
            requestAnimationFrame(() => {
                this.imageProcessor.render();
                this.resetSliders();
            });
        });

        const exportModal = document.getElementById('export-modal');
        const formatSelect = document.getElementById('format');
        const qualitySelect = document.getElementById('quality');
        const filenameInput = document.getElementById('filename');
        const downloadBtn = document.getElementById('download-btn');
        const cancelBtn = document.getElementById('cancel-btn');
        const exportCloseBtn = exportModal.querySelector('.modal-close-btn');

        const closeModal = () => exportModal.style.display = 'none';

        formatSelect.addEventListener('change', () => {
            qualitySelect.disabled = formatSelect.value === 'png';
            if (qualitySelect.disabled) qualitySelect.value = '1.0';
        });

        downloadBtn.addEventListener('click', () => {
            this.imageProcessor.render();
            const format = formatSelect.value;
            const quality = parseFloat(qualitySelect.value);
            const filename = filenameInput.value || 'edited-image';
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const extension = format === 'jpeg' ? 'jpg' : 'png';
            const dataURL = format === 'png' ? this.canvas.toDataURL('image/png') : this.canvas.toDataURL(mimeType, quality);
            const link = document.createElement('a');
            link.download = `${filename}.${extension}`;
            link.href = dataURL;
            link.click();
            closeModal();
        });

        cancelBtn.addEventListener('click', closeModal);
        exportCloseBtn.addEventListener('click', closeModal);

        document.getElementById('export').addEventListener('click', () => this.showExportModal());

        document.getElementById('undo').addEventListener('click', () => {
            if (this.state.undo()) {
                this.updateSlidersFromState();
                requestAnimationFrame(() => this.imageProcessor.render());
            }
        });

        document.getElementById('redo').addEventListener('click', () => {
            if (this.state.redo()) {
                this.updateSlidersFromState();
                requestAnimationFrame(() => this.imageProcessor.render());
            }
        });

        document.getElementById('toggle-original').addEventListener('click', () => {
            this.state.toggleOriginal();
            requestAnimationFrame(() => this.imageProcessor.render());
        });
    }

    showExportModal() {
        const exportModal = document.getElementById('export-modal');
        const formatSelect = document.getElementById('format');
        const qualitySelect = document.getElementById('quality');
        const filenameInput = document.getElementById('filename');

        exportModal.style.display = 'flex';
        formatSelect.value = 'jpeg';
        qualitySelect.value = '1.0';
        filenameInput.value = 'edited-image';
        qualitySelect.disabled = false;
    }

    resetSliders() {
        const defaults = {
            brightness: 1, contrast: 1, saturation: 1, hue: 0, exposure: 1, highlights: 0, shadows: 0,
            blacks: 0, whites: 0, temperature: 0, tint: 0, sharpness: 0, vignette: 0, noise: 0,
            clarity: 0, opacity: 1, gamma: 1, sepia: 0, vibrance: 0, grayscale: 0, invert: 0,
            rgbSplit: 0, filmGrain: 0, waveDistortion: 0, blockGlitch: 0, ghosting: 0,
            fractalDistortion: 0, colorShift: 0, pixelNoise: 0, scratchTexture: 0, organicDistortion: 0
        };
        for (let key in defaults) {
            document.getElementById(key).value = defaults[key];
        }
    }

    updateSlidersFromState() {
        for (let key in this.state.adjustments) {
            document.getElementById(key).value = this.state.adjustments[key];
        }
    }

    debounceRender() {
        clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => requestAnimationFrame(() => this.imageProcessor.render()), 50);
    }
}