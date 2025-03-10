const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const controls = document.querySelectorAll('.controls input');
const undoButton = document.getElementById('undo');
const redoButton = document.getElementById('redo');
const restoreButton = document.getElementById('restore');
const downloadButton = document.getElementById('download');
const uploadNewPhotoButton = document.getElementById('upload-new-photo');
const toggleOriginalButton = document.getElementById('toggle-original');
const modal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const cropModal = document.getElementById('crop-modal');
const cropCanvas = document.getElementById('crop-canvas');
const cropCtx = cropCanvas.getContext('2d');
const previewModal = document.getElementById('preview-modal');

let img = new Image();
let originalImageData = null;
let noiseSeed = Math.random();
let fullResCanvas = document.createElement('canvas');
let fullResCtx = fullResCanvas.getContext('2d');
let isShowingOriginal = false;

let settings = {
    brightness: 100,
    contrast: 100,
    grayscale: 0,
    vibrance: 100,
    highlights: 100,
    shadows: 100,
    noise: 0,
    exposure: 100,
    temperature: 100,
    saturation: 100,
    'glitch-scanline': 0,
    'glitch-chromatic': 0,
    'glitch-rgb-split': 0,
    'glitch-invert': 0,
    'glitch-vhs': 0,
    'glitch-chromatic-vertical': 0,
    'glitch-chromatic-diagonal': 0,
    'glitch-pixel-shuffle': 0,
    'glitch-wave': 0,
    'pixel-grain': 0,
    'pixel-dither': 0,
    'kaleidoscope-segments': 0,
    'kaleidoscope-offset': 0,
    'vortex-twist': 0,
    'edge-detect': 0
};
let history = [{ filters: { ...settings }, imageData: null }];
let redoHistory = [];
let lastAppliedEffect = null;

let originalWidth, originalHeight, previewWidth, previewHeight;
let cropImage = new Image();
let cropRect = { x: 0, y: 0, width: 0, height: 0 };
let isDragging = false;
let startX, startY;
let lockAspectRatio = false;
let aspectRatio = 1;
let rotation = 0;

function closeModal(modalElement) {
    modalElement.style.display = 'none';
    if (modalElement === cropModal) {
        isDragging = false;
        rotation = 0;
        cropCanvas.style.cursor = 'default';
        uploadNewPhotoButton.style.display = 'block';
    }
    if (modalElement === modal) {
        document.getElementById('modal-controls').innerHTML = '';
    }
}

function setupModal(modalElement) {
    const closeBtn = modalElement.querySelector('.modal-close-btn');
    closeBtn.addEventListener('click', () => closeModal(modalElement));
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) closeModal(modalElement);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalElement.style.display === 'block') {
            closeModal(modalElement);
        }
    });
}

[modal, cropModal, previewModal].forEach(setupModal);

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

uploadNewPhotoButton.addEventListener('click', (e) => {
    e.preventDefault();
    triggerFileUpload();
});

let isTriggering = false;

function triggerFileUpload() {
    if (isTriggering) {
        console.log("triggerFileUpload blocked due to ongoing call");
        return;
    }
    isTriggering = true;
    console.log("triggerFileUpload called");
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', (e) => {
        console.log("File input changed, files:", e.target.files);
        const file = e.target.files[0];
        if (!file) {
            console.log("No file selected");
            document.body.removeChild(fileInput);
            isTriggering = false;
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            console.log("FileReader onload, data length:", event.target.result.length);
            showCropModal(event.target.result);
            document.body.removeChild(fileInput);
            isTriggering = false;
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            document.body.removeChild(fileInput);
            isTriggering = false;
        };
        reader.readAsDataURL(file);
    });
    setTimeout(() => {
        console.log("File input clicked");
        fileInput.click();
    }, 0);
}

uploadNewPhotoButton.removeEventListener('click', triggerFileUpload);
uploadNewPhotoButton.addEventListener('click', (e) => {
    e.preventDefault();
    triggerFileUpload();
});

function updateControlIndicators() {
    const controlValues = [
        'brightness', 'contrast', 'grayscale', 'vibrance', 'highlights', 'shadows', 
        'noise', 'exposure', 'temperature', 'saturation',
        'glitch-scanline', 'glitch-chromatic', 'glitch-rgb-split', 'glitch-invert',
        'glitch-vhs', 'glitch-chromatic-vertical', 'glitch-chromatic-diagonal',
        'glitch-pixel-shuffle', 'glitch-wave',
        'pixel-grain', 'pixel-dither', 'kaleidoscope-segments', 'kaleidoscope-offset',
        'vortex-twist', 'edge-detect'
    ];
    controlValues.forEach(id => {
        const indicator = document.getElementById(`${id}-value`);
        if (indicator) {
            indicator.textContent = id === 'kaleidoscope-segments' ? `${settings[id]}` : `${settings[id]}%`;
        }
    });
}

function showLoadingIndicator(show = true) {
    const loading = document.getElementById('loading-indicator');
    if (!loading) {
        const div = document.createElement('div');
        div.id = 'loading-indicator';
        div.style.position = 'absolute';
        div.style.bottom = '10px';
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%)';
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        div.style.color = 'white';
        div.style.padding = '10px 20px';
        div.style.borderRadius = '5px';
        div.style.zIndex = '1003';
        div.textContent = 'Rendering...';
        document.body.appendChild(div);
    }
    loading.style.display = show ? 'block' : 'none';
    if (show && canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        loading.style.left = `${canvasRect.left + canvasRect.width / 2}px`;
        loading.style.top = `${canvasRect.bottom + 10}px`;
    }
}

function applyBasicFiltersManually(ctx, canvas, settings) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const brightnessFactor = (settings.brightness - 100) / 100 + 1;
    const exposureFactor = (settings.exposure - 100) / 100 + 1;
    const contrastFactor = (settings.contrast - 100) / 100 + 1;
    const grayscale = settings.grayscale / 100;
    const saturationFactor = (settings.saturation - 100) / 100 + 1;
    const temperatureFactor = (settings.temperature - 100) / 100;
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        r *= brightnessFactor * exposureFactor;
        g *= brightnessFactor * exposureFactor;
        b *= brightnessFactor * exposureFactor;
        r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
        g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
        b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;
        if (grayscale > 0) {
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            r = r * (1 - grayscale) + gray * grayscale;
            g = g * (1 - grayscale) + gray * grayscale;
            b = b * (1 - grayscale) + gray * grayscale;
        }
        if (saturationFactor !== 1) {
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            r = gray + (r - gray) * saturationFactor;
            g = gray + (g - gray) * saturationFactor;
            b = gray + (b - gray) * saturationFactor;
        }
        if (temperatureFactor !== 0) {
            if (temperatureFactor > 0) {
                r += temperatureFactor * 50;
                b -= temperatureFactor * 50;
            } else {
                r -= Math.abs(temperatureFactor) * 50;
                b += Math.abs(temperatureFactor) * 50;
            }
        }
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
    }
    ctx.putImageData(imageData, 0, 0);
}

