/**
 * Ball Tracker
 * Simple motion and circularity detection for ball tracking
 */
class BallTracker {
    constructor() {
        this.isTracking = false;
        this.ballHistory = [];
        this.detectionThreshold = {
            minRadius: 5,
            maxRadius: 50,
            minSpeed: 1,
            maxSpeed: 100,
            circularity: 0.7
        };
        this.lastDetectedBall = null;
        this.trackingId = 0;
    }

    /**
     * Start ball tracking
     */
    startTracking() {
        this.isTracking = true;
        this.ballHistory = [];
        this.lastDetectedBall = null;
        this.trackingId++;
        console.log('Ball tracking started');
    }

    /**
     * Stop ball tracking
     */
    stopTracking() {
        this.isTracking = false;
        console.log('Ball tracking stopped');
    }

    /**
     * Detect ball in image data using simple motion detection
     */
    detectBall(imageData, timestamp) {
        if (!this.isTracking) return null;

        // Simple ball detection based on motion and shape
        const ballCandidates = this.findMotionBlobs(imageData);
        const bestCandidate = this.selectBestBallCandidate(ballCandidates, timestamp);
        
        if (bestCandidate) {
            this.ballHistory.push({
                position: bestCandidate.position,
                radius: bestCandidate.radius,
                timestamp: timestamp,
                confidence: bestCandidate.confidence
            });
            
            this.lastDetectedBall = bestCandidate;
            return bestCandidate;
        }
        
        return null;
    }

    /**
     * Find motion blobs that could be a ball
     */
    findMotionBlobs(imageData) {
        // This is a simplified implementation
        // In a real application, you would use more sophisticated computer vision
        
        const candidates = [];
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        
        // Simple edge detection and blob finding
        // This is a placeholder - real implementation would be more complex
        
        // For demo purposes, we'll simulate ball detection
        // In practice, you'd use techniques like:
        // - Background subtraction
        // - Circular Hough transform
        // - Color-based detection
        // - Motion vectors
        
        if (this.lastDetectedBall) {
            // Predict next position based on previous motion
            const predicted = this.predictNextPosition();
            if (predicted) {
                candidates.push({
                    position: predicted.position,
                    radius: predicted.radius,
                    confidence: 0.8
                });
            }
        }
        
        return candidates;
    }

    /**
     * Predict next ball position based on motion history
     */
    predictNextPosition() {
        if (this.ballHistory.length < 2) return null;
        
        const recent = this.ballHistory.slice(-3);
        const latest = recent[recent.length - 1];
        const previous = recent[recent.length - 2];
        
        // Simple linear prediction
        const dt = latest.timestamp - previous.timestamp;
        const vx = (latest.position.x - previous.position.x) / dt;
        const vy = (latest.position.y - previous.position.y) / dt;
        
        // Predict position for next frame (assuming ~16ms frame time)
        const predictedX = latest.position.x + vx * 16;
        const predictedY = latest.position.y + vy * 16;
        
        return {
            position: { x: predictedX, y: predictedY },
            radius: latest.radius,
            velocity: { x: vx, y: vy }
        };
    }

    /**
     * Select best ball candidate from detected blobs
     */
    selectBestBallCandidate(candidates, timestamp) {
        if (candidates.length === 0) return null;
        
        let bestCandidate = null;
        let bestScore = 0;
        
        for (const candidate of candidates) {
            const score = this.scoreBallCandidate(candidate, timestamp);
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }
        
        return bestScore > 0.5 ? bestCandidate : null;
    }

