/**
 * Lines Calibrator
 * Handles click-to-calibrate lines and pixel-to-meter projections
 */
class LinesCalibrator {
    constructor() {
        this.calibrationPoints = [];
        this.meterValues = [];
        this.isCalibrating = false;
        this.testType = null;
        this.onCalibrationComplete = null;
        this.onCalibrationPoint = null;
        
        // Storage key for persisting calibrations
        this.storageKey = 'athleticTestCalibrations';
    }

    /**
     * Start calibration for a specific test type
     */
    startCalibration(testType, canvas) {
        this.testType = testType;
        this.calibrationPoints = [];
        this.meterValues = [];
        this.isCalibrating = true;
        this.canvas = canvas;
        
        // Set up click handler
        this.setupClickHandler();
        
        // Define meter values based on test type
        switch (testType) {
            case 'broad-jump':
                this.meterValues = [0, 3]; // Takeoff line and expected landing area
                break;
            case 'sprint':
                this.meterValues = [0, 15, 30]; // 0m, 15m, 30m markers
                break;
            case 'kick':
                this.meterValues = [0, 10]; // 0m and 10m lines
                break;
        }
        
        console.log(`Starting ${testType} calibration - click ${this.meterValues.length} points`);
    }

    /**
     * Set up canvas click handler
     */
    setupClickHandler() {
        if (!this.canvas) return;
        
        this.clickHandler = (event) => {
            if (!this.isCalibrating) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;
            
            this.addCalibrationPoint(x, y);
        };
        
        this.canvas.addEventListener('click', this.clickHandler);
    }

    /**
     * Add a calibration point
     */
    addCalibrationPoint(x, y) {
        const pointIndex = this.calibrationPoints.length;
        const meterValue = this.meterValues[pointIndex];
        
        this.calibrationPoints.push({ x, y });
        
        console.log(`Calibration point ${pointIndex + 1}: (${x.toFixed(1)}, ${y.toFixed(1)}) = ${meterValue}m`);
        
        // Notify callback
        if (this.onCalibrationPoint) {
            this.onCalibrationPoint(pointIndex + 1, this.meterValues.length, meterValue);
        }
        
        // Check if calibration is complete
        if (this.calibrationPoints.length >= this.meterValues.length) {
            this.completeCalibration();
        }
    }

    /**
     * Complete calibration process
     */
    completeCalibration() {
        this.isCalibrating = false;
        
        // Remove click handler
        if (this.canvas && this.clickHandler) {
            this.canvas.removeEventListener('click', this.clickHandler);
        }
        
        // Calculate calibration parameters
        this.calculateCalibrationParams();
        
        // Save calibration
        this.saveCalibration();
        
        console.log(`${this.testType} calibration complete`);
        
        // Notify callback
        if (this.onCalibrationComplete) {
            this.onCalibrationComplete(this.getCalibrationData());
        }
    }

    /**
     * Calculate calibration parameters for projection
     */
    calculateCalibrationParams() {
        if (this.calibrationPoints.length < 2) return;
        
        // For sprint test (3 points), verify collinearity
        if (this.testType === 'sprint' && this.calibrationPoints.length === 3) {
            const collinear = this.checkCollinearity(
                this.calibrationPoints[0],
                this.calibrationPoints[1],
                this.calibrationPoints[2]
            );
            
            if (!collinear) {
                console.warn('Sprint calibration points are not collinear');
            }
        }
        
        // Calculate line parameters using first and last points
        const p1 = this.calibrationPoints[0];
        const p2 = this.calibrationPoints[this.calibrationPoints.length - 1];
        const m1 = this.meterValues[0];
        const m2 = this.meterValues[this.meterValues.length - 1];
        
        // Line direction vector
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        
        // Meters per pixel along the line
        const metersPerPixel = (m2 - m1) / lineLength;
        
        // Store calibration parameters
        this.calibrationParams = {
            origin: p1,
            direction: { x: dx / lineLength, y: dy / lineLength },
            metersPerPixel: metersPerPixel,
            originMeterValue: m1
        };
    }

