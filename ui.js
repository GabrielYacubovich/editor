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
            'clarity', 'opacity', 'gamma', 'sepia', 'vibrance', 'grayscale', 'invert'
        ];

        sliders.forEach(slider => {
            const element = document.getElementById(slider);
            element.addEventListener('input', (e) => {
                this.state.setAdjustment(slider, e.target.value);
                this.debounceRender();
            });
            element.addEventListener('change', () => {
                this.state.commitAdjustment();
            });
        });

        document.getElementById('reset').addEventListener('click', () => {
            this.state.reset();
            this.imageProcessor.setImage(this.state.image);
            this.imageProcessor.render();
            this.resetSliders();
        });

        const exportModal = document.getElementById('export-modal');
        const formatSelect = document.getElementById('format');
        const qualitySelect = document.getElementById('quality');
        const filenameInput = document.getElementById('filename');
        const downloadBtn = document.getElementById('download-btn');
        const cancelBtn = document.getElementById('cancel-btn');
        const exportCloseBtn = exportModal.querySelector('.modal-close-btn');

        const closeModal = () => {
            exportModal.style.display = 'none';
        };

        formatSelect.addEventListener('change', () => {
            if (formatSelect.value === 'png') {
                qualitySelect.disabled = true;
                qualitySelect.value = '1.0';
            } else {
                qualitySelect.disabled = false;
            }
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

        document.getElementById('export').addEventListener('click', () => {
            this.showExportModal();
        });

        document.getElementById('undo').addEventListener('click', () => {
            if (this.state.undo()) {
                this.updateSlidersFromState();
                this.imageProcessor.render();
            }
        });

        document.getElementById('redo').addEventListener('click', () => {
            if (this.state.redo()) {
                this.updateSlidersFromState();
                this.imageProcessor.render();
            }
        });

        document.getElementById('toggle-original').addEventListener('click', () => {
            this.state.toggleOriginal();
            this.imageProcessor.render();
        });

        document.getElementById('crop').addEventListener('click', () => {
            // Logic remains in main.js
        });
    }

    showExportModal() {
        const exportModal = document.getElementById('export-modal');
        const formatSelect = document.getElementById('format');
        const qualitySelect = document.getElementById('quality');
        const filenameInput = document.getElementById('filename');

        exportModal.style.display = 'flex';
        formatSelect.value = 'png';
        qualitySelect.value = '1.0';
        filenameInput.value = 'edited-image';
        qualitySelect.disabled = true;
    }

    resetSliders() {
        document.getElementById('brightness').value = 1.0;
        document.getElementById('contrast').value = 1.0;
        document.getElementById('saturation').value = 1.0;
        document.getElementById('hue').value = 0.0;
        document.getElementById('exposure').value = 1.0;
        document.getElementById('highlights').value = 0.0;
        document.getElementById('shadows').value = 0.0;
        document.getElementById('blacks').value = 0.0;
        document.getElementById('whites').value = 0.0;
        document.getElementById('temperature').value = 0.0;
        document.getElementById('tint').value = 0.0;
        document.getElementById('sharpness').value = 0.0;
        document.getElementById('vignette').value = 0.0;
        document.getElementById('noise').value = 0.0;
        document.getElementById('clarity').value = 0.0;
        document.getElementById('opacity').value = 1.0;
        document.getElementById('gamma').value = 1.0;
        document.getElementById('sepia').value = 0.0;
        document.getElementById('vibrance').value = 0.0;
        document.getElementById('grayscale').value = 0.0;
        document.getElementById('invert').value = 0.0;
    }

    updateSlidersFromState() {
        for (let key in this.state.adjustments) {
            document.getElementById(key).value = this.state.adjustments[key];
        }
    }

    debounceRender() {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.imageProcessor.render(), 100);
    }
}