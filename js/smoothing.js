/**
 * Smoothing Utilities
 * Provides moving average and other smoothing functions
 */
class SmoothingFilter {
    constructor(windowSize = 5) {
        this.windowSize = windowSize;
        this.dataBuffer = [];
    }

    /**
     * Add data point and get smoothed value
     */
    addValue(value) {
        this.dataBuffer.push(value);
        
        // Keep buffer size within window
        if (this.dataBuffer.length > this.windowSize) {
            this.dataBuffer.shift();
        }
        
        return this.getSmoothedValue();
    }

    /**
     * Get current smoothed value
     */
    getSmoothedValue() {
        if (this.dataBuffer.length === 0) return 0;
        
        const sum = this.dataBuffer.reduce((acc, val) => acc + val, 0);
        return sum / this.dataBuffer.length;
    }

    /**
     * Reset the filter
     */
    reset() {
        this.dataBuffer = [];
    }

    /**
     * Get buffer size
     */
    getBufferSize() {
        return this.dataBuffer.length;
    }

    /**
     * Check if buffer is full
     */
    isBufferFull() {
        return this.dataBuffer.length >= this.windowSize;
    }
}

/**
 * Speed Smoother
 * Specialized for smoothing speed/velocity data
 */
class SpeedSmoother {
    constructor(windowSize = 5) {
        this.positionFilter = new SmoothingFilter(windowSize);
        this.speedFilter = new SmoothingFilter(windowSize);
        this.previousPosition = null;
        this.previousTime = null;
        this.maxSpeed = 0;
        this.speedHistory = [];
    }

    /**
     * Add position data and get smoothed speed
     */
    addPosition(position, timestamp) {
        // Smooth the position first
        const smoothedX = this.positionFilter.addValue(position.x);
        const smoothedPosition = { x: smoothedX, y: position.y };
        
        let speed = 0;
        
        if (this.previousPosition && this.previousTime) {
            const dt = timestamp - this.previousTime;
            if (dt > 0) {
                const dx = smoothedPosition.x - this.previousPosition.x;
                const dy = smoothedPosition.y - this.previousPosition.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                speed = distance / dt;
            }
        }
        
        // Smooth the speed
        const smoothedSpeed = this.speedFilter.addValue(speed);
        
        // Track maximum speed
        if (smoothedSpeed > this.maxSpeed) {
            this.maxSpeed = smoothedSpeed;
        }
        
        // Store in history
        this.speedHistory.push({
            time: timestamp,
            speed: smoothedSpeed,
            position: smoothedPosition
        });
        
        // Update previous values
        this.previousPosition = smoothedPosition;
        this.previousTime = timestamp;
        
        return smoothedSpeed;
    }

    /**
     * Get maximum recorded speed
     */
    getMaxSpeed() {
        return this.maxSpeed;
    }

    /**
     * Get speed history
     */
    getSpeedHistory() {
        return [...this.speedHistory];
    }

    /**
     * Get average speed over a time period
     */
    getAverageSpeed(startTime, endTime) {
        const relevantData = this.speedHistory.filter(
            entry => entry.time >= startTime && entry.time <= endTime
        );
        
        if (relevantData.length === 0) return 0;
        
        const totalSpeed = relevantData.reduce((sum, entry) => sum + entry.speed, 0);
        return totalSpeed / relevantData.length;
    }

    /**
     * Reset the smoother
     */
    reset() {
        this.positionFilter.reset();
        this.speedFilter.reset();
        this.previousPosition = null;
        this.previousTime = null;
        this.maxSpeed = 0;
        this.speedHistory = [];
    }
}

/**
 * Acceleration Calculator
 * Calculates acceleration from speed data
 */
class AccelerationCalculator {
    constructor(windowSize = 3) {
        this.speedHistory = [];
        this.windowSize = windowSize;
    }

    /**
     * Add speed data point and calculate acceleration
     */
    addSpeed(speed, timestamp) {
        this.speedHistory.push({ speed, timestamp });
        
        // Keep only recent data
        if (this.speedHistory.length > this.windowSize * 2) {
            this.speedHistory.shift();
        }
        
        return this.calculateAcceleration();
    }

    /**
     * Calculate current acceleration
     */
    calculateAcceleration() {
        if (this.speedHistory.length < 2) return 0;
        
        // Use linear regression for more stable acceleration calculation
        const n = Math.min(this.speedHistory.length, this.windowSize);
        const recentData = this.speedHistory.slice(-n);
        
        if (recentData.length < 2) return 0;
        
        // Simple two-point acceleration
        const latest = recentData[recentData.length - 1];
        const previous = recentData[recentData.length - 2];
        
        const dt = latest.timestamp - previous.timestamp;
        if (dt <= 0) return 0;
        
        return (latest.speed - previous.speed) / dt;
    }

    /**
     * Get average acceleration over time period
     */
    getAverageAcceleration(startTime, endTime) {
        const relevantData = this.speedHistory.filter(
            entry => entry.timestamp >= startTime && entry.timestamp <= endTime
        );
        
        if (relevantData.length < 2) return 0;
        
        const firstPoint = relevantData[0];
        const lastPoint = relevantData[relevantData.length - 1];
        
        const dt = lastPoint.timestamp - firstPoint.timestamp;
        if (dt <= 0) return 0;
        
        return (lastPoint.speed - firstPoint.speed) / dt;
    }

    /**
     * Reset calculator
     */
    reset() {
        this.speedHistory = [];
    }
}

/**
 * Utility functions for smoothing arrays of data
 */
class SmoothingUtils {
    /**
     * Apply moving average to array of values
     */
    static movingAverage(data, windowSize = 5) {
        if (data.length === 0) return [];
        
        const result = [];
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - halfWindow);
            const end = Math.min(data.length - 1, i + halfWindow);
            
            let sum = 0;
            let count = 0;
            
            for (let j = start; j <= end; j++) {
                sum += data[j];
                count++;
            }
            
            result.push(sum / count);
        }
        
        return result;
    }

    /**
     * Apply exponential smoothing
     */
    static exponentialSmoothing(data, alpha = 0.3) {
        if (data.length === 0) return [];
        
        const result = [data[0]];
        
        for (let i = 1; i < data.length; i++) {
            const smoothed = alpha * data[i] + (1 - alpha) * result[i - 1];
            result.push(smoothed);
        }
        
        return result;
    }

    /**
     * Remove outliers using median filter
     */
    static medianFilter(data, windowSize = 5) {
        if (data.length === 0) return [];
        
        const result = [];
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - halfWindow);
            const end = Math.min(data.length - 1, i + halfWindow);
            
            const window = data.slice(start, end + 1).sort((a, b) => a - b);
            const median = window[Math.floor(window.length / 2)];
            
            result.push(median);
        }
        
        return result;
    }
}