function redrawImage(saveState = false) {
    showLoadingIndicator(true);
    fullResCanvas.width = originalWidth;
    fullResCanvas.height = originalHeight;
    fullResCtx.clearRect(0, 0, fullResCanvas.width, fullResCanvas.height);
    fullResCtx.drawImage(img, 0, 0, originalWidth, originalHeight);
    applyBasicFiltersManually(fullResCtx, fullResCanvas, settings);
    const scaleFactor = 1;
    return applyAdvancedFilters(fullResCtx, fullResCanvas, noiseSeed, scaleFactor)
        .then(() => applyGlitchEffects(fullResCtx, fullResCanvas, noiseSeed, scaleFactor))
        .then(() => applyComplexFilters(fullResCtx, fullResCanvas, noiseSeed, scaleFactor))
        .then(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (isShowingOriginal && originalImageData) {
                ctx.putImageData(originalImageData, 0, 0);
            } else {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(fullResCanvas, 0, 0, canvas.width, canvas.height);
            }
            if (modal.style.display === 'block') {
                modalImage.src = canvas.toDataURL('image/png');
            }
            if (saveState) saveImageState();
            showLoadingIndicator(false);
        })
        .catch(error => {
            console.error('Error in redraw:', error);
            showLoadingIndicator(false);
        });
}

function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function applyGlitchEffects(ctx, canvas, seed = noiseSeed, scaleFactor = 1) {
    return new Promise((resolve) => {
        let randomSeed = seed;
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        const resolutionScale = scaleFactor;
        const previewMinDimension = Math.min(width, height);
        const baseShift = 50;
        if (settings['glitch-scanline'] > 0) {
            const intensity = settings['glitch-scanline'] / 100;
            for (let y = 0; y < height; y += Math.floor(5 / intensity * resolutionScale)) {
                randomSeed += 1;
                if (seededRandom(randomSeed) < 0.3 * intensity) {
                    const shift = Math.floor(seededRandom(randomSeed + 1) * 50 * intensity * resolutionScale - 25 * intensity * resolutionScale);
                    for (let x = 0; x < width; x++) {
                        const srcIdx = (y * width + x) * 4;
                        const destX = Math.max(0, Math.min(width - 1, x + shift));
                        const destIdx = (y * width + destX) * 4;
                        data[destIdx] = data[srcIdx];
                        data[destIdx + 1] = data[srcIdx + 1];
                        data[destIdx + 2] = data[srcIdx + 2];
                        data[destIdx + 3] = data[srcIdx + 3];
                    }
                }
            }
        }
        if (settings['glitch-chromatic'] > 0) {
            const intensity = settings['glitch-chromatic'] / 100;
            const maxShift = Math.min(baseShift * intensity * (width / previewMinDimension), Math.min(width, height) / 8);
            const tempData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i++) tempData[i] = data[i];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const rShiftX = Math.max(0, x - Math.round(maxShift));
                    const gShiftX = Math.max(0, x - Math.round(maxShift * 0.5));
                    const bShiftX = Math.min(width - 1, x + Math.round(maxShift));
                    const rIdx = (y * width + rShiftX) * 4;
                    const gIdx = (y * width + gShiftX) * 4;
                    const bIdx = (y * width + bShiftX) * 4;
                    data[idx] = tempData[rIdx];
                    data[idx + 1] = tempData[gIdx + 1];
                    data[idx + 2] = tempData[bIdx + 2];
                    data[idx + 3] = tempData[idx + 3];
                }
            }
        }
        if (settings['glitch-rgb-split'] > 0) {
            const intensity = settings['glitch-rgb-split'] / 100;
            const maxShift = Math.min(30 * intensity * (Math.max(width, height) / previewMinDimension), Math.max(width, height) / 8);
            const tempData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i++) tempData[i] = data[i];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    randomSeed += 1;
                    const rShift = Math.floor(seededRandom(randomSeed) * maxShift - maxShift / 2);
                    randomSeed += 1;
                    const gShift = Math.floor(seededRandom(randomSeed) * maxShift - maxShift / 2);
                    randomSeed += 1;
                    const bShift = Math.floor(seededRandom(randomSeed) * maxShift - maxShift / 2);
                    const rX = Math.max(0, Math.min(width - 1, x + rShift));
                    const gX = Math.max(0, Math.min(width - 1, x + gShift));
                    const bX = Math.max(0, Math.min(width - 1, x + bShift));
                    data[idx] = tempData[(y * width + rX) * 4];
                    data[idx + 1] = tempData[(y * width + gX) * 4 + 1];
                    data[idx + 2] = tempData[(y * width + bX) * 4 + 2];
                }
            }
        }
        if (settings['glitch-invert'] > 0) {
            const intensity = settings['glitch-invert'] / 100;
            for (let y = 0; y < height; y++) {
                randomSeed += 1;
                if (seededRandom(randomSeed) < 0.15 * intensity) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        data[idx] = 255 - data[idx];
                        data[idx + 1] = 255 - data[idx + 1];
                        data[idx + 2] = 255 - data[idx + 2];
                    }
                }
            }
        }
        if (settings['glitch-vhs'] > 0) {
            const intensity = settings['glitch-vhs'] / 100;
            for (let y = 0; y < height; y++) {
                randomSeed += 1;
                if (seededRandom(randomSeed) < 0.15 * intensity) {
                    randomSeed += 1;
                    const shift = Math.floor(seededRandom(randomSeed) * 30 * intensity * resolutionScale - 15 * intensity * resolutionScale);
                    const strip = ctx.getImageData(0, y, width, 1);
                    ctx.putImageData(strip, shift, y);
                }
            }
            ctx.globalAlpha = 0.4 * intensity;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(0, 0, width, height / 3);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.fillRect(0, height / 3, width, height / 3);
            ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
            ctx.fillRect(0, 2 * height / 3, width, height / 3);
            ctx.globalAlpha = 1.0;
            for (let i = 0; i < data.length; i += 4) {
                randomSeed += 1;
                if (seededRandom(randomSeed) < 0.1 * intensity) {
                    randomSeed += 1;
                    const noise = seededRandom(randomSeed) * 100 * intensity * resolutionScale;
                    if (!(data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255 && data[i + 3] === 255)) {
                        data[i] += noise;
                        data[i + 1] += noise;
                        data[i + 2] += noise;
                    }
                }
            }
        }
        if (settings['glitch-chromatic-vertical'] > 0) {
            const intensity = settings['glitch-chromatic-vertical'] / 100;
            const maxShift = Math.min(baseShift * intensity * (height / previewMinDimension), Math.min(width, height) / 8);
            const tempData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i++) tempData[i] = data[i];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const rShiftY = Math.max(0, y - Math.round(maxShift));
                    const gShiftY = Math.max(0, y - Math.round(maxShift * 0.5));
                    const bShiftY = Math.min(height - 1, y + Math.round(maxShift));
                    const rIdx = (rShiftY * width + x) * 4;
                    const gIdx = (gShiftY * width + x) * 4;
                    const bIdx = (bShiftY * width + x) * 4;
                    data[idx] = tempData[rIdx];
                    data[idx + 1] = tempData[gIdx + 1];
                    data[idx + 2] = tempData[bIdx + 2];
                    data[idx + 3] = tempData[idx + 3];
                }
            }
        }
        if (settings['glitch-chromatic-diagonal'] > 0) {
            const intensity = settings['glitch-chromatic-diagonal'] / 100;
            const maxShift = Math.min(50 * intensity * (Math.max(width, height) / previewMinDimension), Math.max(width, height) / 8);
            const tempData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i++) tempData[i] = data[i];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const rShiftX = Math.max(0, x - Math.round(maxShift));
                    const rShiftY = Math.max(0, y - Math.round(maxShift));
                    const gShiftX = x;
                    const gShiftY = y;
                    const bShiftX = Math.min(width - 1, x + Math.round(maxShift));
                    const bShiftY = Math.min(height - 1, y + Math.round(maxShift));
                    const rIdx = (rShiftY * width + rShiftX) * 4;
                    const gIdx = (gShiftY * width + gShiftX) * 4;
                    const bIdx = (bShiftY * width + bShiftX) * 4;
                    data[idx] = tempData[rIdx];
                    data[idx + 1] = tempData[gIdx + 1];
                    data[idx + 2] = tempData[bIdx + 2];
                    data[idx + 3] = tempData[idx + 3];
                }
            }
        }
        if (settings['glitch-pixel-shuffle'] > 0) {
            const intensity = settings['glitch-pixel-shuffle'] / 100;
            const blockSize = Math.floor(5 * resolutionScale);
            for (let y = 0; y < height - blockSize; y += blockSize) {
                for (let x = 0; x < width - blockSize; x += blockSize) {
                    randomSeed += 1;
                    if (seededRandom(randomSeed) < 0.3 * intensity) {
                        randomSeed += 1;
                        const destX = Math.min(width - blockSize, Math.max(0, x + Math.floor((seededRandom(randomSeed) - 0.5) * 50 * intensity * resolutionScale)));
                        randomSeed += 1;
                        const destY = Math.min(height - blockSize, Math.max(0, y + Math.floor((seededRandom(randomSeed) - 0.5) * 50 * intensity * resolutionScale)));
                        for (let dy = 0; dy < blockSize; dy++) {
                            for (let dx = 0; dx < blockSize; dx++) {
                                const srcIdx = ((y + dy) * width + (x + dx)) * 4;
                                const destIdx = ((destY + dy) * width + (destX + dx)) * 4;
                                [data[srcIdx], data[destIdx]] = [data[destIdx], data[srcIdx]];
                                [data[srcIdx + 1], data[destIdx + 1]] = [data[destIdx + 1], data[srcIdx + 1]];
                                [data[srcIdx + 2], data[destIdx + 2]] = [data[destIdx + 2], data[srcIdx + 2]];
                                [data[srcIdx + 3], data[destIdx + 3]] = [data[destIdx + 3], data[srcIdx + 3]];
                            }
                        }
                    }
                }
            }
        }
        if (settings['glitch-wave'] > 0) {
            const intensity = settings['glitch-wave'] / 100;
            const tempData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i++) tempData[i] = data[i];
            const amplitude = 20 * intensity * resolutionScale;
            const frequency = 0.05 / resolutionScale;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const waveShift = Math.floor(amplitude * Math.sin(frequency * y * randomSeed));
                    const newX = Math.max(0, Math.min(width - 1, x + waveShift));
                    const srcIdx = (y * width + newX) * 4;
                    data[idx] = tempData[srcIdx];
                    data[idx + 1] = tempData[srcIdx + 1];
                    data[idx + 2] = tempData[srcIdx + 2];
                    data[idx + 3] = tempData[srcIdx + 3];
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve();
    });
}

