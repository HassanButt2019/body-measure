/**
 * Pose Detector
 * Handles MediaPipe Pose detection and landmark processing
 */
class PoseDetector {
    constructor() {
        this.pose = null;
        this.isInitialized = false;
        
        // Callbacks
        this.onPoseDetected = null;
        this.onDetectionError = null;
        
        this.initializePoseDetector();
    }

    /**
     * Initialize MediaPipe Pose detector
     */
    async initializePoseDetector() {
        try {
            this.pose = new Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                }
            });

            // Configure pose detection options
            this.pose.setOptions({
                modelComplexity: 1, // 0, 1, or 2 (higher = more accurate but slower)
                smoothLandmarks: true,
                enableSegmentation: false, // We don't need segmentation for measurements
                smoothSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            // Set up results callback
            this.pose.onResults((results) => {
                this.handlePoseResults(results);
            });

            this.isInitialized = true;
            console.log('Pose detector initialized successfully');

        } catch (error) {
            console.error('Failed to initialize pose detector:', error);
            if (this.onDetectionError) {
                this.onDetectionError('Failed to initialize pose detection. Please check your internet connection.');
            }
        }
    }

    /**
     * Detect pose from image data
     */
    async detectPose(capturedPhoto) {
        if (!this.isInitialized || !this.pose) {
            throw new Error('Pose detector not initialized');
        }

        try {
            // Store reference to the image data for callback
            this.currentImageData = capturedPhoto;
            
            // Send image to MediaPipe
            await this.pose.send({ image: capturedPhoto.canvas });
            
        } catch (error) {
            console.error('Pose detection error:', error);
            if (this.onDetectionError) {
                this.onDetectionError('Failed to process image for pose detection');
            }
        }
    }

    /**
     * Detect pose from canvas data
     */
    async detectFromCanvas(canvas) {
        if (!this.isInitialized || !this.pose) {
            throw new Error('Pose detector not initialized');
        }

        try {
            // Send canvas directly to MediaPipe
            await this.pose.send({ image: canvas });
        } catch (error) {
            console.error('Canvas pose detection error:', error);
            if (this.onDetectionError) {
                this.onDetectionError('Failed to process canvas for pose detection');
            }
        }
    }

    /**
     * Handle pose detection results
     */
    handlePoseResults(results) {
        try {
            if (this.onPoseDetected && this.currentImageData) {
                this.onPoseDetected(results, this.currentImageData);
            }
        } catch (error) {
            console.error('Error handling pose results:', error);
            if (this.onDetectionError) {
                this.onDetectionError('Failed to process pose detection results');
            }
        }
    }

    /**
     * Get landmark by name
     */
    static getLandmarkByName(landmarks, landmarkName) {
        const landmarkIndices = {
            // Head and face
            'nose': 0,
            'left_eye_inner': 1,
            'left_eye': 2,
            'left_eye_outer': 3,
            'right_eye_inner': 4,
            'right_eye': 5,
            'right_eye_outer': 6,
            'left_ear': 7,
            'right_ear': 8,
            'mouth_left': 9,
            'mouth_right': 10,
            
            // Upper body
            'left_shoulder': 11,
            'right_shoulder': 12,
            'left_elbow': 13,
            'right_elbow': 14,
            'left_wrist': 15,
            'right_wrist': 16,
            'left_pinky': 17,
            'right_pinky': 18,
            'left_index': 19,
            'right_index': 20,
            'left_thumb': 21,
            'right_thumb': 22,
            
            // Lower body
            'left_hip': 23,
            'right_hip': 24,
            'left_knee': 25,
            'right_knee': 26,
            'left_ankle': 27,
            'right_ankle': 28,
            'left_heel': 29,
            'right_heel': 30,
            'left_foot_index': 31,
            'right_foot_index': 32
        };

        const index = landmarkIndices[landmarkName];
        return index !== undefined ? landmarks[index] : null;
    }

    /**
     * Get key landmarks for body measurements
     */
    static getBodyMeasurementLandmarks(landmarks) {
        return {
            // Left side landmarks
            leftShoulder: this.getLandmarkByName(landmarks, 'left_shoulder'),
            leftElbow: this.getLandmarkByName(landmarks, 'left_elbow'),
            leftWrist: this.getLandmarkByName(landmarks, 'left_wrist'),
            leftHip: this.getLandmarkByName(landmarks, 'left_hip'),
            leftKnee: this.getLandmarkByName(landmarks, 'left_knee'),
            leftAnkle: this.getLandmarkByName(landmarks, 'left_ankle'),
            
            // Right side landmarks
            rightShoulder: this.getLandmarkByName(landmarks, 'right_shoulder'),
            rightElbow: this.getLandmarkByName(landmarks, 'right_elbow'),
            rightWrist: this.getLandmarkByName(landmarks, 'right_wrist'),
            rightHip: this.getLandmarkByName(landmarks, 'right_hip'),
            rightKnee: this.getLandmarkByName(landmarks, 'right_knee'),
            rightAnkle: this.getLandmarkByName(landmarks, 'right_ankle'),
            
            // Reference points for height estimation
            nose: this.getLandmarkByName(landmarks, 'nose'),
            leftHeel: this.getLandmarkByName(landmarks, 'left_heel'),
            rightHeel: this.getLandmarkByName(landmarks, 'right_heel')
        };
    }

    /**
     * Validate landmark quality
     */
    static validateLandmark(landmark, minVisibility = 0.5) {
        return landmark && 
               landmark.visibility !== undefined && 
               landmark.visibility >= minVisibility &&
               landmark.x >= 0 && landmark.x <= 1 &&
               landmark.y >= 0 && landmark.y <= 1;
    }

    /**
     * Calculate distance between two landmarks in pixels
     */
    static calculatePixelDistance(landmark1, landmark2, imageWidth, imageHeight) {
        if (!this.validateLandmark(landmark1) || !this.validateLandmark(landmark2)) {
            return null;
        }

        const x1 = landmark1.x * imageWidth;
        const y1 = landmark1.y * imageHeight;
        const x2 = landmark2.x * imageWidth;
        const y2 = landmark2.y * imageHeight;

        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    /**
     * Get the best visible side for measurements
     */
    static getBestSideForMeasurement(landmarks) {
        const bodyLandmarks = this.getBodyMeasurementLandmarks(landmarks);
        
        // Calculate visibility scores for both sides
        const leftSideScore = this.calculateSideVisibilityScore([
            bodyLandmarks.leftShoulder,
            bodyLandmarks.leftElbow,
            bodyLandmarks.leftWrist,
            bodyLandmarks.leftHip,
            bodyLandmarks.leftKnee,
            bodyLandmarks.leftAnkle
        ]);

        const rightSideScore = this.calculateSideVisibilityScore([
            bodyLandmarks.rightShoulder,
            bodyLandmarks.rightElbow,
            bodyLandmarks.rightWrist,
            bodyLandmarks.rightHip,
            bodyLandmarks.rightKnee,
            bodyLandmarks.rightAnkle
        ]);

        return leftSideScore >= rightSideScore ? 'left' : 'right';
    }

    /**
     * Calculate visibility score for a side
     */
    static calculateSideVisibilityScore(landmarks) {
        let score = 0;
        let count = 0;

        landmarks.forEach(landmark => {
            if (this.validateLandmark(landmark)) {
                score += landmark.visibility;
                count++;
            }
        });

        return count > 0 ? score / count : 0;
    }
}
