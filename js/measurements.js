/**
 * Measurement Calculator
 * Handles body segment measurement calculations and pixel-to-cm conversions
 */
class MeasurementCalculator {
    constructor() {
        // Standard body proportions for validation (approximate)
        this.standardProportions = {
            upperArmToHeight: 0.186, // Upper arm is typically ~18.6% of height
            forearmToHeight: 0.146,  // Forearm is typically ~14.6% of height
            thighToHeight: 0.245,    // Thigh is typically ~24.5% of height
            shinToHeight: 0.246      // Shin is typically ~24.6% of height
        };
    }

    /**
     * Calculate all body segment measurements
     */
    calculateMeasurements(poseLandmarks, userHeight, imageWidth, imageHeight) {
        const bodyLandmarks = PoseDetector.getBodyMeasurementLandmarks(poseLandmarks);
        
        // Calculate pixel-to-cm ratio
        const pixelToCmRatio = this.calculatePixelToCmRatio(
            bodyLandmarks, 
            userHeight, 
            imageWidth, 
            imageHeight
        );

        if (!pixelToCmRatio) {
            throw new Error('Could not determine scale from detected pose');
        }

        // Determine which side of the body to use for measurements
        const bestSide = PoseDetector.getBestSideForMeasurement(poseLandmarks);
        
        // Calculate segment measurements
        const segments = this.calculateSegmentLengths(
            bodyLandmarks, 
            bestSide, 
            pixelToCmRatio,
            imageWidth,
            imageHeight
        );

        // Validate measurements
        const validatedSegments = this.validateMeasurements(segments, userHeight);

        return {
            segments: validatedSegments,
            pixelToCmRatio: pixelToCmRatio,
            usedSide: bestSide,
            bodyLandmarks: bodyLandmarks,
            timestamp: Date.now(),
            userHeight: userHeight
        };
    }

    /**
     * Calculate pixel-to-cm ratio using detected body height
     */
    calculatePixelToCmRatio(bodyLandmarks, userHeight, imageWidth, imageHeight) {
        // Try multiple methods to estimate body height in pixels
        const heightMethods = [
            this.getHeightFromNoseToFeet(bodyLandmarks, imageWidth, imageHeight),
            this.getHeightFromShoulderToFeet(bodyLandmarks, imageWidth, imageHeight),
            this.getHeightFromHipToHead(bodyLandmarks, imageWidth, imageHeight)
        ];

        // Use the first valid height measurement
        for (const pixelHeight of heightMethods) {
            if (pixelHeight && pixelHeight > 100) { // Reasonable minimum pixel height
                return userHeight / pixelHeight;
            }
        }

        return null;
    }

    /**
     * Get height from nose to feet
     */
    getHeightFromNoseToFeet(bodyLandmarks, imageWidth, imageHeight) {
        const { nose, leftHeel, rightHeel } = bodyLandmarks;
        
        if (!PoseDetector.validateLandmark(nose)) return null;

        // Use the heel that's most visible
        let heel = null;
        if (PoseDetector.validateLandmark(leftHeel) && PoseDetector.validateLandmark(rightHeel)) {
            heel = leftHeel.visibility >= rightHeel.visibility ? leftHeel : rightHeel;
        } else if (PoseDetector.validateLandmark(leftHeel)) {
            heel = leftHeel;
        } else if (PoseDetector.validateLandmark(rightHeel)) {
            heel = rightHeel;
        }

        if (!heel) return null;

        return PoseDetector.calculatePixelDistance(nose, heel, imageWidth, imageHeight);
    }

    /**
     * Get height from shoulder to feet
     */
    getHeightFromShoulderToFeet(bodyLandmarks, imageWidth, imageHeight) {
        const { leftShoulder, rightShoulder, leftAnkle, rightAnkle } = bodyLandmarks;
        
        // Get the most visible shoulder
        let shoulder = null;
        if (PoseDetector.validateLandmark(leftShoulder) && PoseDetector.validateLandmark(rightShoulder)) {
            shoulder = leftShoulder.visibility >= rightShoulder.visibility ? leftShoulder : rightShoulder;
        } else if (PoseDetector.validateLandmark(leftShoulder)) {
            shoulder = leftShoulder;
        } else if (PoseDetector.validateLandmark(rightShoulder)) {
            shoulder = rightShoulder;
        }

        // Get the most visible ankle
        let ankle = null;
        if (PoseDetector.validateLandmark(leftAnkle) && PoseDetector.validateLandmark(rightAnkle)) {
            ankle = leftAnkle.visibility >= rightAnkle.visibility ? leftAnkle : rightAnkle;
        } else if (PoseDetector.validateLandmark(leftAnkle)) {
            ankle = leftAnkle;
        } else if (PoseDetector.validateLandmark(rightAnkle)) {
            ankle = rightAnkle;
        }

        if (!shoulder || !ankle) return null;

        // Add estimated head height (shoulder to top of head is ~13% of total height)
        const shoulderToAnkle = PoseDetector.calculatePixelDistance(shoulder, ankle, imageWidth, imageHeight);
        return shoulderToAnkle ? shoulderToAnkle * 1.15 : null; // Add 15% for head
    }