function applyComplexFilters(ctx, canvas, seed = noiseSeed, scaleFactor = 1) {
    return new Promise((resolve) => {
        let randomSeed = seed;
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        if (settings['pixel-grain'] > 0) {
            const intensity = settings['pixel-grain'] / 100;
            for (let i = 0; i < data.length; i += 4) {
                randomSeed += 1;
                const grain = (seededRandom(randomSeed) - 0.5) * 50 * intensity * scaleFactor;
                data[i] = Math.max(0, Math.min(255, data[i] + grain));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
            }
        }
        if (settings['pixel-dither'] > 0) {
            const intensity = settings['pixel-dither'] / 100;
            const tempData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i++) tempData[i] = data[i];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    for (let c = 0; c < 3; c++) {
                        const oldPixel = tempData[idx + c];
                        const newPixel = Math.round(oldPixel / 255 * 4 * intensity) * (255 / (4 * intensity));
                        tempData[idx + c] = newPixel;
                        const quantError = oldPixel - newPixel;
                        if (x + 1 < width) tempData[idx + 4 + c] += quantError * 7 / 16;
                        if (y + 1 < height) {
                            if (x - 1 >= 0) tempData[idx + (width - 1) * 4 + c] += quantError * 3 / 16;
                            tempData[idx + width * 4 + c] += quantError * 5 / 16;
                            if (x + 1 < width) tempData[idx + (width + 1) * 4 + c] += quantError * 1 / 16;
                        }
                    }
                }
            }
            for (let i = 0; i < data.length; i++) data[i] = tempData[i];
        }
        if (settings['kaleidoscope-segments'] > 0) {
            const segments = Math.max(1, settings['kaleidoscope-segments']);
            const offset = (settings['kaleidoscope-offset'] / 100) * Math.min(width, height) / 2;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            ctx.clearRect(0, 0, width, height);
            const centerX = width / 2 + offset;
            const centerY = height / 2 + offset;
            const angleStep = (2 * Math.PI) / segments;
            for (let i = 0; i < segments; i++) {
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(angleStep * i);
                if (i % 2 === 0) {
                    ctx.scale(1, 1);
                } else {
                    ctx.scale(-1, 1);
                }
                ctx.drawImage(tempCanvas, -centerX, -centerY);
                ctx.restore();
            }
            imageData = ctx.getImageData(0, 0, width, height);
            data = imageData.data;
        }
        if (settings['vortex-twist'] > 0) {
            const intensity = settings['vortex-twist'] / 100;
            const tempData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i++) tempData[i] = data[i];
            const centerX = width / 2;
            const centerY = height / 2;
            const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) + (distance / maxRadius) * intensity * Math.PI;
                    const newX = Math.round(centerX + distance * Math.cos(angle));
                    const newY = Math.round(centerY + distance * Math.sin(angle));
                    const srcIdx = (Math.min(height - 1, Math.max(0, newY)) * width + Math.min(width - 1, Math.max(0, newX))) * 4;
                    data[idx] = tempData[srcIdx];
                    data[idx + 1] = tempData[srcIdx + 1];
                    data[idx + 2] = tempData[srcIdx + 2];
                    data[idx + 3] = tempData[srcIdx + 3];
                }
            }
        }
        if (settings['edge-detect'] > 0) {
            const intensity = settings['edge-detect'] / 100;
            const tempData = new Uint8ClampedArray(data.length);
            for (let i = 0; i < data.length; i++) tempData[i] = data[i];
            const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
            const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    let gx = 0, gy = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const pixelIdx = ((y + dy) * width + (x + dx)) * 4;
                            const gray = (tempData[pixelIdx] + tempData[pixelIdx + 1] + tempData[pixelIdx + 2]) / 3;
                            gx += gray * sobelX[dy + 1][dx + 1];
                            gy += gray * sobelY[dy + 1][dx + 1];
                        }
                    }
                    const edge = Math.sqrt(gx * gx + gy * gy) * intensity;
                    const value = Math.min(255, Math.max(0, edge));
                    data[idx] = data[idx + 1] = data[idx + 2] = value;
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve();
    });
}

