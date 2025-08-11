/**
 * Athletic Test Controllers
 * Handles the three athletic test modes
 */

/**
 * Base Athletic Test Controller
 */
class BaseAthleticTest {
    constructor(testType) {
        this.testType = testType;
        this.isRunning = false;
        this.isCalibrated = false;
        this.startTime = null;
        this.results = null;
        
        // Callbacks
        this.onTestComplete = null;
        this.onTestProgress = null;
        this.onCalibrationComplete = null;
    }

    /**
     * Start the test
     */
    startTest() {
        if (!this.isCalibrated) {
            throw new Error('Test must be calibrated first');
        }
        
        this.isRunning = true;
        this.startTime = performance.now();
        this.results = null;
        
        console.log(`${this.testType} test started`);
    }

    /**
     * Stop the test
     */
    stopTest() {
        this.isRunning = false;
        console.log(`${this.testType} test stopped`);
    }

    /**
     * Reset the test
     */
    resetTest() {
        this.isRunning = false;
        this.startTime = null;
        this.results = null;
        console.log(`${this.testType} test reset`);
    }

    /**
     * Process frame data (to be overridden)
     */
    processFrame(landmarks, timestamp, scale) {
        // Override in subclasses
    }

    /**
     * Get test results
     */
    getResults() {
        return this.results;
    }
}

/**
 * Standing Broad Jump Test Controller
 */
class BroadJumpTest extends BaseAthleticTest {
    constructor() {
        super('broad-jump');
        this.linesCalibrator = new LinesCalibrator();
        this.eventDetector = new EventDetector();
        this.landingDetected = false;
        this.landingTime = null;
        this.takeoffPosition = null;
        this.landingPosition = null;
        this.finalizationTimer = null;
    }

    /**
     * Start calibration
     */
    startCalibration(canvas) {
        this.linesCalibrator.onCalibrationComplete = (data) => {
            this.isCalibrated = true;
            if (this.onCalibrationComplete) {
                this.onCalibrationComplete(data);
            }
        };
        
        this.linesCalibrator.startCalibration('broad-jump', canvas);
    }

    /**
     * Process frame for broad jump detection
     */
    processFrame(landmarks, timestamp, scale) {
        if (!this.isRunning || !landmarks) return;

        // Get foot position (average of both feet)
        const leftFoot = PoseDetector.getLandmarkByName(landmarks, 'left_ankle');
        const rightFoot = PoseDetector.getLandmarkByName(landmarks, 'right_ankle');
        
        if (!PoseDetector.validateLandmark(leftFoot) || !PoseDetector.validateLandmark(rightFoot)) {
            return;
        }

        const footPosition = {
            x: (leftFoot.x + rightFoot.x) / 2,
            y: (leftFoot.y + rightFoot.y) / 2
        };

        // Convert to pixel coordinates
        const pixelPosition = {
            x: footPosition.x * scale.imageWidth,
            y: footPosition.y * scale.imageHeight
        };

        // Track position for event detection
        const prevData = this.eventDetector.trackPosition('jumper', pixelPosition, timestamp);

        if (prevData) {
            // Detect takeoff (leaving ground)
            if (!this.takeoffPosition) {
                const takeoff = this.eventDetector.detectTakeoff(
                    prevData.position, 
                    pixelPosition, 
                    scale.imageHeight * 0.8, // Assume ground level
                    2 // Minimum vertical speed
                );
                
                if (takeoff) {
                    this.takeoffPosition = pixelPosition;
                    console.log('Takeoff detected');
                    
                    if (this.onTestProgress) {
                        this.onTestProgress('Takeoff detected - tracking jump...');
                    }
                }
            }
            
            // Detect landing
            if (this.takeoffPosition && !this.landingDetected) {
                const landing = this.eventDetector.detectLanding(
                    prevData.position,
                    pixelPosition,
                    scale.imageHeight * 0.8, // Ground level
                    2 // Minimum vertical speed
                );
                
                if (landing) {
                    this.landingDetected = true;
                    this.landingTime = timestamp;
                    this.landingPosition = pixelPosition;
                    
                    console.log('Landing detected - finalizing in 1 second...');
                    
                    if (this.onTestProgress) {
                        this.onTestProgress('Landing detected - finalizing measurement...');
                    }
                    
                    // Finalize measurement after 1 second
                    this.finalizationTimer = setTimeout(() => {
                        this.finalizeMeasurement(scale);
                    }, 1000);
                }
            }
        }
    }

