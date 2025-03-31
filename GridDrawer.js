export class GridDrawer {
    static draw(ctx, cropRect, gridType) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;

        switch (gridType) {
            case 'none':
                break;
            case 'cross':
                ctx.beginPath();
                ctx.moveTo(cropRect.x + cropRect.width / 2, cropRect.y);
                ctx.lineTo(cropRect.x + cropRect.width / 2, cropRect.y + cropRect.height);
                ctx.moveTo(cropRect.x, cropRect.y + cropRect.height / 2);
                ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + cropRect.height / 2);
                ctx.moveTo(cropRect.x + cropRect.width * 0.25, cropRect.y + cropRect.height / 2 - 5);
                ctx.lineTo(cropRect.x + cropRect.width * 0.25, cropRect.y + cropRect.height / 2 + 5);
                ctx.moveTo(cropRect.x + cropRect.width * 0.75, cropRect.y + cropRect.height / 2 - 5);
                ctx.lineTo(cropRect.x + cropRect.width * 0.75, cropRect.y + cropRect.height / 2 + 5);
                ctx.moveTo(cropRect.x + cropRect.width / 2 - 5, cropRect.y + cropRect.height * 0.25);
                ctx.lineTo(cropRect.x + cropRect.width / 2 + 5, cropRect.y + cropRect.height * 0.25);
                ctx.moveTo(cropRect.x + cropRect.width / 2 - 5, cropRect.y + cropRect.height * 0.75);
                ctx.lineTo(cropRect.x + cropRect.width / 2 + 5, cropRect.y + cropRect.height * 0.75);
                ctx.stroke();
                break;
            case 'rule-of-thirds':
                ctx.beginPath();
                ctx.moveTo(cropRect.x + cropRect.width / 3, cropRect.y);
                ctx.lineTo(cropRect.x + cropRect.width / 3, cropRect.y + cropRect.height);
                ctx.moveTo(cropRect.x + 2 * cropRect.width / 3, cropRect.y);
                ctx.lineTo(cropRect.x + 2 * cropRect.width / 3, cropRect.y + cropRect.height);
                ctx.moveTo(cropRect.x, cropRect.y + cropRect.height / 3);
                ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + cropRect.height / 3);
                ctx.moveTo(cropRect.x, cropRect.y + 2 * cropRect.height / 3);
                ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + 2 * cropRect.height / 3);
                ctx.stroke();
                break;
            case 'golden-ratio':
                const phi = (1 + Math.sqrt(5)) / 2;
                const goldenWidth1 = cropRect.width / (phi + 1);
                const goldenWidth2 = cropRect.width - goldenWidth1;
                const goldenHeight1 = cropRect.height / (phi + 1);
                const goldenHeight2 = cropRect.height - goldenHeight1;

                ctx.beginPath();
                ctx.moveTo(cropRect.x + goldenWidth1, cropRect.y);
                ctx.lineTo(cropRect.x + goldenWidth1, cropRect.y + cropRect.height);
                ctx.moveTo(cropRect.x + goldenWidth2, cropRect.y);
                ctx.lineTo(cropRect.x + goldenWidth2, cropRect.y + cropRect.height);
                ctx.moveTo(cropRect.x, cropRect.y + goldenHeight1);
                ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + goldenHeight1);
                ctx.moveTo(cropRect.x, cropRect.y + goldenHeight2);
                ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + goldenHeight2);
                ctx.stroke();
                break;
            case 'grid-3x3':
                ctx.beginPath();
                for (let i = 1; i < 3; i++) {
                    ctx.moveTo(cropRect.x + (i * cropRect.width) / 3, cropRect.y);
                    ctx.lineTo(cropRect.x + (i * cropRect.width) / 3, cropRect.y + cropRect.height);
                    ctx.moveTo(cropRect.x, cropRect.y + (i * cropRect.height) / 3);
                    ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + (i * cropRect.height) / 3);
                }
                ctx.stroke();
                break;
            case 'grid-4x4':
                ctx.beginPath();
                for (let i = 1; i < 4; i++) {
                    ctx.moveTo(cropRect.x + (i * cropRect.width) / 4, cropRect.y);
                    ctx.lineTo(cropRect.x + (i * cropRect.width) / 4, cropRect.y + cropRect.height);
                    ctx.moveTo(cropRect.x, cropRect.y + (i * cropRect.height) / 4);
                    ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + (i * cropRect.height) / 4);
                }
                ctx.stroke();
                break;
        }
    }
}