toggleOriginalButton.addEventListener('click', () => {
    isShowingOriginal = !isShowingOriginal;
    toggleOriginalButton.textContent = isShowingOriginal ? 'Ver Editada' : 'Ver Original';
    redrawImage(false);
});

function showCropModal(dataURL) {
    cropImage.src = dataURL;
    cropModal.style.display = 'block';
    cropImage.onload = () => {
        const maxCanvasWidth = window.innerWidth - 100;
        const maxCanvasHeight = window.innerHeight - 250;
        let width = cropImage.width;
        let height = cropImage.height;
        const ratio = width / height;
        if (width > maxCanvasWidth || height > maxCanvasHeight) {
            if (ratio > maxCanvasWidth / maxCanvasHeight) {
                width = maxCanvasWidth;
                height = width / ratio;
            } else {
                height = maxCanvasHeight;
                width = height * ratio;
            }
        }
        cropCanvas.width = width;
        cropCanvas.height = height;
        cropCtx.drawImage(cropImage, 0, 0, cropCanvas.width, cropCanvas.height);
        cropRect = {
            x: 0,
            y: 0,
            width: cropCanvas.width,
            height: cropCanvas.height
        };
        const cropControls = document.getElementById('crop-controls');
        cropControls.innerHTML = '';
        const rotationGroup = document.createElement('div');
        rotationGroup.className = 'crop-control-group';
        rotationGroup.innerHTML = `
            <label for="rotation">Rotación:</label>
            <input type="range" id="rotation" min="-180" max="180" value="0">
            <span id="rotation-value">0°</span>
        `;
        cropControls.appendChild(rotationGroup);
        const rotationInput = document.getElementById('rotation');
        const rotationValue = document.getElementById('rotation-value');
        rotationInput.addEventListener('input', (e) => {
            rotation = parseInt(e.target.value);
            rotationValue.textContent = `${rotation}°`;
            drawCropOverlay();
        });
        rotationValue.addEventListener('click', () => {
            const newValue = prompt('Ingrese el ángulo de rotación (-180 a 180):', rotation);
            if (newValue !== null) {
                const parsedValue = parseInt(newValue);
                if (!isNaN(parsedValue) && parsedValue >= -180 && parsedValue <= 180) {
                    rotation = parsedValue;
                    rotationInput.value = rotation;
                    rotationValue.textContent = `${rotation}°`;
                    drawCropOverlay();
                }
            }
        });
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'crop-button-group';
        buttonGroup.innerHTML = `
            <button id="crop-restore">Restaurar</button>
            <button id="crop-preview">Preview</button>
            <button id="crop-confirm">Confirmar</button>
            <button id="crop-skip">Omitir</button>
        `;
        cropControls.appendChild(buttonGroup);
        const restoreBtn = document.getElementById('crop-restore');
        const previewBtn = document.getElementById('crop-preview');
        const confirmBtn = document.getElementById('crop-confirm');
        const skipBtn = document.getElementById('crop-skip');
        restoreBtn.addEventListener('click', () => {
            rotation = 0;
            cropRect = { x: 0, y: 0, width: cropCanvas.width, height: cropCanvas.height };
            rotationInput.value = 0;
            rotationValue.textContent = '0°';
            drawCropOverlay();
        });
        previewBtn.addEventListener('click', () => {
            const originalWidth = cropImage.width;
            const originalHeight = cropImage.height;
            const displayWidth = cropCanvas.width;
            const displayHeight = cropCanvas.height;
            const displayScale = displayWidth / originalWidth;
            const angleRad = rotation * Math.PI / 180;
            const cosA = Math.abs(Math.cos(angleRad));
            const sinA = Math.abs(Math.sin(angleRad));
            const fullRotatedWidth = Math.ceil(originalWidth * cosA + originalHeight * sinA);
            const fullRotatedHeight = Math.ceil(originalWidth * sinA + originalHeight * cosA);
            const fullRotatedCanvas = document.createElement('canvas');
            fullRotatedCanvas.width = fullRotatedWidth;
            fullRotatedCanvas.height = fullRotatedHeight;
            const fullRotatedCtx = fullRotatedCanvas.getContext('2d');
            fullRotatedCtx.translate(fullRotatedWidth / 2, fullRotatedHeight / 2);
            fullRotatedCtx.rotate(angleRad);
            fullRotatedCtx.translate(-originalWidth / 2, -originalHeight / 2);
            fullRotatedCtx.drawImage(cropImage, 0, 0, originalWidth, originalHeight);
            fullRotatedCtx.setTransform(1, 0, 0, 1, 0, 0);
            const fitScale = Math.min(
                originalWidth / (originalWidth * cosA + originalHeight * sinA),
                originalHeight / (originalWidth * sinA + originalHeight * cosA)
            );
            const cropX = (cropRect.x - displayWidth / 2) / (fitScale * displayScale) + fullRotatedWidth / 2;
            const cropY = (cropRect.y - displayHeight / 2) / (fitScale * displayScale) + fullRotatedHeight / 2;
            const cropWidth = cropRect.width / (fitScale * displayScale);
            const cropHeight = cropRect.height / (fitScale * displayScale);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = cropWidth;
            tempCanvas.height = cropHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(
                fullRotatedCanvas,
                cropX, cropY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );
            const previewImage = document.getElementById('preview-image');
            previewImage.src = tempCanvas.toDataURL('image/png');
            previewModal.style.display = 'block';
        });
        confirmBtn.addEventListener('click', () => {
            const originalWidth = cropImage.width;
            const originalHeight = cropImage.height;
            const displayWidth = cropCanvas.width;
            const displayHeight = cropCanvas.height;
            const displayScale = displayWidth / originalWidth;
            const angleRad = rotation * Math.PI / 180;
            const cosA = Math.abs(Math.cos(angleRad));
            const sinA = Math.abs(Math.sin(angleRad));
            const fullRotatedWidth = Math.ceil(originalWidth * cosA + originalHeight * sinA);
            const fullRotatedHeight = Math.ceil(originalWidth * sinA + originalHeight * cosA);
            const fullRotatedCanvas = document.createElement('canvas');
            fullRotatedCanvas.width = fullRotatedWidth;
            fullRotatedCanvas.height = fullRotatedHeight;
            const fullRotatedCtx = fullRotatedCanvas.getContext('2d');
            fullRotatedCtx.translate(fullRotatedWidth / 2, fullRotatedHeight / 2);
            fullRotatedCtx.rotate(angleRad);
            fullRotatedCtx.translate(-originalWidth / 2, -originalHeight / 2);
            fullRotatedCtx.drawImage(cropImage, 0, 0, originalWidth, originalHeight);
            fullRotatedCtx.setTransform(1, 0, 0, 1, 0, 0);
            const fitScale = Math.min(
                originalWidth / (originalWidth * cosA + originalHeight * sinA),
                originalHeight / (originalWidth * sinA + originalHeight * cosA)
            );
            const cropX = (cropRect.x - displayWidth / 2) / (fitScale * displayScale) + fullRotatedWidth / 2;
            const cropY = (cropRect.y - displayHeight / 2) / (fitScale * displayScale) + fullRotatedHeight / 2;
            const cropWidth = cropRect.width / (fitScale * displayScale);
            const cropHeight = cropRect.height / (fitScale * displayScale);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = cropWidth;
            tempCanvas.height = cropHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(
                fullRotatedCanvas,
                cropX, cropY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );
            img.src = tempCanvas.toDataURL('image/png');
            closeModal(cropModal);
        });
        skipBtn.addEventListener('click', () => {
            img.src = cropImage.src;
            closeModal(cropModal);
            uploadNewPhotoButton.style.display = 'block';
        });
        const lockGroup = document.createElement('div');
        lockGroup.className = 'crop-lock-group';
        lockGroup.innerHTML = `
            <input type="checkbox" id="lock-aspect">
            <label for="lock-aspect">Bloquear proporción</label>
        `;
        cropControls.appendChild(lockGroup);
        const lockCheckbox = document.getElementById('lock-aspect');
        lockCheckbox.addEventListener('change', (e) => {
            lockAspectRatio = e.target.checked;
            aspectRatio = cropRect.width / cropRect.height;
        });
        drawCropOverlay();
    };
}

