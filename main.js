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

    const cropModal = document.getElementById('crop-modal');
    const cropCanvas = document.getElementById('crop-canvas');
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.imageSmoothingEnabled = true;

    const effectsCanvas = document.createElement('canvas');
    const effectsGl = effectsCanvas.getContext('webgl', { preserveDrawingBuffer: true });
    const effectsProcessor = new ImageProcessor(effectsGl, state);

    const cropRotate = new CropRotate(state, imageProcessor, cropModal, cropCanvas, cropCtx, effectsCanvas, effectsProcessor, canvas, resizeCanvasDisplay);

    const magnifierCanvas = document.getElementById('magnifier');
    const magnifierCtx = magnifierCanvas.getContext('2d');
    const magnifierSize = 200;
    magnifierCanvas.width = magnifierSize;
    magnifierCanvas.height = magnifierSize;
    let isZoomEnabled = false;
    let zoomLevel = 2;

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
        canvas.style.maxHeight = '600px';
        canvas.style.minHeight = '600px';
        canvas.style.objectFit = 'contain';
        canvas.style.margin = '0 auto';
        canvas.style.display = 'block';
        canvas.style.position = 'relative';
        canvas.style.top = '0';

        canvas.classList.remove('resizing');
        imageProcessor.render();
    }

    const imageLoader = document.getElementById('image-loader');
    const uploadBtn = document.getElementById('upload-btn');
    const bgImageLoader = document.getElementById('bg-image-loader');
    const bgUploadBtn = document.getElementById('bg-upload-btn');

    uploadBtn.addEventListener('click', () => {
        imageLoader.click();
    });

    bgUploadBtn.addEventListener('click', () => {
        bgImageLoader.click();
    });

    imageLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    canvas.removeAttribute('width');
                    canvas.removeAttribute('height');

                    canvas.style.maxWidth = '95%';
                    canvas.style.maxHeight = 'auto';
                    canvas.style.objectFit = 'contain';
                    canvas.style.margin = '0 auto';
                    canvas.style.display = 'block';
                    canvas.style.position = 'relative';
                    canvas.style.top = '0';

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

    bgImageLoader.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    if (!state.image) {
                        // If no main image exists, treat this as the main image
                        canvas.width = img.width;
                        canvas.height = img.height;
                        state.resetForNewImage(img);
                        imageProcessor.setImage(img);
                        resizeCanvasDisplay();
                        ui.resetSliders();
                    } else {
                        // Store the original background image
                        state.setBackgroundImage(img); // This sets both originalBackgroundImage and backgroundImage
    
                        // Automatically crop the background image to match the main image's dimensions
                        const mainImage = state.image;
                        const mainAspectRatio = mainImage.width / mainImage.height;
                        const bgAspectRatio = img.width / img.height;
    
                        let cropX, cropY, cropWidth, cropHeight;
    
                        // Determine the crop dimensions to match the main image's aspect ratio
                        if (bgAspectRatio > mainAspectRatio) {
                            // Background image is wider than the main image
                            cropWidth = img.height * mainAspectRatio;
                            cropHeight = img.height;
                            cropX = (img.width - cropWidth) / 2;
                            cropY = 0;
                        } else {
                            // Background image is taller than the main image
                            cropWidth = img.width;
                            cropHeight = img.width / mainAspectRatio;
                            cropX = 0;
                            cropY = (img.height - cropHeight) / 2;
                        }
    
                        // Create a temporary canvas to crop the background image
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = mainImage.width;
                        tempCanvas.height = mainImage.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.imageSmoothingEnabled = true;
    
                        // Draw the cropped background image onto the temporary canvas, scaled to the main image's dimensions
                        tempCtx.drawImage(
                            img,
                            cropX, cropY, cropWidth, cropHeight,
                            0, 0, mainImage.width, mainImage.height
                        );
    
                        // Create a new image from the cropped canvas
                        const croppedImage = new Image();
                        croppedImage.onload = () => {
                            state.backgroundImage = croppedImage; // Update only the backgroundImage, not the original
                            imageProcessor.setBackgroundImage(croppedImage);
                            imageProcessor.render();
    
                            // Store the initial crop settings in backgroundCropHistory
                            const normalizedX = cropX / img.width;
                            const normalizedY = cropY / img.height;
                            const normalizedWidth = cropWidth / img.width;
                            const normalizedHeight = cropHeight / img.height;
                            state.backgroundCropSettings = {
                                x: 0,
                                y: 0,
                                width: mainImage.width,
                                height: mainImage.height,
                                rotation: 0,
                                scale: 1
                            };
                            state.backgroundCropHistory.push({
                                normalizedX,
                                normalizedY,
                                normalizedWidth,
                                normalizedHeight,
                                rotation: 0,
                                originalWidth: img.width,
                                originalHeight: img.height,
                                scale: 1
                            });
                            state.lastCropRect = {
                                normalizedX,
                                normalizedY,
                                normalizedWidth,
                                normalizedHeight,
                                rotation: 0,
                                originalWidth: img.width,
                                originalHeight: img.height,
                                scale: 1
                            };
                        };
                        croppedImage.src = tempCanvas.toDataURL('image/png');
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    document.getElementById('crop-bg').addEventListener('click', () => {
        if (!state.backgroundImage) return;
        cropRotate.showCropModal(true); // Pass a flag to indicate background cropping
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

    canvas.addEventListener('resize', () => {
        resizeCanvasDisplay();
    });

    const toggleZoomBtn = document.getElementById('toggle-zoom');
    const zoomControl = document.getElementById('zoom-control');
    const zoomLevelInput = document.getElementById('zoom-level');

    toggleZoomBtn.addEventListener('click', () => {
        isZoomEnabled = !isZoomEnabled;
        zoomLevelInput.disabled = !isZoomEnabled;
        zoomControl.style.display = isZoomEnabled ? 'inline-block' : 'none';
        magnifierCanvas.style.display = isZoomEnabled ? 'block' : 'none';
        magnifierCanvas.style.zIndex = isZoomEnabled ? '2000' : '100';
        if (!isZoomEnabled) {
            magnifierCtx.clearRect(0, 0, magnifierSize, magnifierSize);
        }
    });

    zoomLevelInput.addEventListener('input', (e) => {
        const newValue = Math.max(50, Math.min(1000, parseInt(e.target.value) || 200)) / 100;
        zoomLevel = newValue;
    });

    zoomLevelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') zoomLevelInput.blur();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isZoomEnabled || !state.image) return;

        const rect = canvas.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        const mouseX = e.clientX - rect.left + scrollX;
        const mouseY = e.clientY - rect.top + scrollY;

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const displayWidth = parseFloat(canvas.style.width);
        const displayHeight = parseFloat(canvas.style.height);
        const scaleX = canvasWidth / displayWidth;
        const scaleY = canvasHeight / displayHeight;
        const canvasX = mouseX * scaleX;
        const canvasY = mouseY * scaleY;

        let magnifierX = e.clientX - magnifierSize / 2 + scrollX;
        let magnifierY = e.clientY - magnifierSize / 2 + scrollY;

        const windowWidth = window.innerWidth + scrollX;
        const windowHeight = window.innerHeight + scrollY;

        if (magnifierX < scrollX) {
            magnifierX = scrollX;
        } else if (magnifierX + magnifierSize > windowWidth) {
            magnifierX = windowWidth - magnifierSize;
        }

        let isPinnedTop = false;
        let isPinnedBottom = false;

        if (magnifierY < scrollY) {
            magnifierY = scrollY;
            isPinnedTop = true;
        } else if (magnifierY + magnifierSize > windowHeight) {
            magnifierY = windowHeight - magnifierSize;
            isPinnedBottom = true;
        }

        magnifierCanvas.style.left = `${magnifierX - scrollX}px`;
        magnifierCanvas.style.top = `${magnifierY - scrollY}px`;

        const offsetX = (e.clientX + scrollX - magnifierX) - magnifierSize / 2;
        let offsetY;

        if (isPinnedTop) {
            const cursorYRelativeToMagnifierCenter = (e.clientY + scrollY) - (magnifierY + magnifierSize / 2);
            offsetY = cursorYRelativeToMagnifierCenter;
        } else if (isPinnedBottom) {
            const cursorYRelativeToMagnifierCenter = (e.clientY + scrollY) - (magnifierY + magnifierSize / 2);
            offsetY = cursorYRelativeToMagnifierCenter;
        } else {
            offsetY = (e.clientY + scrollY - magnifierY) - magnifierSize / 2;
        }

        magnifierCtx.clearRect(0, 0, magnifierSize, magnifierSize);
        magnifierCtx.save();
        magnifierCtx.beginPath();
        magnifierCtx.arc(magnifierSize / 2, magnifierSize / 2, magnifierSize / 2, 0, Math.PI * 2);
        magnifierCtx.clip();

        const zoomAreaSize = magnifierSize / zoomLevel;

        let sourceX = canvasX - (zoomAreaSize / 2);
        let sourceY = canvasY - (zoomAreaSize / 2);

        let sourceWidth = zoomAreaSize;
        let sourceHeight = zoomAreaSize;
        let destWidth = zoomAreaSize * zoomLevel;
        let destHeight = zoomAreaSize * zoomLevel;
        let adjustedDestX = offsetX * zoomLevel;
        let adjustedDestY = offsetY * zoomLevel;

        if (sourceX < 0) {
            const overflow = -sourceX;
            sourceWidth -= overflow;
            destWidth = sourceWidth * zoomLevel;
            adjustedDestX = magnifierSize / 2 - (zoomAreaSize / 2 - overflow) * zoomLevel;
            sourceX = 0;
        } else if (sourceX + zoomAreaSize > canvasWidth) {
            const overflow = (sourceX + zoomAreaSize) - canvasWidth;
            sourceWidth -= overflow;
            destWidth = sourceWidth * zoomLevel;
            adjustedDestX = magnifierSize / 2 - (zoomAreaSize / 2) * zoomLevel;
        }

        if (sourceY < 0) {
            const overflow = -sourceY;
            sourceHeight -= overflow;
            destHeight = sourceHeight * zoomLevel;
            adjustedDestY = magnifierSize / 2 - (zoomAreaSize / 2 - overflow) * zoomLevel;
            sourceY = 0;
        } else if (sourceY + zoomAreaSize > canvasHeight) {
            const overflow = (sourceY + zoomAreaSize) - canvasHeight;
            sourceHeight -= overflow;
            destHeight = sourceHeight * zoomLevel;
            adjustedDestY = magnifierSize / 2 - (zoomAreaSize / 2) * zoomLevel;
        }

        if (sourceWidth > 0 && sourceHeight > 0) {
            magnifierCtx.drawImage(
                canvas,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                adjustedDestX,
                adjustedDestY,
                destWidth,
                destHeight
            );
        }

        magnifierCtx.restore();
        magnifierCtx.strokeStyle = '#000';
        magnifierCtx.lineWidth = 2;
        magnifierCtx.beginPath();
        magnifierCtx.arc(magnifierSize / 2, magnifierSize / 2, magnifierSize / 2 - 1, 0, Math.PI * 2);
        magnifierCtx.stroke();

        magnifierCtx.strokeStyle = 'red';
        magnifierCtx.lineWidth = 1;
        magnifierCtx.beginPath();
        magnifierCtx.moveTo(magnifierSize / 2 - 10, magnifierSize / 2);
        magnifierCtx.lineTo(magnifierSize / 2 + 10, magnifierSize / 2);
        magnifierCtx.moveTo(magnifierSize / 2, magnifierSize / 2 - 10);
        magnifierCtx.lineTo(magnifierSize / 2, magnifierSize / 2 + 10);
        magnifierCtx.stroke();
    });

    canvas.addEventListener('mouseleave', () => {
        if (isZoomEnabled) {
            magnifierCanvas.style.display = 'none';
            magnifierCtx.clearRect(0, 0, magnifierSize, magnifierSize);
        }
    });

    canvas.addEventListener('mouseenter', () => {
        if (isZoomEnabled) {
            magnifierCanvas.style.display = 'block';
        }
    });

    let initialDistance = null;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            initialDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            e.preventDefault();
        }
    }, { passive: false }); // Explicitly set passive to false
    
    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialDistance !== null) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            const pinchDelta = currentDistance - initialDistance;
    
            if (Math.abs(pinchDelta) > 20) {
                isZoomEnabled = pinchDelta > 0;
                zoomLevelInput.disabled = !isZoomEnabled;
                zoomControl.style.display = isZoomEnabled ? 'inline-block' : 'none';
                magnifierCanvas.style.display = isZoomEnabled ? 'block' : 'none';
                magnifierCanvas.style.zIndex = isZoomEnabled ? '2000' : '100';
                initialDistance = currentDistance;
                toggleZoomBtn.textContent = isZoomEnabled ? 'Zoom Off' : 'Zoom';
            }
            e.preventDefault();
        }
    }, { passive: false }); // Ensure the event listener is explicitly non-passive
    

    canvas.addEventListener('touchend', () => {
        initialDistance = null;
    });
});