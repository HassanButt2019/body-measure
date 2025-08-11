/**
 * Canvas Renderer
 * Handles drawing pose landmarks and measurements on canvas
 */
class CanvasRenderer {
    constructor() {
        this.canvas = document.getElementById('analysis-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Drawing styles
        this.styles = {
            landmark: {
                radius: 4,
                fillColor: '#FF6B6B',
                strokeColor: '#FFFFFF',
                strokeWidth: 2
            },
            connection: {
                strokeColor: '#4ECDC4',
                strokeWidth: 3,
                dashPattern: []
            },
            measurement: {
                strokeColor: '#FFE66D',
                strokeWidth: 4,
                dashPattern: [5, 5]
            },
            text: {
                fillColor: '#FFFFFF',
                strokeColor: '#000000',
                font: '14px Arial',
                strokeWidth: 3
            },
            background: {
                fillColor: 'rgba(0, 0, 0, 0.7)',
                strokeColor: 'rgba(255, 255, 255, 0.3)',
                strokeWidth: 1
            }
        };
    }

    /**
     * Render pose detection results on canvas
     */
    renderPoseResults(imageData, poseLandmarks, measurements) {
        try {
            // Set canvas size to match image
            this.canvas.width = imageData.width;
            this.canvas.height = imageData.height;

            // Draw the captured image
            this.ctx.drawImage(imageData.canvas, 0, 0);

            // Draw pose landmarks and connections
            this.drawPoseLandmarks(poseLandmarks);
            this.drawPoseConnections(poseLandmarks);

            // Draw measurement lines and labels
            if (measurements) {
                this.drawMeasurementLines(measurements, imageData.width, imageData.height);
            }

            // Make canvas visible
            this.canvas.style.display = 'block';

        } catch (error) {
            console.error('Error rendering pose results:', error);
            throw new Error('Failed to render pose visualization');
        }
    }

    /**
     * Draw pose landmarks
     */
    drawPoseLandmarks(landmarks) {
        landmarks.forEach((landmark, index) => {
            if (PoseDetector.validateLandmark(landmark, 0.3)) {
                const x = landmark.x * this.canvas.width;
                const y = landmark.y * this.canvas.height;
                
                this.drawLandmark(x, y, this.getLandmarkColor(index));
            }
        });
    }

    /**
     * Draw individual landmark
     */
    drawLandmark(x, y, color = null) {
        const style = this.styles.landmark;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, style.radius, 0, 2 * Math.PI);
        
        // Fill
        this.ctx.fillStyle = color || style.fillColor;
        this.ctx.fill();
        
        // Stroke
        this.ctx.strokeStyle = style.strokeColor;
        this.ctx.lineWidth = style.strokeWidth;
        this.ctx.stroke();
    }

    /**
     * Draw pose connections
     */
    drawPoseConnections(landmarks) {
        const connections = this.getPoseConnections();
        
        connections.forEach(([startIndex, endIndex]) => {
            const startLandmark = landmarks[startIndex];
            const endLandmark = landmarks[endIndex];
            
            if (PoseDetector.validateLandmark(startLandmark, 0.3) && 
                PoseDetector.validateLandmark(endLandmark, 0.3)) {
                
                const startX = startLandmark.x * this.canvas.width;
                const startY = startLandmark.y * this.canvas.height;
                const endX = endLandmark.x * this.canvas.width;
                const endY = endLandmark.y * this.canvas.height;
                
                this.drawConnection(startX, startY, endX, endY);
            }
        });
    }

    /**
     * Draw connection line between landmarks
     */
    drawConnection(startX, startY, endX, endY) {
        const style = this.styles.connection;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        
        this.ctx.strokeStyle = style.strokeColor;
        this.ctx.lineWidth = style.strokeWidth;
        this.ctx.setLineDash(style.dashPattern);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset dash pattern
    }

    /**
     * Draw measurement lines and labels
     */
    drawMeasurementLines(measurements, imageWidth, imageHeight) {
        const bodyLandmarks = measurements.bodyLandmarks;
        const segments = measurements.segments;
        const side = measurements.usedSide;
        
        // Define segment landmark pairs
        const segmentPairs = {
            upperArm: [
                side === 'left' ? bodyLandmarks.leftShoulder : bodyLandmarks.rightShoulder,
                side === 'left' ? bodyLandmarks.leftElbow : bodyLandmarks.rightElbow
            ],
            forearm: [
                side === 'left' ? bodyLandmarks.leftElbow : bodyLandmarks.rightElbow,
                side === 'left' ? bodyLandmarks.leftWrist : bodyLandmarks.rightWrist
            ],
            thigh: [
                side === 'left' ? bodyLandmarks.leftHip : bodyLandmarks.rightHip,
                side === 'left' ? bodyLandmarks.leftKnee : bodyLandmarks.rightKnee
            ],
            shin: [
                side === 'left' ? bodyLandmarks.leftKnee : bodyLandmarks.rightKnee,
                side === 'left' ? bodyLandmarks.leftAnkle : bodyLandmarks.rightAnkle
            ]
        };

        // Draw each measurement
        Object.keys(segmentPairs).forEach(segmentName => {
            const [startLandmark, endLandmark] = segmentPairs[segmentName];
            const measurement = segments[segmentName];
            
            if (measurement && 
                PoseDetector.validateLandmark(startLandmark) && 
                PoseDetector.validateLandmark(endLandmark)) {
                
                this.drawMeasurementLine(
                    startLandmark, 
                    endLandmark, 
                    measurement, 
                    segmentName,
                    imageWidth,
                    imageHeight
                );
            }
        });
    }