function drawCropOverlay() {
    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    const originalWidth = cropImage.width;
    const originalHeight = cropImage.height;
    const displayWidth = cropCanvas.width;
    const displayHeight = cropCanvas.height;
    const displayScale = displayWidth / originalWidth;
    const angleRad = rotation * Math.PI / 180;
    const cosA = Math.abs(Math.cos(angleRad));
    const sinA = Math.abs(Math.sin(angleRad));
    const fitScale = Math.min(
        originalWidth / (originalWidth * cosA + originalHeight * sinA),
        originalHeight / (originalWidth * sinA + originalHeight * cosA)
    );
    cropCtx.save();
    cropCtx.translate(displayWidth / 2, displayHeight / 2);
    cropCtx.rotate(angleRad);
    cropCtx.scale(fitScale * displayScale, fitScale * displayScale);
    cropCtx.translate(-originalWidth / 2, -originalHeight / 2);
    cropCtx.filter = 'blur(5px)';
    cropCtx.drawImage(cropImage, 0, 0, originalWidth, originalHeight);
    cropCtx.restore();
    cropCtx.save();
    cropCtx.beginPath();
    cropCtx.rect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    cropCtx.clip();
    cropCtx.translate(displayWidth / 2, displayHeight / 2);
    cropCtx.rotate(angleRad);
    cropCtx.scale(fitScale * displayScale, fitScale * displayScale);
    cropCtx.translate(-originalWidth / 2, -originalHeight / 2);
    cropCtx.drawImage(cropImage, 0, 0, originalWidth, originalHeight);
    cropCtx.restore();
    cropCtx.strokeStyle = '#00ff00';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
}

cropCanvas.addEventListener('mousedown', startCropDrag);
cropCanvas.addEventListener('mousemove', adjustCropDrag);
cropCanvas.addEventListener('mouseup', stopCropDrag);
cropCanvas.addEventListener('touchstart', startCropDrag);
cropCanvas.addEventListener('touchmove', adjustCropDrag);
cropCanvas.addEventListener('touchend', stopCropDrag);

cropCanvas.addEventListener('mousemove', (e) => {
    const rect = cropCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const resizeMargin = 20;
    if (nearCorner(x, y, cropRect.x, cropRect.y, resizeMargin)) {
        cropCanvas.style.cursor = 'nwse-resize';
    } else if (nearCorner(x, y, cropRect.x + cropRect.width, cropRect.y, resizeMargin)) {
        cropCanvas.style.cursor = 'nesw-resize';
    } else if (nearCorner(x, y, cropRect.x, cropRect.y + cropRect.height, resizeMargin)) {
        cropCanvas.style.cursor = 'nesw-resize';
    } else if (nearCorner(x, y, cropRect.x + cropRect.width, cropRect.y + cropRect.height, resizeMargin)) {
        cropCanvas.style.cursor = 'nwse-resize';
    } else if (nearSide(x, y, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 'left', resizeMargin)) {
        cropCanvas.style.cursor = 'ew-resize';
    } else if (nearSide(x, y, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 'right', resizeMargin)) {
        cropCanvas.style.cursor = 'ew-resize';
    } else if (nearSide(x, y, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 'top', resizeMargin)) {
        cropCanvas.style.cursor = 'ns-resize';
    } else if (nearSide(x, y, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 'bottom', resizeMargin)) {
        cropCanvas.style.cursor = 'ns-resize';
    } else if (insideCrop(x, y)) {
        cropCanvas.style.cursor = 'move';
    } else {
        cropCanvas.style.cursor = 'default';
    }
});

function nearSide(x, y, rectX, rectY, width, height, side, margin) {
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

function startCropDrag(e) {
    e.preventDefault();
    const rect = cropCanvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    const resizeMargin = 20;
    if (nearCorner(x, y, cropRect.x, cropRect.y, resizeMargin)) {
        isDragging = 'top-left';
    } else if (nearCorner(x, y, cropRect.x + cropRect.width, cropRect.y, resizeMargin)) {
        isDragging = 'top-right';
    } else if (nearCorner(x, y, cropRect.x, cropRect.y + cropRect.height, resizeMargin)) {
        isDragging = 'bottom-left';
    } else if (nearCorner(x, y, cropRect.x + cropRect.width, cropRect.y + cropRect.height, resizeMargin)) {
        isDragging = 'bottom-right';
    } else if (nearSide(x, y, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 'left', resizeMargin)) {
        isDragging = 'left';
    } else if (nearSide(x, y, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 'right', resizeMargin)) {
        isDragging = 'right';
    } else if (nearSide(x, y, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 'top', resizeMargin)) {
        isDragging = 'top';
    } else if (nearSide(x, y, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 'bottom', resizeMargin)) {
        isDragging = 'bottom';
    } else if (insideCrop(x, y)) {
        isDragging = 'move';
        startX = x - cropRect.x;
        startY = y - cropRect.y;
    }
    if (isDragging) drawCropOverlay();
}

function adjustCropDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const rect = cropCanvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    if (isDragging === 'move') {
        cropRect.x = clamp(x - startX, 0, cropCanvas.width - cropRect.width);
        cropRect.y = clamp(y - startY, 0, cropCanvas.height - cropRect.height);
    } else {
        resizeCrop(x, y);
    }
    drawCropOverlay();
}

function stopCropDrag() {
    isDragging = false;
}

function nearCorner(x, y, cornerX, cornerY, margin) {
    return Math.abs(x - cornerX) < margin && Math.abs(y - cornerY) < margin;
}