    /**
     * Finalize jump measurement
     */
    finalizeMeasurement(scale) {
        if (!this.takeoffPosition || !this.landingPosition) {
            console.error('Missing takeoff or landing position');
            return;
        }

        // Calculate jump distance using calibration
        const distance = this.linesCalibrator.getDistanceInMeters(
            this.takeoffPosition,
            this.landingPosition
        );

        if (distance === null) {
            console.error('Failed to calculate jump distance');
            return;
        }

        // Calculate takeoff speed (simplified)
        const jumpTime = this.landingTime - this.startTime;
        const takeoffSpeed = distance / (jumpTime / 1000); // m/s

        this.results = {
            distance: distance,
            takeoffSpeed: takeoffSpeed,
            jumpTime: jumpTime,
            takeoffPosition: this.takeoffPosition,
            landingPosition: this.landingPosition,
            timestamp: Date.now()
        };

        this.stopTest();

        if (this.onTestComplete) {
            this.onTestComplete(this.results);
        }

        console.log('Broad jump measurement complete:', this.results);
    }

    /**
     * Reset test
     */
    resetTest() {
        super.resetTest();
        this.landingDetected = false;
        this.landingTime = null;
        this.takeoffPosition = null;
        this.landingPosition = null;
        
        if (this.finalizationTimer) {
            clearTimeout(this.finalizationTimer);
            this.finalizationTimer = null;
        }
        
        this.eventDetector.clearTracking();
    }
}

/**
 * Sprint Test Controller (30m)
 */
class SprintTest extends BaseAthleticTest {
    constructor() {
        super('sprint');
        this.linesCalibrator = new LinesCalibrator();
        this.eventDetector = new EventDetector();
        this.speedSmoother = new SpeedSmoother(5);
        this.accelerationCalculator = new AccelerationCalculator(3);
        
        this.crossingTimes = { t0: null, t15: null, t30: null };
        this.crossingPositions = [0, 15, 30]; // meters
        this.nextCrossingIndex = 0;
    }

    /**
     * Start calibration
     */
    startCalibration(canvas) {
        this.linesCalibrator.onCalibrationComplete = (data) => {
            this.isCalibrated = true;
            if (this.onCalibrationComplete) {
                this.onCalibrationComplete(data);
            }
        };
        
        this.linesCalibrator.startCalibration('sprint', canvas);
    }