    /**
     * Draw measurement line with label
     */
    drawMeasurementLine(startLandmark, endLandmark, measurement, segmentName, imageWidth, imageHeight) {
        const startX = startLandmark.x * imageWidth;
        const startY = startLandmark.y * imageHeight;
        const endX = endLandmark.x * imageWidth;
        const endY = endLandmark.y * imageHeight;
        
        // Draw measurement line
        const style = this.styles.measurement;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        
        this.ctx.strokeStyle = style.strokeColor;
        this.ctx.lineWidth = style.strokeWidth;
        this.ctx.setLineDash(style.dashPattern);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw measurement label
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const label = `${measurement.toFixed(1)} cm`;
        
        this.drawMeasurementLabel(midX, midY, label, segmentName);
    }

    /**
     * Draw measurement label with background
     */
    drawMeasurementLabel(x, y, text, segmentName) {
        const textStyle = this.styles.text;
        const bgStyle = this.styles.background;
        
        // Set font
        this.ctx.font = textStyle.font;
        
        // Measure text
        const textMetrics = this.ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 16; // Approximate font height
        
        // Calculate label position (offset to avoid overlap)
        const offsetX = this.getLabelOffset(segmentName).x;
        const offsetY = this.getLabelOffset(segmentName).y;
        const labelX = x + offsetX;
        const labelY = y + offsetY;
        
        // Draw background rectangle
        const padding = 4;
        const rectX = labelX - textWidth / 2 - padding;
        const rectY = labelY - textHeight / 2 - padding;
        const rectWidth = textWidth + padding * 2;
        const rectHeight = textHeight + padding * 2;
        
        this.ctx.fillStyle = bgStyle.fillColor;
        this.ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        
        this.ctx.strokeStyle = bgStyle.strokeColor;
        this.ctx.lineWidth = bgStyle.strokeWidth;
        this.ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        
        // Draw text stroke (outline)
        this.ctx.strokeStyle = textStyle.strokeColor;
        this.ctx.lineWidth = textStyle.strokeWidth;
        this.ctx.strokeText(text, labelX - textWidth / 2, labelY + textHeight / 4);
        
        // Draw text fill
        this.ctx.fillStyle = textStyle.fillColor;
        this.ctx.fillText(text, labelX - textWidth / 2, labelY + textHeight / 4);
    }

    /**
     * Get label offset for different segments to avoid overlap
     */
    getLabelOffset(segmentName) {
        const offsets = {
            upperArm: { x: -30, y: -20 },
            forearm: { x: 30, y: -20 },
            thigh: { x: -40, y: 0 },
            shin: { x: 40, y: 0 }
        };
        
        return offsets[segmentName] || { x: 0, y: -20 };
    }

    /**
     * Get pose connections for drawing skeleton
     */
    getPoseConnections() {
        return [
            // Face
            [0, 1], [1, 2], [2, 3], [3, 7],
            [0, 4], [4, 5], [5, 6], [6, 8],
            [9, 10],
            
            // Arms
            [11, 12], // Shoulders
            [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], // Left arm
            [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], // Right arm
            
            // Torso
            [11, 23], [12, 24], [23, 24], // Torso connections
            
            // Legs
            [23, 25], [25, 27], [27, 29], [27, 31], // Left leg
            [24, 26], [26, 28], [28, 30], [28, 32]  // Right leg
        ];
    }

    /**
     * Get landmark color based on type
     */
    getLandmarkColor(index) {
        // Color code different body parts
        if (index <= 10) return '#FF6B6B'; // Face (red)
        if (index >= 11 && index <= 16) return '#4ECDC4'; // Arms (teal)
        if (index >= 17 && index <= 22) return '#45B7D1'; // Hands (blue)
        if (index >= 23 && index <= 24) return '#96CEB4'; // Hips (green)
        if (index >= 25 && index <= 32) return '#FFEAA7'; // Legs (yellow)
        
        return '#FF6B6B'; // Default
    }