function insideCrop(x, y) {
    return x >= cropRect.x && x <= cropRect.x + cropRect.width &&
           y >= cropRect.y && y <= cropRect.y + cropRect.height;
}

function resizeCrop(x, y) {
    let newWidth, newHeight;
    if (isDragging === 'top-left') {
        newWidth = clamp(cropRect.x + cropRect.width - x, 10, cropCanvas.width - cropRect.x);
        newHeight = lockAspectRatio ? newWidth / aspectRatio : clamp(cropRect.y + cropRect.height - y, 10, cropCanvas.height - cropRect.y);
        cropRect.x = clamp(x, 0, cropRect.x + cropRect.width - 10);
        cropRect.y = lockAspectRatio ? cropRect.y + cropRect.height - newHeight : clamp(y, 0, cropRect.y + cropRect.height - 10);
        cropRect.width = newWidth;
        cropRect.height = newHeight;
    } else if (isDragging === 'top-right') {
        newWidth = clamp(x - cropRect.x, 10, cropCanvas.width - cropRect.x);
        newHeight = lockAspectRatio ? newWidth / aspectRatio : clamp(cropRect.y + cropRect.height - y, 10, cropCanvas.height - cropRect.y);
        cropRect.y = lockAspectRatio ? cropRect.y + cropRect.height - newHeight : clamp(y, 0, cropRect.y + cropRect.height - 10);
        cropRect.width = newWidth;
        cropRect.height = newHeight;
    } else if (isDragging === 'bottom-left') {
        newWidth = clamp(cropRect.x + cropRect.width - x, 10, cropCanvas.width - cropRect.x);
        newHeight = lockAspectRatio ? newWidth / aspectRatio : clamp(y - cropRect.y, 10, cropCanvas.height - cropRect.y);
        cropRect.x = clamp(x, 0, cropRect.x + cropRect.width - 10);
        cropRect.width = newWidth;
        cropRect.height = newHeight;
    } else if (isDragging === 'bottom-right') {
        newWidth = clamp(x - cropRect.x, 10, cropCanvas.width - cropRect.x);
        newHeight = lockAspectRatio ? newWidth / aspectRatio : clamp(y - cropRect.y, 10, cropCanvas.height - cropRect.y);
        cropRect.width = newWidth;
        cropRect.height = newHeight;
    } else if (isDragging === 'left') {
        newWidth = clamp(cropRect.x + cropRect.width - x, 10, cropCanvas.width - cropRect.x);
        newHeight = lockAspectRatio ? newWidth / aspectRatio : cropRect.height;
        cropRect.x = clamp(x, 0, cropRect.x + cropRect.width - 10);
        cropRect.width = newWidth;
        if (lockAspectRatio) cropRect.height = newHeight;
    } else if (isDragging === 'right') {
        newWidth = clamp(x - cropRect.x, 10, cropCanvas.width - cropRect.x);
        newHeight = lockAspectRatio ? newWidth / aspectRatio : cropRect.height;
        cropRect.width = newWidth;
        if (lockAspectRatio) cropRect.height = newHeight;
    } else if (isDragging === 'top') {
        newHeight = clamp(cropRect.y + cropRect.height - y, 10, cropCanvas.height - cropRect.y);
        newWidth = lockAspectRatio ? newHeight * aspectRatio : cropRect.width;
        cropRect.y = clamp(y, 0, cropRect.y + cropRect.height - 10);
        cropRect.height = newHeight;
        if (lockAspectRatio) cropRect.width = newWidth;
    } else if (isDragging === 'bottom') {
        newHeight = clamp(y - cropRect.y, 10, cropCanvas.height - cropRect.y);
        newWidth = lockAspectRatio ? newHeight * aspectRatio : cropRect.width;
        cropRect.height = newHeight;
        if (lockAspectRatio) cropRect.width = newWidth;
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

canvas.addEventListener('click', () => {
    try {
        const controlsContainer = document.querySelector('.controls');
        const modalControls = document.getElementById('modal-controls');
        if (!controlsContainer || !modalControls) {
            console.error("Controls or modal-controls not found in DOM");
            return;
        }
        const clonedControls = controlsContainer.cloneNode(true);
        modalControls.innerHTML = '';
        modalControls.appendChild(clonedControls);
        modalImage.src = canvas.toDataURL('image/png');
        const modalInputs = modalControls.querySelectorAll('input[type="range"]');
        modalInputs.forEach(input => {
            input.addEventListener('input', debounce((e) => {
                const id = e.target.id;
                settings[id] = parseInt(e.target.value);
                updateControlIndicators();
                redrawImage(true);
            }, 300));
        });
        modal.style.display = 'block';
    } catch (error) {
        console.error("Error opening modal:", error);
    }
});

img.onload = function () {
    originalWidth = img.width;
    originalHeight = img.height;
    fullResCanvas.width = originalWidth;
    fullResCanvas.height = originalHeight;
    fullResCtx.drawImage(img, 0, 0, originalWidth, originalHeight);
    const maxDisplayWidth = Math.min(1920, window.innerWidth - 100);
    const maxDisplayHeight = Math.min(1080, window.innerHeight - 250);
    const minPreviewDimension = 800;
    const ratio = originalWidth / originalHeight;
    if (ratio > 1) {
        previewWidth = Math.min(originalWidth, maxDisplayWidth);
        previewHeight = previewWidth / ratio;
        if (previewHeight > maxDisplayHeight) {
            previewHeight = maxDisplayHeight;
            previewWidth = previewHeight * ratio;
        }
        if (previewHeight < minPreviewDimension) {
            previewHeight = minPreviewDimension;
            previewWidth = previewHeight * ratio;
        }
    } else {
        previewHeight = Math.min(originalHeight, maxDisplayHeight);
        previewWidth = previewHeight * ratio;
        if (previewWidth > maxDisplayWidth) {
            previewWidth = maxDisplayWidth;
            previewHeight = previewWidth / ratio;
        }
        if (previewWidth < minPreviewDimension) {
            previewWidth = minPreviewDimension;
            previewHeight = previewWidth / ratio;
        }
    }
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    fullResCtx.drawImage(img, 0, 0, originalWidth, originalHeight);
    const initialImageData = fullResCtx.getImageData(0, 0, originalWidth, originalHeight);
    fullResCtx.putImageData(initialImageData, 0, 0);
    ctx.drawImage(fullResCanvas, 0, 0, previewWidth, previewHeight);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = previewWidth;
    tempCanvas.height = previewHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, previewWidth, previewHeight);
    originalImageData = tempCtx.getImageData(0, 0, previewWidth, previewHeight);
    redrawImage(true);
    uploadNewPhotoButton.style.display = 'block';
};

let filterWorker;
if (window.Worker) {
    filterWorker = new Worker(URL.createObjectURL(new Blob([`
        self.onmessage = function(e) {
            const { imageData, noiseSeed, scaleFactor, settings } = e.data;
            const data = imageData.data;
            const vibrance = (settings.vibrance - 100) / 100;
            const highlights = settings.highlights / 100;
            const shadows = settings.shadows / 100;
            const noise = settings.noise;
            for (let i = 0; i < data.length; i += 4) {
                if (settings.temperature > 100) {
                    data[i] *= (settings.temperature / 100);
                    data[i + 2] *= (200 - settings.temperature) / 100;
                } else {
                    data[i] *= settings.temperature / 100;
                    data[i + 2] *= (200 - settings.temperature) / 100;
                }
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                let avg = (r + g + b) / 3;
                data[i] += (r - avg) * vibrance;
                data[i + 1] += (g - avg) * vibrance;
                data[i + 2] += (b - avg) * vibrance;
                if (r > 128) data[i] *= highlights;
                else data[i] *= shadows;
                if (g > 128) data[i + 1] *= highlights;
                else data[i + 1] *= shadows;
                if (b > 128) data[i + 2] *= highlights;
                else data[i + 2] *= shadows;
                let randomValue = Math.sin(noiseSeed + i * 12.9898) * 43758.5453;
                randomValue = randomValue - Math.floor(randomValue);
                let noiseAmount = (randomValue - 0.5) * noise * scaleFactor;
                data[i] = Math.max(0, Math.min(255, data[i] + noiseAmount));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noiseAmount));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noiseAmount));
            }
            self.postMessage({ imageData });
        };
    `], { type: 'application/javascript' })));
}

function applyAdvancedFilters(ctx, canvas, noiseSeed, scaleFactor) {
    return new Promise((resolve) => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (filterWorker) {
            filterWorker.onmessage = (e) => {
                ctx.putImageData(e.data.imageData, 0, 0);
                resolve();
            };
            filterWorker.onerror = (err) => {
                console.error("Worker error:", err);
                resolve();
            };
            filterWorker.postMessage({ imageData, noiseSeed, scaleFactor, settings });
        } else {
            const data = imageData.data;
            const vibrance = (settings.vibrance - 100) / 100;
            const highlights = settings.highlights / 100;
            const shadows = settings.shadows / 100;
            const noise = settings.noise;
            for (let i = 0; i < data.length; i += 4) {
                if (settings.temperature > 100) {
                    data[i] *= (settings.temperature / 100);
                    data[i + 2] *= (200 - settings.temperature) / 100;
                } else {
                    data[i] *= settings.temperature / 100;
                    data[i + 2] *= (200 - settings.temperature) / 100;
                }
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                let avg = (r + g + b) / 3;
                data[i] += (r - avg) * vibrance;
                data[i + 1] += (g - avg) * vibrance;
                data[i + 2] += (b - avg) * vibrance;
                if (r > 128) data[i] *= highlights;
                else data[i] *= shadows;
                if (g > 128) data[i + 1] *= highlights;
                else data[i + 1] *= shadows;
                if (b > 128) data[i + 2] *= highlights;
                else data[i + 2] *= shadows;
                let randomValue = Math.sin(noiseSeed + i * 12.9898) * 43758.5453;
                randomValue = randomValue - Math.floor(randomValue);
                let noiseAmount = (randomValue - 0.5) * noise * scaleFactor;
                data[i] = Math.max(0, Math.min(255, data[i] + noiseAmount));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noiseAmount));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noiseAmount));
            }
            ctx.putImageData(imageData, 0, 0);
            resolve();
        }
    });
}