    /**
     * Check if three points are approximately collinear
     */
    checkCollinearity(p1, p2, p3, tolerance = 10) {
        // Calculate cross product to check collinearity
        const crossProduct = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
        return Math.abs(crossProduct) < tolerance;
    }

    /**
     * Project pixel point to meters along the calibrated line
     */
    projectPxToM(point) {
        if (!this.calibrationParams) return null;
        
        const { origin, direction, metersPerPixel, originMeterValue } = this.calibrationParams;
        
        // Vector from origin to point
        const dx = point.x - origin.x;
        const dy = point.y - origin.y;
        
        // Project onto line direction (dot product)
        const projection = dx * direction.x + dy * direction.y;
        
        // Convert to meters
        const meters = originMeterValue + (projection * metersPerPixel);
        
        return meters;
    }

    /**
     * Project meters to pixel coordinates along the line
     */
    projectMToPx(meters) {
        if (!this.calibrationParams) return null;
        
        const { origin, direction, metersPerPixel, originMeterValue } = this.calibrationParams;
        
        // Distance in pixels from origin
        const pixelDistance = (meters - originMeterValue) / metersPerPixel;
        
        // Calculate point coordinates
        const x = origin.x + (pixelDistance * direction.x);
        const y = origin.y + (pixelDistance * direction.y);
        
        return { x, y };
    }

    /**
     * Get calibration data
     */
    getCalibrationData() {
        return {
            testType: this.testType,
            points: this.calibrationPoints,
            meterValues: this.meterValues,
            params: this.calibrationParams,
            timestamp: Date.now()
        };
    }

    /**
     * Load saved calibration
     */
    loadCalibration(testType) {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) return false;
            
            const calibrations = JSON.parse(saved);
            const calibration = calibrations[testType];
            
            if (!calibration) return false;
            
            this.testType = testType;
            this.calibrationPoints = calibration.points;
            this.meterValues = calibration.meterValues;
            this.calibrationParams = calibration.params;
            
            console.log(`Loaded ${testType} calibration`);
            return true;
            
        } catch (error) {
            console.error('Failed to load calibration:', error);
            return false;
        }
    }

    /**
     * Save calibration to localStorage
     */
    saveCalibration() {
        try {
            let calibrations = {};
            
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                calibrations = JSON.parse(saved);
            }
            
            calibrations[this.testType] = this.getCalibrationData();
            
            localStorage.setItem(this.storageKey, JSON.stringify(calibrations));
            console.log(`Saved ${this.testType} calibration`);
            
        } catch (error) {
            console.error('Failed to save calibration:', error);
        }
    }

    /**
     * Clear calibration for test type
     */
    clearCalibration(testType) {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) return;
            
            const calibrations = JSON.parse(saved);
            delete calibrations[testType];
            
            localStorage.setItem(this.storageKey, JSON.stringify(calibrations));
            
            if (this.testType === testType) {
                this.calibrationPoints = [];
                this.meterValues = [];
                this.calibrationParams = null;
            }
            
        } catch (error) {
            console.error('Failed to clear calibration:', error);
        }
    }

    /**
     * Check if test type is calibrated
     */
    isCalibrated(testType) {
        if (testType === this.testType && this.calibrationParams) {
            return true;
        }
        
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) return false;
            
            const calibrations = JSON.parse(saved);
            return !!calibrations[testType];
            
        } catch (error) {
            return false;
        }
    }

    /**
     * Get distance between two points in meters
     */
    getDistanceInMeters(point1, point2) {
        if (!this.calibrationParams) return null;
        
        const meters1 = this.projectPxToM(point1);
        const meters2 = this.projectPxToM(point2);
        
        if (meters1 === null || meters2 === null) return null;
        
        return Math.abs(meters2 - meters1);
    }

    /**
     * Cancel ongoing calibration
     */
    cancelCalibration() {
        this.isCalibrating = false;
        
        if (this.canvas && this.clickHandler) {
            this.canvas.removeEventListener('click', this.clickHandler);
        }
        
        this.calibrationPoints = [];
        this.meterValues = [];
    }
}