    /**
     * Clear canvas
     */
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.style.display = 'none';
    }

    /**
     * Resize canvas for responsive display
     */
    resizeCanvas(maxWidth = 400) {
        const aspectRatio = this.canvas.height / this.canvas.width;
        
        if (this.canvas.width > maxWidth) {
            this.canvas.style.width = maxWidth + 'px';
            this.canvas.style.height = (maxWidth * aspectRatio) + 'px';
        } else {
            this.canvas.style.width = this.canvas.width + 'px';
            this.canvas.style.height = this.canvas.height + 'px';
        }
    }

    /**
     * Export canvas as image
     */
    exportAsImage(filename = 'body-measurement.png') {
        try {
            // Create download link
            const link = document.createElement('a');
            link.download = filename;
            link.href = this.canvas.toDataURL('image/png');
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return true;
        } catch (error) {
            console.error('Failed to export canvas:', error);
            return false;
        }
    }

    /**
     * Add watermark to canvas
     */
    addWatermark(text = 'Body Measurement Tool', position = 'bottom-right') {
        const watermarkStyle = {
            font: '12px Arial',
            fillColor: 'rgba(255, 255, 255, 0.7)',
            strokeColor: 'rgba(0, 0, 0, 0.5)',
            strokeWidth: 1
        };
        
        this.ctx.font = watermarkStyle.font;
        const textMetrics = this.ctx.measureText(text);
        
        let x, y;
        const margin = 10;
        
        switch (position) {
            case 'bottom-right':
                x = this.canvas.width - textMetrics.width - margin;
                y = this.canvas.height - margin;
                break;
            case 'bottom-left':
                x = margin;
                y = this.canvas.height - margin;
                break;
            case 'top-right':
                x = this.canvas.width - textMetrics.width - margin;
                y = margin + 12;
                break;
            case 'top-left':
                x = margin;
                y = margin + 12;
                break;
            default:
                x = margin;
                y = this.canvas.height - margin;
        }
        
        // Draw watermark
        this.ctx.strokeStyle = watermarkStyle.strokeColor;
        this.ctx.lineWidth = watermarkStyle.strokeWidth;
        this.ctx.strokeText(text, x, y);
        
        this.ctx.fillStyle = watermarkStyle.fillColor;
        this.ctx.fillText(text, x, y);
    }

    /**
     * Draw guide line between two points with label
     */
    drawGuideLine(p1, p2, label, color = '#FFE66D') {
        // Draw line
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw label at midpoint
        if (label) {
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            this.drawTextLabel(midX, midY, label, color);
        }
    }

    /**
     * Draw marker at point with label
     */
    drawMarker(point, label, color = '#FF6B6B') {
        // Draw circle marker
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw label
        if (label) {
            this.drawTextLabel(point.x, point.y - 15, label, color);
        }
    }

    /**
     * Draw sparkline chart
     */
    drawSparkline(series, x, y, width, height, color = '#4ECDC4') {
        if (!series || series.length < 2) return;

        // Find min/max values
        const minVal = Math.min(...series);
        const maxVal = Math.max(...series);
        const range = maxVal - minVal;

        if (range === 0) return;

        // Draw background
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);

        // Draw sparkline
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;

        for (let i = 0; i < series.length; i++) {
            const px = x + (i / (series.length - 1)) * width;
            const py = y + height - ((series[i] - minVal) / range) * height;

            if (i === 0) {
                this.ctx.moveTo(px, py);
            } else {
                this.ctx.lineTo(px, py);
            }
        }

        this.ctx.stroke();
    }

    /**
     * Draw text label with background
     */
    drawTextLabel(x, y, text, color = '#FFFFFF') {
        this.ctx.font = '12px Arial';
        const textMetrics = this.ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 12;

        // Draw background
        const padding = 4;
        const bgX = x - textWidth / 2 - padding;
        const bgY = y - textHeight / 2 - padding;
        const bgWidth = textWidth + padding * 2;
        const bgHeight = textHeight + padding * 2;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

        // Draw text
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x - textWidth / 2, y + textHeight / 4);
    }

    /**
     * Draw crossing tick marks
     */
    drawCrossingTicks(points, labels, color = '#28a745') {
        points.forEach((point, index) => {
            if (point && labels[index]) {
                // Draw vertical tick line
                this.ctx.beginPath();
                this.ctx.moveTo(point.x, 0);
                this.ctx.lineTo(point.x, this.canvas.height);
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);

                // Draw label
                this.drawTextLabel(point.x, 30, labels[index], color);
            }
        });
    }

    /**
     * Draw distance/speed chips
     */
    drawInfoChip(x, y, text, value, unit, color = '#667eea') {
        const chipWidth = 120;
        const chipHeight = 40;

        // Draw chip background
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, chipWidth, chipHeight);
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, chipWidth, chipHeight);

        // Draw text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.fillText(text, x + 5, y + 15);
        
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`${value} ${unit}`, x + 5, y + 32);
    }
}