downloadButton.addEventListener('click', () => {
    console.log("Download button clicked");

    // Check if any edits have been applied
    const isEdited = Object.values(settings).some(value => value !== 100 && value !== 0);

    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.backgroundColor = '#fff';
    popup.style.padding = '20px';
    popup.style.border = '1px solid #ccc';
    popup.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    popup.style.zIndex = '1002';
    popup.style.width = '350px';
    popup.innerHTML = `
        <h3>Guardar Imagen</h3>
        <label>Nombre del archivo:</label><br>
        <input type="text" id="save-file-name" value="nueva-imagen" style="width: 100%; margin-bottom: 10px; padding: 5px; box-sizing: border-box;"><br>
        <label>Formato:</label><br>
        <select id="save-file-type" style="width: 100%; margin-bottom: 10px; padding: 5px;">
            <option value="image/png" selected>PNG</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
        </select><br>
        <label>Calidad de resolución:</label><br>
        <select id="save-resolution-scale" style="width: 100%; margin-bottom: 10px; padding: 5px;">
            <option value="10">Lowest (10%)</option>
            <option value="20">Very Low (20%)</option>
            <option value="40">Low (40%)</option>
            <option value="60">Medium (60%)</option>
            <option value="80">High (80%)</option>
            <option value="100" selected>Full (100%)</option>
        </select><br>
        <div id="file-info" style="margin-bottom: 15px;">
            <p>Dimensiones: <span id="dimensions"></span> px</p>
            <p>Tamaño estimado: <span id="file-size"></span> KB</p>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 10px;">
            <button id="save-confirm" style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; cursor: pointer; flex: 1;">Guardar</button>
            <button id="save-cancel" style="background-color: #f44336; color: white; padding: 10px 20px; border: none; cursor: pointer; flex: 1;">Cancelar</button>
        </div>
    `;
    document.body.appendChild(popup);
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '1001';
    document.body.appendChild(overlay);

    const resolutionSelect = document.getElementById('save-resolution-scale');
    const fileTypeSelect = document.getElementById('save-file-type');
    const dimensionsSpan = document.getElementById('dimensions');
    const fileSizeSpan = document.getElementById('file-size');

    // Store the original image data URL for unedited downloads
    const originalDataURL = img.src;

    function updateFileInfo() {
        const scale = parseFloat(resolutionSelect.value) / 100;
        const width = Math.round(originalWidth * scale);
        const height = Math.round(originalHeight * scale);
        dimensionsSpan.textContent = `${width} x ${height}`;
        console.log(`Updating file info: ${width}x${height}`);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        tempCtx.drawImage(fullResCanvas, 0, 0, width, height);

        const fileType = fileTypeSelect.value;
        const quality = fileType === 'image/png' ? undefined : 1.0; // PNG doesn't use quality; JPEG/WebP atClicked max quality
        tempCanvas.toBlob((blob) => {
            if (blob) {
                const sizeKB = Math.round(blob.size / 1024);
                fileSizeSpan.textContent = `${sizeKB}`;
                console.log(`Estimated file size: ${sizeKB} KB`);
            } else {
                fileSizeSpan.textContent = 'Calculando...';
                console.log("Blob creation failed");
            }
        }, fileType, quality);
    }

    updateFileInfo();
    resolutionSelect.addEventListener('change', updateFileInfo);
    fileTypeSelect.addEventListener('change', updateFileInfo);

    document.getElementById('save-confirm').addEventListener('click', () => {
        console.log("Save confirm clicked");
        const fileName = document.getElementById('save-file-name').value.trim() || 'nueva-imagen';
        const fileType = fileTypeSelect.value;
        const scale = parseFloat(resolutionSelect.value) / 100;
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9-_]/g, '');
        const extension = fileType.split('/')[1];

        showLoadingIndicator(true);

        if (!isEdited && scale === 1.0) {
            // If no edits and full resolution, download the original file directly
            console.log("Downloading original unedited image");
            const link = document.createElement('a');
            link.download = `${sanitizedFileName}.${extension}`;
            link.href = originalDataURL;
            link.click();
            showLoadingIndicator(false);
            document.body.removeChild(popup);
            document.body.removeChild(overlay);
            return;
        }

        // Process the image through the canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.round(originalWidth * scale);
        tempCanvas.height = Math.round(originalHeight * scale);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';

        redrawImage(false).then(() => {
            console.log("Image redrawn for download");
            tempCtx.drawImage(fullResCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

            const quality = fileType === 'image/png' ? undefined : 1.0; // Max quality for JPEG/WebP
            tempCanvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.download = `${sanitizedFileName}-${Math.round(scale * 100)}%.${extension}`;
                link.href = URL.createObjectURL(blob);
                console.log(`Download link: ${link.download}`);
                link.click();
                URL.revokeObjectURL(link.href); // Clean up
                showLoadingIndicator(false);
                document.body.removeChild(popup);
                document.body.removeChild(overlay);
            }, fileType, quality);
        }).catch(error => {
            console.error('Error rendering image for download:', error);
            alert('Hubo un error al preparar la imagen para descargar.');
            showLoadingIndicator(false);
            document.body.removeChild(popup);
            document.body.removeChild(overlay);
        });
    });

    document.getElementById('save-cancel').addEventListener('click', () => {
        console.log("Save cancel clicked");
        document.body.removeChild(popup);
        document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', () => {
        console.log("Overlay clicked to close");
        document.body.removeChild(popup);
        document.body.removeChild(overlay);
    });
});