    /**
     * Process frame for sprint detection
     */
    processFrame(landmarks, timestamp, scale) {
        if (!this.isRunning || !landmarks) return;

        // Get runner position (center of hips)
        const leftHip = PoseDetector.getLandmarkByName(landmarks, 'left_hip');
        const rightHip = PoseDetector.getLandmarkByName(landmarks, 'right_hip');
        
        if (!PoseDetector.validateLandmark(leftHip) || !PoseDetector.validateLandmark(rightHip)) {
            return;
        }

        const runnerPosition = {
            x: (leftHip.x + rightHip.x) / 2,
            y: (leftHip.y + rightHip.y) / 2
        };

        // Convert to pixel coordinates
        const pixelPosition = {
            x: runnerPosition.x * scale.imageWidth,
            y: runnerPosition.y * scale.imageHeight
        };

        // Add to speed smoother
        const smoothedSpeed = this.speedSmoother.addPosition(pixelPosition, timestamp);
        
        // Convert speed to m/s using scale
        const speedMs = smoothedSpeed * scale.cmPerPx / 100;
        
        // Calculate acceleration
        this.accelerationCalculator.addSpeed(speedMs, timestamp);

        // Track position for line crossing detection
        const prevData = this.eventDetector.trackPosition('runner', pixelPosition, timestamp);

        if (prevData && this.nextCrossingIndex < this.crossingPositions.length) {
            // Check for line crossing
            const targetMeters = this.crossingPositions[this.nextCrossingIndex];
            const targetPixelPos = this.linesCalibrator.projectMToPx(targetMeters);
            
            if (targetPixelPos) {
                // Create vertical line at target position
                const line = {
                    p1: { x: targetPixelPos.x, y: 0 },
                    p2: { x: targetPixelPos.x, y: scale.imageHeight }
                };
                
                const crossing = this.eventDetector.detectLineCrossing(
                    prevData.position,
                    pixelPosition,
                    line,
                    prevData.timestamp,
                    timestamp
                );
                
                if (crossing && crossing.crossed) {
                    this.recordCrossing(this.nextCrossingIndex, crossing.time);
                    this.nextCrossingIndex++;
                    
                    if (this.nextCrossingIndex >= this.crossingPositions.length) {
                        this.finalizeSprint();
                    }
                }
            }
        }
    }

    /**
     * Record line crossing time
     */
    recordCrossing(index, time) {
        const relativeTime = time - this.startTime;
        
        switch (index) {
            case 0:
                this.crossingTimes.t0 = relativeTime;
                console.log('0m line crossed at', relativeTime, 'ms');
                break;
            case 1:
                this.crossingTimes.t15 = relativeTime;
                console.log('15m line crossed at', relativeTime, 'ms');
                break;
            case 2:
                this.crossingTimes.t30 = relativeTime;
                console.log('30m line crossed at', relativeTime, 'ms');
                break;
        }
        
        if (this.onTestProgress) {
            this.onTestProgress(`${this.crossingPositions[index]}m: ${(relativeTime / 1000).toFixed(2)}s`);
        }
    }

    /**
     * Finalize sprint measurement
     */
    finalizeSprint() {
        const t0 = this.crossingTimes.t0 / 1000; // Convert to seconds
        const t15 = this.crossingTimes.t15 / 1000;
        const t30 = this.crossingTimes.t30 / 1000;
        
        // Calculate splits
        const split0to15 = t15 - t0;
        const split15to30 = t30 - t15;
        const totalTime = t30 - t0;
        
        // Calculate speeds and accelerations
        const avgSpeed0to30 = 30 / totalTime; // m/s
        const maxSpeed = this.speedSmoother.getMaxSpeed();
        const avgAccel0to15 = 15 / (split0to15 * split0to15); // m/s²
        const avgAccel15to30 = 15 / (split15to30 * split15to30); // m/s²
        
        this.results = {
            splits: {
                '0-15m': split0to15,
                '15-30m': split15to30
            },
            totalTime: totalTime,
            avgSpeedTotal: avgSpeed0to30,
            maxSpeed: maxSpeed,
            avgAccel0to15: avgAccel0to15,
            avgAccel15to30: avgAccel15to30,
            crossingTimes: { ...this.crossingTimes },
            speedHistory: this.speedSmoother.getSpeedHistory(),
            timestamp: Date.now()
        };

        this.stopTest();

        if (this.onTestComplete) {
            this.onTestComplete(this.results);
        }

        console.log('Sprint test complete:', this.results);
    }

    /**
     * Reset test
     */
    resetTest() {
        super.resetTest();
        this.crossingTimes = { t0: null, t15: null, t30: null };
        this.nextCrossingIndex = 0;
        this.speedSmoother.reset();
        this.accelerationCalculator.reset();
        this.eventDetector.clearTracking();
    }
}

/**
 * Kick Power Test Controller (10m)
 */