    /**
     * Get height from hip to estimated head top
     */
    getHeightFromHipToHead(bodyLandmarks, imageWidth, imageHeight) {
        const { leftHip, rightHip, nose } = bodyLandmarks;
        
        // Get the most visible hip
        let hip = null;
        if (PoseDetector.validateLandmark(leftHip) && PoseDetector.validateLandmark(rightHip)) {
            hip = leftHip.visibility >= rightHip.visibility ? leftHip : rightHip;
        } else if (PoseDetector.validateLandmark(leftHip)) {
            hip = leftHip;
        } else if (PoseDetector.validateLandmark(rightHip)) {
            hip = rightHip;
        }

        if (!hip || !PoseDetector.validateLandmark(nose)) return null;

        // Hip to nose is roughly 30% of total height, so multiply by ~3.33
        const hipToNose = PoseDetector.calculatePixelDistance(hip, nose, imageWidth, imageHeight);
        return hipToNose ? hipToNose * 3.33 : null;
    }

    /**
     * Calculate segment lengths for the specified side
     */
    calculateSegmentLengths(bodyLandmarks, side, pixelToCmRatio, imageWidth, imageHeight) {
        const isLeft = side === 'left';
        
        const shoulder = isLeft ? bodyLandmarks.leftShoulder : bodyLandmarks.rightShoulder;
        const elbow = isLeft ? bodyLandmarks.leftElbow : bodyLandmarks.rightElbow;
        const wrist = isLeft ? bodyLandmarks.leftWrist : bodyLandmarks.rightWrist;
        const hip = isLeft ? bodyLandmarks.leftHip : bodyLandmarks.rightHip;
        const knee = isLeft ? bodyLandmarks.leftKnee : bodyLandmarks.rightKnee;
        const ankle = isLeft ? bodyLandmarks.leftAnkle : bodyLandmarks.rightAnkle;

        const segments = {};

        // Upper arm (shoulder to elbow)
        const upperArmPixels = PoseDetector.calculatePixelDistance(shoulder, elbow, imageWidth, imageHeight);
        segments.upperArm = upperArmPixels ? upperArmPixels * pixelToCmRatio : null;

        // Forearm (elbow to wrist)
        const forearmPixels = PoseDetector.calculatePixelDistance(elbow, wrist, imageWidth, imageHeight);
        segments.forearm = forearmPixels ? forearmPixels * pixelToCmRatio : null;

        // Thigh (hip to knee)
        const thighPixels = PoseDetector.calculatePixelDistance(hip, knee, imageWidth, imageHeight);
        segments.thigh = thighPixels ? thighPixels * pixelToCmRatio : null;

        // Shin (knee to ankle)
        const shinPixels = PoseDetector.calculatePixelDistance(knee, ankle, imageWidth, imageHeight);
        segments.shin = shinPixels ? shinPixels * pixelToCmRatio : null;

        return segments;
    }

    /**
     * Validate measurements against standard body proportions
     */
    validateMeasurements(segments, userHeight) {
        const validatedSegments = { ...segments };
        const warnings = [];

        // Check each segment against standard proportions
        Object.keys(segments).forEach(segmentName => {
            const measurement = segments[segmentName];
            if (!measurement) return;

            const standardProportion = this.standardProportions[segmentName + 'ToHeight'];
            if (!standardProportion) return;

            const expectedLength = userHeight * standardProportion;
            const ratio = measurement / expectedLength;

            // Flag measurements that are very far from expected (outside 0.7-1.3 range)
            if (ratio < 0.7 || ratio > 1.3) {
                warnings.push(`${segmentName} measurement (${measurement.toFixed(1)}cm) seems unusual for height ${userHeight}cm`);
                
                // For very extreme values, we might want to cap them
                if (ratio < 0.5) {
                    validatedSegments[segmentName] = expectedLength * 0.7; // Set to minimum reasonable value
                } else if (ratio > 2.0) {
                    validatedSegments[segmentName] = expectedLength * 1.3; // Set to maximum reasonable value
                }
            }
        });

        // Log warnings for debugging
        if (warnings.length > 0) {
            console.warn('Measurement validation warnings:', warnings);
        }

        return validatedSegments;
    }

    /**
     * Get measurement confidence score
     */
    getMeasurementConfidence(bodyLandmarks, usedSide) {
        const isLeft = usedSide === 'left';
        const landmarks = [
            isLeft ? bodyLandmarks.leftShoulder : bodyLandmarks.rightShoulder,
            isLeft ? bodyLandmarks.leftElbow : bodyLandmarks.rightElbow,
            isLeft ? bodyLandmarks.leftWrist : bodyLandmarks.rightWrist,
            isLeft ? bodyLandmarks.leftHip : bodyLandmarks.rightHip,
            isLeft ? bodyLandmarks.leftKnee : bodyLandmarks.rightKnee,
            isLeft ? bodyLandmarks.leftAnkle : bodyLandmarks.rightAnkle
        ];

        let totalConfidence = 0;
        let validLandmarks = 0;

        landmarks.forEach(landmark => {
            if (PoseDetector.validateLandmark(landmark)) {
                totalConfidence += landmark.visibility;
                validLandmarks++;
            }
        });

        return validLandmarks > 0 ? totalConfidence / validLandmarks : 0;
    }

    /**
     * Format measurements for display
     */
    static formatMeasurement(value, unit = 'cm', decimals = 1) {
        if (!value || value <= 0) return '-';
        return `${value.toFixed(decimals)} ${unit}`;
    }

    /**
     * Compare measurements with previous results
     */
    compareMeasurements(current, previous) {
        if (!previous) return null;

        const comparison = {};
        Object.keys(current.segments).forEach(segment => {
            const currentValue = current.segments[segment];
            const previousValue = previous.segments[segment];
            
            if (currentValue && previousValue) {
                const difference = currentValue - previousValue;
                const percentChange = (difference / previousValue) * 100;
                
                comparison[segment] = {
                    difference: difference,
                    percentChange: percentChange,
                    current: currentValue,
                    previous: previousValue
                };
            }
        });

        return comparison;
    }
}