let isRedrawing = false;

function saveImageState(isOriginal = false) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (isOriginal) {
        history = [{ filters: { ...settings }, imageData }];
        redoHistory = [];
        lastAppliedEffect = null;
    } else {
        const lastState = history[history.length - 1];
        if (JSON.stringify(lastState.filters) !== JSON.stringify(settings)) {
            history.push({ filters: { ...settings }, imageData });
            if (history.length > 50) history.shift();
            redoHistory = [];
        }
    }
}

function handleUndo(e) {
    e.preventDefault();
    if (history.length > 1) {
        const currentState = history.pop();
        redoHistory.push(currentState);
        const previousState = history[history.length - 1];
        Object.assign(settings, previousState.filters);
        document.querySelectorAll('.controls input').forEach(input => {
            input.value = settings[input.id];
        });
        updateControlIndicators();
        redrawImage(false);
        console.log('Undo triggered');
    } else {
        console.log("No more states to undo.");
    }
}

function handleRedo(e) {
    e.preventDefault();
    if (redoHistory.length > 0) {
        const nextState = redoHistory.pop();
        history.push(nextState);
        Object.assign(settings, nextState.filters);
        document.querySelectorAll('.controls input').forEach(input => {
            input.value = settings[input.id];
        });
        updateControlIndicators();
        redrawImage(false);
        console.log('Redo triggered');
    }
}

const debouncedUndo = debounce(handleUndo, 200);
const debouncedRedo = debounce(handleRedo, 200);

function addButtonListeners(button, handler) {
    button.setAttribute('role', 'button');
    button.addEventListener('click', handler);
    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler(e);
    });
    button.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler(e);
    });
    button.addEventListener('touchmove', (e) => e.preventDefault());
}

addButtonListeners(undoButton, debouncedUndo);
addButtonListeners(redoButton, debouncedRedo);

restoreButton.addEventListener('click', () => {
    settings = { 
        brightness: 100, 
        contrast: 100, 
        grayscale: 0, 
        vibrance: 100, 
        highlights: 100, 
        shadows: 100, 
        noise: 0, 
        exposure: 100, 
        temperature: 100, 
        saturation: 100,
        'glitch-scanline': 0,
        'glitch-chromatic': 0,
        'glitch-rgb-split': 0,
        'glitch-invert': 0,
        'glitch-vhs': 0,
        'glitch-chromatic-vertical': 0,
        'glitch-chromatic-diagonal': 0,
        'glitch-pixel-shuffle': 0,
        'glitch-wave': 0,
        'pixel-grain': 0,
        'pixel-dither': 0,
        'kaleidoscope-segments': 0,
        'kaleidoscope-offset': 0,
        'vortex-twist': 0,
        'edge-detect': 0
    };
    document.querySelectorAll('.controls input').forEach(input => {
        input.value = settings[input.id];
    });
    updateControlIndicators();
    ctx.putImageData(originalImageData, 0, 0);
    saveImageState(true);
    redrawImage(false);
});

let isDraggingSlider = false;
let tempSettings = {};

controls.forEach(control => {
    control.addEventListener('mousedown', () => {
        isDraggingSlider = true;
        tempSettings = { ...settings };
    });
    control.addEventListener('touchstart', () => {
        isDraggingSlider = true;
        tempSettings = { ...settings };
    });
    control.addEventListener('input', (e) => {
        const id = e.target.id;
        const newValue = parseInt(e.target.value);
        if (isDraggingSlider) {
            tempSettings[id] = newValue;
        } else {
            if (settings[id] !== newValue) {
                settings[id] = newValue;
                updateControlIndicators();
                if (id.startsWith('glitch-') || id.startsWith('pixel-') || id.startsWith('kaleidoscope-') || id === 'vortex-twist' || id === 'edge-detect') {
                    lastAppliedEffect = id;
                }
                saveImageState();
            }
        }
        updateControlIndicators();
    });
    control.addEventListener('mouseup', () => {
        if (isDraggingSlider) {
            isDraggingSlider = false;
            const id = control.id;
            if (settings[id] !== tempSettings[id]) {
                settings[id] = tempSettings[id];
                updateControlIndicators();
                if (id.startsWith('glitch-') || id.startsWith('pixel-') || id.startsWith('kaleidoscope-') || id === 'vortex-twist' || id === 'edge-detect') {
                    lastAppliedEffect = id;
                }
                redrawImage(true);
            }
        }
    });
    control.addEventListener('touchend', () => {
        if (isDraggingSlider) {
            isDraggingSlider = false;
            const id = control.id;
            if (settings[id] !== tempSettings[id]) {
                settings[id] = tempSettings[id];
                updateControlIndicators();
                if (id.startsWith('glitch-') || id.startsWith('pixel-') || id.startsWith('kaleidoscope-') || id === 'vortex-twist' || id === 'edge-detect') {
                    lastAppliedEffect = id;
                }
                redrawImage(true);
            }
        }
    });
    control.addEventListener('change', (e) => {
        if (!isDraggingSlider) {
            const id = e.target.id;
            const newValue = parseInt(e.target.value);
            if (settings[id] !== newValue) {
                settings[id] = newValue;
                updateControlIndicators();
                if (id.startsWith('glitch-') || id.startsWith('pixel-') || id.startsWith('kaleidoscope-') || id === 'vortex-twist' || id === 'edge-detect') {
                    lastAppliedEffect = id;
                }
                redrawImage(true);
            }
        }
    });
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            debouncedUndo(e);
        } else if (e.ctrlKey && e.key === 'y') {
            debouncedRedo(e);
        }
    });
    
    function initialize() {
        updateControlIndicators();
        const defaultImage = 'path/to/default/image.jpg';
        img.src = defaultImage;
    }
    
    initialize();