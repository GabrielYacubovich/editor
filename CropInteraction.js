export class CropInteraction {
    constructor(cropRotate) {
        this.cropRotate = cropRotate;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.resizeMargin = 20;
        this.setupEventListeners();
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    nearCorner(x, y, cornerX, cornerY, margin) {
        return Math.abs(x - cornerX) < margin && Math.abs(y - cornerY) < margin;
    }

    nearSide(x, y, rectX, rectY, width, height, side, margin) {
        switch (side) {
            case 'left': return Math.abs(x - rectX) < margin && y > rectY && y < rectY + height;
            case 'right': return Math.abs(x - (rectX + width)) < margin && y > rectY && y < rectY + height;
            case 'top': return Math.abs(y - rectY) < margin && x > rectX && x < rectX + width;
            case 'bottom': return Math.abs(y - (rectY + height)) < margin && x > rectX && x < rectX + width;
            default: return false;
        }
    }

    insideCrop(x, y) {
        const { x: rx, y: ry, width, height } = this.cropRotate.cropRect;
        return x >= rx && x <= rx + width && y >= ry && y <= ry + height;
    }

    setupEventListeners() {
        const canvas = this.cropRotate.cropCanvas;
        canvas.addEventListener('mousedown', this.startCropDrag.bind(this));
        canvas.addEventListener('mousemove', this.adjustCropDrag.bind(this));
        canvas.addEventListener('mouseup', this.stopCropDrag.bind(this));
        document.addEventListener('mousemove', this.handleDragOutside.bind(this));
        document.addEventListener('mouseup', this.stopCropDrag.bind(this));
        canvas.addEventListener('touchstart', this.startCropDrag.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.adjustCropDrag.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.stopCropDrag.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleDragOutside.bind(this), { passive: false });
        document.addEventListener('touchend', this.stopCropDrag.bind(this), { passive: false });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const { x: rx, y: ry, width, height } = this.cropRotate.cropRect;

            if (this.nearCorner(x, y, rx, ry, this.resizeMargin)) {
                canvas.style.cursor = 'nwse-resize';
            } else if (this.nearCorner(x, y, rx + width, ry, this.resizeMargin)) {
                canvas.style.cursor = 'nesw-resize';
            } else if (this.nearCorner(x, y, rx, ry + height, this.resizeMargin)) {
                canvas.style.cursor = 'nesw-resize';
            } else if (this.nearCorner(x, y, rx + width, ry + height, this.resizeMargin)) {
                canvas.style.cursor = 'nwse-resize';
            } else if (this.nearSide(x, y, rx, ry, width, height, 'left', this.resizeMargin)) {
                canvas.style.cursor = 'ew-resize';
            } else if (this.nearSide(x, y, rx, ry, width, height, 'right', this.resizeMargin)) {
                canvas.style.cursor = 'ew-resize';
            } else if (this.nearSide(x, y, rx, ry, width, height, 'top', this.resizeMargin)) {
                canvas.style.cursor = 'ns-resize';
            } else if (this.nearSide(x, y, rx, ry, width, height, 'bottom', this.resizeMargin)) {
                canvas.style.cursor = 'ns-resize';
            } else if (this.insideCrop(x, y)) {
                canvas.style.cursor = 'move';
            } else {
                canvas.style.cursor = 'default';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.cropRotate.cropModal.style.display === 'flex') {
                this.cropRotate.closeModal();
            }
        });
    }

    startCropDrag(e) {
        e.preventDefault();
        const rect = this.cropRotate.cropCanvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        const { x: rx, y: ry, width, height } = this.cropRotate.cropRect;

        if (this.nearCorner(x, y, rx, ry, this.resizeMargin)) {
            this.isDragging = 'top-left';
        } else if (this.nearCorner(x, y, rx + width, ry, this.resizeMargin)) {
            this.isDragging = 'top-right';
        } else if (this.nearCorner(x, y, rx, ry + height, this.resizeMargin)) {
            this.isDragging = 'bottom-left';
        } else if (this.nearCorner(x, y, rx + width, ry + height, this.resizeMargin)) {
            this.isDragging = 'bottom-right';
        } else if (this.nearSide(x, y, rx, ry, width, height, 'left', this.resizeMargin)) {
            this.isDragging = 'left';
        } else if (this.nearSide(x, y, rx, ry, width, height, 'right', this.resizeMargin)) {
            this.isDragging = 'right';
        } else if (this.nearSide(x, y, rx, ry, width, height, 'top', this.resizeMargin)) {
            this.isDragging = 'top';
        } else if (this.nearSide(x, y, rx, ry, width, height, 'bottom', this.resizeMargin)) {
            this.isDragging = 'bottom';
        } else if (this.insideCrop(x, y)) {
            this.isDragging = 'move';
            this.startX = x - rx;
            this.startY = y - ry;
        }
        if (this.isDragging) this.cropRotate.drawCropOverlay();
    }

    adjustCropDrag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const rect = this.cropRotate.cropCanvas.getBoundingClientRect();
        let x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        let y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        x = this.clamp(x, 0, this.cropRotate.cropCanvas.width);
        y = this.clamp(y, 0, this.cropRotate.cropCanvas.height);

        const bounds = this.cropRotate.getRotatedImageBounds(
            this.cropRotate.originalWidth,
            this.cropRotate.originalHeight,
            this.cropRotate.rotation,
            parseFloat(this.cropRotate.cropCanvas.dataset.scaleFactor)
        );

        if (this.isDragging === 'move') {
            this.cropRotate.cropRect.x = this.clamp(x - this.startX, bounds.x, bounds.x + bounds.width - this.cropRotate.cropRect.width);
            this.cropRotate.cropRect.y = this.clamp(y - this.startY, bounds.y, bounds.y + bounds.height - this.cropRotate.cropRect.height);
        } else {
            this.resizeCrop(x, y, bounds);
        }
        this.cropRotate.drawCropOverlay();
    }

    handleDragOutside(e) {
        if (!this.isDragging) return;
        this.adjustCropDrag(e);
    }

    stopCropDrag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        this.isDragging = false;
        this.cropRotate.cropCanvas.style.cursor = 'default';
        const bounds = this.cropRotate.getRotatedImageBounds(
            this.cropRotate.originalWidth,
            this.cropRotate.originalHeight,
            this.cropRotate.rotation,
            parseFloat(this.cropRotate.cropCanvas.dataset.scaleFactor)
        );
        this.cropRotate.cropRect.x = this.clamp(this.cropRotate.cropRect.x, bounds.x, bounds.x + bounds.width - this.cropRotate.cropRect.width);
        this.cropRotate.cropRect.y = this.clamp(this.cropRotate.cropRect.y, bounds.y, bounds.y + bounds.height - this.cropRotate.cropRect.height);
        this.cropRotate.cropRect.width = this.clamp(this.cropRotate.cropRect.width, 10, bounds.width);
        this.cropRotate.cropRect.height = this.clamp(this.cropRotate.cropRect.height, 10, bounds.height);
        this.cropRotate.drawCropOverlay();
    }

    resizeCrop(x, y, bounds) {
        let newWidth, newHeight;
        const { lockAspectRatio, aspectRatio, isBackgroundCrop, state } = this.cropRotate;

        const effectiveAspectRatio = lockAspectRatio ? (isBackgroundCrop ? state.mainCropAspectRatio : aspectRatio) : null;

        switch (this.isDragging) {
            case 'top-left':
                newWidth = this.clamp(this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - x, 10, this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - bounds.x);
                newHeight = effectiveAspectRatio ? newWidth / effectiveAspectRatio : this.clamp(this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - y, 10, this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - bounds.y);
                if (effectiveAspectRatio && newHeight > this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - bounds.y) {
                    newHeight = this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - bounds.y;
                    newWidth = newHeight * effectiveAspectRatio;
                }
                this.cropRotate.cropRect.x = this.clamp(x, bounds.x, this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - 10);
                this.cropRotate.cropRect.y = effectiveAspectRatio ? this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - newHeight : this.clamp(y, bounds.y, this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - 10);
                this.cropRotate.cropRect.width = newWidth;
                this.cropRotate.cropRect.height = newHeight;
                break;
            case 'top-right':
                newWidth = this.clamp(x - this.cropRotate.cropRect.x, 10, bounds.x + bounds.width - this.cropRotate.cropRect.x);
                newHeight = effectiveAspectRatio ? newWidth / effectiveAspectRatio : this.clamp(this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - y, 10, this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - bounds.y);
                if (effectiveAspectRatio && newHeight > this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - bounds.y) {
                    newHeight = this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - bounds.y;
                    newWidth = newHeight * effectiveAspectRatio;
                }
                this.cropRotate.cropRect.y = effectiveAspectRatio ? this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - newHeight : this.clamp(y, bounds.y, this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - 10);
                this.cropRotate.cropRect.width = newWidth;
                this.cropRotate.cropRect.height = newHeight;
                break;
            case 'bottom-left':
                newWidth = this.clamp(this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - x, 10, this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - bounds.x);
                newHeight = effectiveAspectRatio ? newWidth / effectiveAspectRatio : this.clamp(y - this.cropRotate.cropRect.y, 10, bounds.y + bounds.height - this.cropRotate.cropRect.y);
                if (effectiveAspectRatio && newHeight > bounds.y + bounds.height - this.cropRotate.cropRect.y) {
                    newHeight = bounds.y + bounds.height - this.cropRotate.cropRect.y;
                    newWidth = newHeight * effectiveAspectRatio;
                }
                this.cropRotate.cropRect.x = this.clamp(x, bounds.x, this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - 10);
                this.cropRotate.cropRect.width = newWidth;
                this.cropRotate.cropRect.height = newHeight;
                break;
            case 'bottom-right':
                newWidth = this.clamp(x - this.cropRotate.cropRect.x, 10, bounds.x + bounds.width - this.cropRotate.cropRect.x);
                newHeight = effectiveAspectRatio ? newWidth / effectiveAspectRatio : this.clamp(y - this.cropRotate.cropRect.y, 10, bounds.y + bounds.height - this.cropRotate.cropRect.y);
                if (effectiveAspectRatio && newHeight > bounds.y + bounds.height - this.cropRotate.cropRect.y) {
                    newHeight = bounds.y + bounds.height - this.cropRotate.cropRect.y;
                    newWidth = newHeight * effectiveAspectRatio;
                }
                this.cropRotate.cropRect.width = newWidth;
                this.cropRotate.cropRect.height = newHeight;
                break;
            case 'left':
                newWidth = this.clamp(this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - x, 10, this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - bounds.x);
                newHeight = effectiveAspectRatio ? newWidth / effectiveAspectRatio : this.cropRotate.cropRect.height;
                if (effectiveAspectRatio && newHeight > bounds.y + bounds.height - this.cropRotate.cropRect.y) {
                    newHeight = bounds.y + bounds.height - this.cropRotate.cropRect.y;
                    newWidth = newHeight * effectiveAspectRatio;
                }
                this.cropRotate.cropRect.x = this.clamp(x, bounds.x, this.cropRotate.cropRect.x + this.cropRotate.cropRect.width - 10);
                this.cropRotate.cropRect.width = newWidth;
                this.cropRotate.cropRect.height = newHeight;
                break;
            case 'right':
                newWidth = this.clamp(x - this.cropRotate.cropRect.x, 10, bounds.x + bounds.width - this.cropRotate.cropRect.x);
                newHeight = effectiveAspectRatio ? newWidth / effectiveAspectRatio : this.cropRotate.cropRect.height;
                if (effectiveAspectRatio && newHeight > bounds.y + bounds.height - this.cropRotate.cropRect.y) {
                    newHeight = bounds.y + bounds.height - this.cropRotate.cropRect.y;
                    newWidth = newHeight * effectiveAspectRatio;
                }
                this.cropRotate.cropRect.width = newWidth;
                this.cropRotate.cropRect.height = newHeight;
                break;
            case 'top':
                newHeight = this.clamp(this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - y, 10, this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - bounds.y);
                newWidth = effectiveAspectRatio ? newHeight * effectiveAspectRatio : this.cropRotate.cropRect.width;
                if (effectiveAspectRatio && newWidth > bounds.x + bounds.width - this.cropRotate.cropRect.x) {
                    newWidth = bounds.x + bounds.width - this.cropRotate.cropRect.x;
                    newHeight = newWidth / effectiveAspectRatio;
                }
                this.cropRotate.cropRect.y = this.clamp(y, bounds.y, this.cropRotate.cropRect.y + this.cropRotate.cropRect.height - 10);
                this.cropRotate.cropRect.height = newHeight;
                this.cropRotate.cropRect.width = newWidth;
                break;
            case 'bottom':
                newHeight = this.clamp(y - this.cropRotate.cropRect.y, 10, bounds.y + bounds.height - this.cropRotate.cropRect.y);
                newWidth = effectiveAspectRatio ? newHeight * effectiveAspectRatio : this.cropRotate.cropRect.cropRect.width;
                if (effectiveAspectRatio && newWidth > bounds.x + bounds.width - this.cropRotate.cropRect.x) {
                    newWidth = bounds.x + bounds.width - this.cropRotate.cropRect.x;
                    newHeight = newWidth / effectiveAspectRatio;
                }
                this.cropRotate.cropRect.height = newHeight;
                this.cropRotate.cropRect.width = newWidth;
                break;
        }
    }
}