import { ImageProcessor } from './imageProcessor.js';
import { UI } from './ui.js';
import { State } from './state.js';
import { CropRotate } from './cropRotate.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

    if (!gl) {
        alert('WebGL is not supported in your browser.');
        return;
    }

    const state = new State(canvas);
    const imageProcessor = new ImageProcessor(gl, state);
    const ui = new UI(state, imageProcessor, canvas);

    // Crop Modal Setup
    const cropModal = document.getElementById('crop-modal');
    const cropCanvas = document.getElementById('crop-canvas');
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.imageSmoothingEnabled = true;

    // Create a hidden WebGL canvas for effects preview (offscreen, not added to DOM)
    const effectsCanvas = document.createElement('canvas');
    const effectsGl = effectsCanvas.getContext('webgl', { preserveDrawingBuffer: true });
    const effectsProcessor = new ImageProcessor(effectsGl, state);

    const cropRotate = new CropRotate(state, imageProcessor, cropModal, cropCanvas, cropCtx, effectsCanvas, effectsProcessor, canvas, resizeCanvasDisplay);

    function resizeCanvasDisplay() {
        if (!state.image) return;

        const img = state.image;
        const aspectRatio = img.width / img.height;
        const container = document.querySelector('.image-container');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let displayWidth, displayHeight;
        if (aspectRatio > containerAspectRatio) {
            displayWidth = Math.min(containerWidth, img.width);
            displayHeight = displayWidth / aspectRatio;
        } else {
            displayHeight = Math.min(containerHeight, img.height);
            displayWidth = displayHeight * aspectRatio;
        }

        if (displayWidth > containerWidth) {
            displayWidth = containerWidth;
            displayHeight = displayWidth / aspectRatio;
        }
        if (displayHeight > containerHeight) {
            displayHeight = containerHeight;
            displayWidth = displayHeight * aspectRatio;
        }

        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        canvas.style.maxWidth = '95%';
        canvas.style.maxHeight = 'auto';
        canvas.style.objectFit = 'contain';

        canvas.classList.remove('resizing');
        imageProcessor.render();
    }

    const imageLoader = document.getElementById('image-loader');
    imageLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    canvas.removeAttribute('width');
                    canvas.removeAttribute('height');
                    canvas.removeAttribute('style');

                    canvas.width = img.width;
                    canvas.height = img.height;

                    state.resetForNewImage(img);
                    state.cropSettings = { x: 0, y: 0, width: img.width, height: img.height, rotation: 0 };
                    imageProcessor.setImage(img);
                    resizeCanvasDisplay();
                    ui.resetSliders();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('crop').addEventListener('click', () => {
        if (!state.originalImage) return;
        cropRotate.showCropModal();
    });

    const container = document.querySelector('.image-container');
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
        if (!state.image) return;

        canvas.classList.add('resizing');
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            resizeCanvasDisplay();
        }, 100);
    });

    resizeObserver.observe(container);

    let isResizing = false;
    window.addEventListener('mousedown', (e) => {
        if (e.target === document.body || e.target === window) {
            isResizing = true;
            canvas.classList.add('resizing');
        }
    });

    window.addEventListener('mouseup', () => {
        if (isResizing && state.image) {
            resizeCanvasDisplay();
            isResizing = false;
        }
    });

    // Listen for custom resize event from cropRotate.js
    canvas.addEventListener('resize', () => {
        resizeCanvasDisplay();
    });
});