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
const closeBtn = document.querySelector('.close-btn');
const cropModal = document.getElementById('crop-modal');
const cropCanvas = document.getElementById('crop-canvas');
const cropCtx = cropCanvas.getContext('2d');
const cropCloseBtn = document.querySelector('.crop-close-btn');

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
    'glitch-wave': 0
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

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function triggerFileUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => showCropModal(event.target.result);
        reader.readAsDataURL(file);
    });
    fileInput.click();
}

uploadNewPhotoButton.addEventListener('click', triggerFileUpload);

function updateControlIndicators() {
    const controlValues = [
        'brightness', 'contrast', 'grayscale', 'vibrance', 'highlights', 'shadows', 
        'noise', 'exposure', 'temperature', 'saturation',
        'glitch-scanline', 'glitch-chromatic', 'glitch-rgb-split', 'glitch-invert',
        'glitch-vhs', 'glitch-chromatic-vertical', 'glitch-chromatic-diagonal',
        'glitch-pixel-shuffle', 'glitch-wave'
    ];
    controlValues.forEach(id => {
        const indicator = document.getElementById(`${id}-value`);
        if (indicator) indicator.textContent = `${settings[id]}%`;
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

function redrawImage() {
    showLoadingIndicator(true);

    // Set up full-res canvas
    fullResCanvas.width = originalWidth;
    fullResCanvas.height = originalHeight;
    fullResCtx.clearRect(0, 0, fullResCanvas.width, fullResCanvas.height);

    // Apply basic filters to full-res canvas
    fullResCtx.filter = `brightness(${settings.brightness * (settings.exposure / 100)}%)
                         contrast(${settings.contrast}%)
                         grayscale(${settings.grayscale}%)
                         saturate(${settings.saturation}%)
                         sepia(${(settings.temperature - 100) / 100}%)`;
    fullResCtx.drawImage(img, 0, 0, originalWidth, originalHeight);

    // Apply advanced filters and glitches at full resolution
    const scaleFactor = 1; // Full resolution
    return applyAdvancedFilters(fullResCtx, fullResCanvas, noiseSeed, scaleFactor)
        .then(() => applyGlitchEffects(fullResCtx, fullResCanvas, noiseSeed, scaleFactor))
        .then(() => {
            // Update preview canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (isShowingOriginal && originalImageData) {
                ctx.putImageData(originalImageData, 0, 0);
            } else {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(fullResCanvas, 0, 0, canvas.width, canvas.height);
            }

            // Update modal if open
            if (modal.style.display === 'block') {
                modalImage.src = canvas.toDataURL('image/png');
            }

            saveImageState();
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

toggleOriginalButton.addEventListener('click', () => {
    isShowingOriginal = !isShowingOriginal;
    toggleOriginalButton.textContent = isShowingOriginal ? 'Ver Editada' : 'Ver Original';
    redrawImage();
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
            <button id="crop-select-all">Seleccionar todo</button>
            <button id="crop-confirm">Confirmar</button>
            <button id="crop-skip">Omitir</button>
        `;
        cropControls.appendChild(buttonGroup);

        const selectAllBtn = document.getElementById('crop-select-all');
        const confirmBtn = document.getElementById('crop-confirm');
        const skipBtn = document.getElementById('crop-skip');

        selectAllBtn.addEventListener('click', () => {
            cropRect = { x: 0, y: 0, width: cropCanvas.width, height: cropCanvas.height };
            drawCropOverlay();
        });

        confirmBtn.addEventListener('click', () => {
            const tempCanvas = document.createElement('canvas');
            const scaleX = cropImage.width / cropCanvas.width;
            const scaleY = cropImage.height / cropCanvas.height;
            tempCanvas.width = Math.round(cropRect.width * scaleX);
            tempCanvas.height = Math.round(cropRect.height * scaleY);
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.save();
            tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
            tempCtx.rotate(rotation * Math.PI / 180);
            tempCtx.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);
            tempCtx.drawImage(
                cropImage,
                cropRect.x * scaleX, cropRect.y * scaleY, cropRect.width * scaleX, cropRect.height * scaleY,
                0, 0, tempCanvas.width, tempCanvas.height
            );
            tempCtx.restore();

            img.src = tempCanvas.toDataURL('image/png');
            closeCropModal();
            uploadNewPhotoButton.style.display = 'block';
        });

        skipBtn.addEventListener('click', () => {
            img.src = cropImage.src;
            closeCropModal();
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
    cropCtx.save();
    cropCtx.translate(cropCanvas.width / 2, cropCanvas.height / 2);
    cropCtx.rotate(rotation * Math.PI / 180);
    cropCtx.translate(-cropCanvas.width / 2, -cropCanvas.height / 2);
    cropCtx.drawImage(cropImage, 0, 0, cropCanvas.width, cropCanvas.height);

    cropCtx.filter = 'blur(5px)';
    cropCtx.drawImage(cropImage, 0, 0, cropCanvas.width, cropCanvas.height);
    cropCtx.filter = 'none';

    cropCtx.beginPath();
    cropCtx.rect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    cropCtx.clip();
    cropCtx.drawImage(cropImage, 0, 0, cropCanvas.width, cropCanvas.height);
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
    } else if (insideCrop(x, y)) {
        cropCanvas.style.cursor = 'move';
    } else {
        cropCanvas.style.cursor = 'default';
    }
});

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
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function closeCropModal() {
    cropModal.style.display = 'none';
    isDragging = false;
    rotation = 0;
    cropCanvas.style.cursor = 'default';
    uploadNewPhotoButton.style.display = 'block';
}

cropCloseBtn.addEventListener('click', closeCropModal);
window.addEventListener('click', (e) => {
    if (e.target === cropModal) closeCropModal();
});

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
                redrawImage();
            }, 300));
        });

        modal.style.display = 'block';
    } catch (error) {
        console.error("Error opening modal:", error);
    }
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.getElementById('modal-controls').innerHTML = '';
});

window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
        document.getElementById('modal-controls').innerHTML = '';
    }
});

img.onload = function () {
    originalWidth = img.width;
    originalHeight = img.height;

    // Set fullResCanvas to original dimensions
    fullResCanvas.width = originalWidth;
    fullResCanvas.height = originalHeight;

    // Calculate preview dimensions
    const maxDisplayWidth = Math.min(1920, window.innerWidth - 100);
    const maxDisplayHeight = Math.min(1080, window.innerHeight - 250);
    const ratio = originalWidth / originalHeight;

    if (ratio > 1) {
        previewWidth = Math.min(originalWidth, maxDisplayWidth);
        previewHeight = previewWidth / ratio;
        if (previewHeight > maxDisplayHeight) {
            previewHeight = maxDisplayHeight;
            previewWidth = previewHeight * ratio;
        }
    } else {
        previewHeight = Math.min(originalHeight, maxDisplayHeight);
        previewWidth = previewHeight * ratio;
        if (previewWidth > maxDisplayWidth) {
            previewWidth = maxDisplayWidth;
            previewHeight = previewWidth / ratio;
        }
    }

    canvas.width = previewWidth;
    canvas.height = previewHeight;

    // Store original image data for toggle
    fullResCtx.drawImage(img, 0, 0, originalWidth, originalHeight);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = previewWidth;
    tempCanvas.height = previewHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, previewWidth, previewHeight);
    originalImageData = tempCtx.getImageData(0, 0, previewWidth, previewHeight);

    saveImageState(true);
    redrawImage();
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
    popup.style.width = '300px';
    popup.innerHTML = `
        <h3>Guardar Imagen</h3>
        <label>Nombre del archivo:</label><br>
        <input type="text" id="save-file-name" value="nueva imagen" style="width: 100%; margin-bottom: 10px; padding: 5px; box-sizing: border-box;"><br>
        <label>Formato:</label><br>
        <select id="save-file-type" style="width: 100%; margin-bottom: 10px; padding: 5px;">
            <option value="image/png" selected>PNG</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
        </select><br>
        <label>Escala de resolución (%):</label><br>
        <input type="number" id="save-resolution-scale" value="100" min="25" max="400" style="width: 100%; margin-bottom: 15px; padding: 5px; box-sizing: border-box;"><br>
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

    document.getElementById('save-confirm').addEventListener('click', () => {
        const fileName = document.getElementById('save-file-name').value.trim() || 'nueva imagen';
        const fileType = document.getElementById('save-file-type').value;
        const scale = parseFloat(document.getElementById('save-resolution-scale').value) / 100;

        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9-_]/g, '');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalWidth * scale;
        tempCanvas.height = originalHeight * scale;
        const tempCtx = tempCanvas.getContext('2d');

        if (originalWidth * scale > 8192 || originalHeight * scale > 8192) {
            const maxDimension = Math.max(originalWidth * scale, originalHeight * scale);
            const scaleDown = 8192 / maxDimension;
            tempCanvas.width = originalWidth * scale * scaleDown;
            tempCanvas.height = originalHeight * scale * scaleDown;
        }
        tempCtx.drawImage(fullResCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

        const link = document.createElement('a');
        let extension = fileType.split('/')[1];
        link.download = `${sanitizedFileName}-${Math.round(scale * 100)}%.${extension}`;
        link.href = tempCanvas.toDataURL(fileType === 'image/png' ? 'image/png' : fileType, 1.0);
        link.click();

        document.body.removeChild(popup);
        document.body.removeChild(overlay);
    });

    document.getElementById('save-cancel').addEventListener('click', () => {
        document.body.removeChild(popup);
        document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', () => {
        document.body.removeChild(popup);
        document.body.removeChild(overlay);
    });
});

function saveImageState(isOriginal = false) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (isOriginal) {
        history = [{ filters: { ...settings }, imageData }];
        redoHistory = [];
        lastAppliedEffect = null;
    } else {
        history.push({ filters: { ...settings }, imageData });
        redoHistory = [];
        if (history.length > 50) history.shift();
    }
}

undoButton.addEventListener('click', () => {
    if (history.length > 1) {
        const currentState = history.pop();
        redoHistory.push(currentState);
        const previousState = history[history.length - 1];

        ctx.putImageData(previousState.imageData, 0, 0);
        Object.assign(settings, previousState.filters);
        document.querySelectorAll('.controls input').forEach(input => {
            input.value = settings[input.id];
        });
        updateControlIndicators();
        redrawImage();
    }
});

redoButton.addEventListener('click', () => {
    if (redoHistory.length > 0) {
        const nextState = redoHistory.pop();
        history.push(nextState);

        ctx.putImageData(nextState.imageData, 0, 0);
        Object.assign(settings, nextState.filters);
        document.querySelectorAll('.controls input').forEach(input => {
            input.value = settings[input.id];
        });
        updateControlIndicators();
        redrawImage();
    }
});

restoreButton.addEventListener('click', () => {
    ctx.putImageData(originalImageData, 0, 0);
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
        'glitch-wave': 0
    };
    document.querySelectorAll('.controls input').forEach(input => {
        input.value = settings[input.id];
    });
    updateControlIndicators();
    saveImageState(true);
    redrawImage();
});

controls.forEach(control => {
    control.addEventListener('input', (e) => {
        const id = e.target.id;
        settings[id] = parseInt(e.target.value);
        updateControlIndicators();
        if (id.startsWith('glitch-')) {
            lastAppliedEffect = id;
        }
    });

    control.addEventListener('input', debounce(() => {
        redrawImage();
    }, 300));
});