class KickTest extends BaseAthleticTest {
    constructor() {
        super('kick');
        this.linesCalibrator = new LinesCalibrator();
        this.ballTracker = new BallTracker();
        this.eventDetector = new EventDetector();
        
        this.ballDetected = false;
        this.startLineTime = null;
        this.endLineTime = null;
        this.ballSpeed = null;
    }

    /**
     * Start calibration
     */
    startCalibration(canvas) {
        this.linesCalibrator.onCalibrationComplete = (data) => {
            this.isCalibrated = true;
            if (this.onCalibrationComplete) {
                this.onCalibrationComplete(data);
            }
        };
        
        this.linesCalibrator.startCalibration('kick', canvas);
    }

    /**
     * Start test
     */
    startTest() {
        super.startTest();
        this.ballTracker.startTracking();
    }

    /**
     * Process frame for kick power detection
     */
    processFrame(landmarks, timestamp, scale, imageData) {
        if (!this.isRunning) return;

        // Detect ball in frame
        const ball = this.ballTracker.detectBall(imageData, timestamp);
        
        if (ball) {
            if (!this.ballDetected) {
                this.ballDetected = true;
                console.log('Ball detected, tracking trajectory...');
                
                if (this.onTestProgress) {
                    this.onTestProgress('Ball detected - tracking speed...');
                }
            }

            // Track ball position for line crossings
            const prevData = this.eventDetector.trackPosition('ball', ball.position, timestamp);
            
            if (prevData) {
                // Check for 0m line crossing
                if (!this.startLineTime) {
                    const startLine = this.linesCalibrator.projectMToPx(0);
                    if (startLine) {
                        const crossing = this.eventDetector.detectVerticalLineCrossing(
                            prevData.position,
                            ball.position,
                            startLine.x,
                            prevData.timestamp,
                            timestamp
                        );
                        
                        if (crossing && crossing.crossed) {
                            this.startLineTime = crossing.time;
                            console.log('Ball crossed 0m line at', crossing.time);
                            
                            if (this.onTestProgress) {
                                this.onTestProgress('Ball crossed start line...');
                            }
                        }
                    }
                }
                
                // Check for 10m line crossing
                if (this.startLineTime && !this.endLineTime) {
                    const endLine = this.linesCalibrator.projectMToPx(10);
                    if (endLine) {
                        const crossing = this.eventDetector.detectVerticalLineCrossing(
                            prevData.position,
                            ball.position,
                            endLine.x,
                            prevData.timestamp,
                            timestamp
                        );
                        
                        if (crossing && crossing.crossed) {
                            this.endLineTime = crossing.time;
                            this.finalizeMeasurement();
                        }
                    }
                }
            }
        }
    }

    /**
     * Finalize kick measurement
     */
    finalizeMeasurement() {
        if (!this.startLineTime || !this.endLineTime) {
            console.error('Missing line crossing times');
            return;
        }

        const flightTime = (this.endLineTime - this.startLineTime) / 1000; // seconds
        const distance = 10; // meters
        const ballSpeedMs = distance / flightTime; // m/s
        const ballSpeedKmh = ballSpeedMs * 3.6; // km/h

        this.results = {
            ballSpeed: ballSpeedMs,
            ballSpeedKmh: ballSpeedKmh,
            flightTime: flightTime,
            startLineTime: this.startLineTime,
            endLineTime: this.endLineTime,
            ballTrajectory: this.ballTracker.getBallTrajectory(),
            timestamp: Date.now()
        };

        this.stopTest();
        this.ballTracker.stopTracking();

        if (this.onTestComplete) {
            this.onTestComplete(this.results);
        }

        console.log('Kick power test complete:', this.results);
    }

    /**
     * Stop test
     */
    stopTest() {
        super.stopTest();
        this.ballTracker.stopTracking();
    }

    /**
     * Reset test
     */
    resetTest() {
        super.resetTest();
        this.ballDetected = false;
        this.startLineTime = null;
        this.endLineTime = null;
        this.ballSpeed = null;
        this.ballTracker.clearHistory();
        this.eventDetector.clearTracking();
    }
}