    /**
     * Score a ball candidate based on various criteria
     */
    scoreBallCandidate(candidate, timestamp) {
        let score = candidate.confidence || 0.5;
        
        // Check radius constraints
        if (candidate.radius < this.detectionThreshold.minRadius || 
            candidate.radius > this.detectionThreshold.maxRadius) {
            score *= 0.5;
        }
        
        // Check motion consistency if we have history
        if (this.ballHistory.length > 0) {
            const motionScore = this.evaluateMotionConsistency(candidate, timestamp);
            score *= motionScore;
        }
        
        // Check if position is reasonable (not at edges, etc.)
        const positionScore = this.evaluatePosition(candidate.position);
        score *= positionScore;
        
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Evaluate motion consistency with previous detections
     */
    evaluateMotionConsistency(candidate, timestamp) {
        if (this.ballHistory.length === 0) return 1.0;
        
        const latest = this.ballHistory[this.ballHistory.length - 1];
        const dt = timestamp - latest.timestamp;
        
        if (dt <= 0) return 0.5;
        
        // Calculate speed
        const dx = candidate.position.x - latest.position.x;
        const dy = candidate.position.y - latest.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = distance / dt;
        
        // Check if speed is reasonable
        if (speed < this.detectionThreshold.minSpeed || 
            speed > this.detectionThreshold.maxSpeed) {
            return 0.3;
        }
        
        // Check direction consistency if we have enough history
        if (this.ballHistory.length >= 2) {
            const directionScore = this.evaluateDirectionConsistency(candidate);
            return directionScore;
        }
        
        return 0.8;
    }

    /**
     * Evaluate direction consistency
     */
    evaluateDirectionConsistency(candidate) {
        if (this.ballHistory.length < 2) return 1.0;
        
        const latest = this.ballHistory[this.ballHistory.length - 1];
        const previous = this.ballHistory[this.ballHistory.length - 2];
        
        // Previous direction
        const prevDx = latest.position.x - previous.position.x;
        const prevDy = latest.position.y - previous.position.y;
        
        // Current direction
        const currDx = candidate.position.x - latest.position.x;
        const currDy = candidate.position.y - latest.position.y;
        
        // Calculate angle between directions
        const prevMag = Math.sqrt(prevDx * prevDx + prevDy * prevDy);
        const currMag = Math.sqrt(currDx * currDx + currDy * currDy);
        
        if (prevMag === 0 || currMag === 0) return 0.5;
        
        const dotProduct = (prevDx * currDx + prevDy * currDy) / (prevMag * currMag);
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        
        // Prefer consistent direction (small angle change)
        const maxAngleChange = Math.PI / 4; // 45 degrees
        return Math.max(0.2, 1.0 - (angle / maxAngleChange));
    }

    /**
     * Evaluate position reasonableness
     */
    evaluatePosition(position) {
        // Simple bounds checking
        // In practice, you'd consider camera view, field boundaries, etc.
        
        if (position.x < 0 || position.y < 0) return 0.1;
        
        // Assume reasonable image dimensions
        if (position.x > 1000 || position.y > 1000) return 0.1;
        
        return 1.0;
    }

    /**
     * Get ball trajectory data
     */
    getBallTrajectory() {
        return [...this.ballHistory];
    }

    /**
     * Get current ball velocity
     */
    getCurrentVelocity() {
        if (this.ballHistory.length < 2) return null;
        
        const latest = this.ballHistory[this.ballHistory.length - 1];
        const previous = this.ballHistory[this.ballHistory.length - 2];
        
        const dt = latest.timestamp - previous.timestamp;
        if (dt <= 0) return null;
        
        const dx = latest.position.x - previous.position.x;
        const dy = latest.position.y - previous.position.y;
        
        return {
            x: dx / dt,
            y: dy / dt,
            magnitude: Math.sqrt(dx * dx + dy * dy) / dt
        };
    }

    /**
     * Get average ball speed over time period
     */
    getAverageSpeed(startTime, endTime) {
        const relevantHistory = this.ballHistory.filter(
            entry => entry.timestamp >= startTime && entry.timestamp <= endTime
        );
        
        if (relevantHistory.length < 2) return 0;
        
        let totalDistance = 0;
        let totalTime = 0;
        
        for (let i = 1; i < relevantHistory.length; i++) {
            const curr = relevantHistory[i];
            const prev = relevantHistory[i - 1];
            
            const dx = curr.position.x - prev.position.x;
            const dy = curr.position.y - prev.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const dt = curr.timestamp - prev.timestamp;
            
            totalDistance += distance;
            totalTime += dt;
        }
        
        return totalTime > 0 ? totalDistance / totalTime : 0;
    }

    /**
     * Clear tracking history
     */
    clearHistory() {
        this.ballHistory = [];
        this.lastDetectedBall = null;
    }

    /**
     * Get tracking statistics
     */
    getTrackingStats() {
        return {
            totalDetections: this.ballHistory.length,
            trackingDuration: this.ballHistory.length > 0 ? 
                this.ballHistory[this.ballHistory.length - 1].timestamp - this.ballHistory[0].timestamp : 0,
            averageConfidence: this.ballHistory.length > 0 ?
                this.ballHistory.reduce((sum, entry) => sum + entry.confidence, 0) / this.ballHistory.length : 0
        };
    }
}