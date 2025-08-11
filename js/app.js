/**
 * Main Application Controller
 * Coordinates all modules and manages application state
 */
class BodyMeasurementApp {
    constructor() {
        this.userHeight = null;
        this.currentMeasurements = null;
        this.poseDetector = null;
        this.camera = null;
        this.storage = null;
        this.canvasRenderer = null;
        this.measurementCalculator = null;
        
        // Athletic test components
        this.currentTest = null;
        this.currentTestType = 'broad-jump';
        this.linesCalibrator = new LinesCalibrator();
        this.dataExporter = new DataExporter();
        this.athleticTests = {
            'broad-jump': new BroadJumpTest(),
            'sprint': new SprintTest(),
            'kick': new KickTest()
        };
        this.isFrameLoopRunning = false;
        
        this.initializeApp();
    }

    /**
     * Initialize the application
     */
    async initializeApp() {
        try {
            // Initialize modules
            this.storage = new MeasurementStorage();
            this.canvasRenderer = new CanvasRenderer();
            this.measurementCalculator = new MeasurementCalculator();
            this.camera = new CameraController();
            this.poseDetector = new PoseDetector();
            this.dataExporter.setStorage(this.storage);

            // Set up event listeners
            this.setupEventListeners();

            // Load saved height
            this.loadSavedHeight();

            // Load saved measurements
            this.displaySavedResults();
            
            // Initialize athletic tests
            this.initializeAthleticTests();
            
            // Display test history
            this.displayTestHistory();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Height input
        document.getElementById('save-height-btn').addEventListener('click', () => {
            this.saveHeight();
        });

        document.getElementById('height-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveHeight();
            }
        });

        // Camera controls
        document.getElementById('start-camera-btn').addEventListener('click', () => {
            this.startCamera();
        });

        document.getElementById('capture-btn').addEventListener('click', () => {
            this.capturePhoto();
        });

        // Results actions
        document.getElementById('save-results-btn').addEventListener('click', () => {
            this.saveCurrentResults();
        });

        document.getElementById('clear-results-btn').addEventListener('click', () => {
            this.clearCurrentResults();
        });

        document.getElementById('clear-all-btn').addEventListener('click', () => {
            this.clearAllSavedResults();
        });

        // Modal controls
        document.getElementById('close-error-btn').addEventListener('click', () => {
            this.hideError();
        });
        
        // Athletic test event listeners
        this.setupAthleticTestListeners();

        // Camera event listeners
        this.camera.onCameraReady = () => {
            this.updateCameraStatus('Camera ready - Position yourself for a full body shot');
            document.getElementById('capture-btn').disabled = false;
        };

        this.camera.onCameraError = (error) => {
            this.showError(`Camera error: ${error}`);
        };

        // Pose detection event listeners
        this.poseDetector.onPoseDetected = (results, imageData) => {
            this.handlePoseDetectionResults(results, imageData);
        };

        this.poseDetector.onDetectionError = (error) => {
            this.hideLoading();
            this.showError(`Pose detection failed: ${error}`);
        };
    }
    
    /**
     * Set up athletic test event listeners
     */
    setupAthleticTestListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTestTab(e.target.dataset.test);
            });
        });
        
        // Test controls
        document.getElementById('calibrate-btn').addEventListener('click', () => {
            this.startCalibration();
        });
        
        document.getElementById('start-test-btn').addEventListener('click', () => {
            this.startAthleticTest();
        });
        
        document.getElementById('reset-test-btn').addEventListener('click', () => {
            this.resetAthleticTest();
        });
        
        document.getElementById('save-test-btn').addEventListener('click', () => {
            this.saveTestResult();
        });
        
        document.getElementById('export-json-btn').addEventListener('click', () => {
            this.exportTestData();
        });
        
        document.getElementById('clear-test-history-btn').addEventListener('click', () => {
            this.clearTestHistory();
        });
    }
    
    /**
     * Initialize athletic tests
     */
    initializeAthleticTests() {
        // Set up test callbacks
        Object.values(this.athleticTests).forEach(test => {
            test.onTestComplete = (results) => {
                this.handleTestComplete(results);
            };
            
            test.onTestProgress = (message) => {
                this.updateTestProgress(message);
            };
            
            test.onCalibrationComplete = (data) => {
                this.handleCalibrationComplete(data);
            };
        });
        
        // Set current test
        this.currentTest = this.athleticTests[this.currentTestType];
        
        // Update UI
        this.updateTestUI();
    }
    
    /**
     * Switch test tab
     */
    switchTestTab(testType) {
        if (this.isFrameLoopRunning) {
            this.stopFrameLoop();
        }
        
        this.currentTestType = testType;
        this.currentTest = this.athleticTests[testType];
        
        // Update tab UI
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.test === testType);
        });
        
        // Update instruction content
        document.querySelectorAll('.instruction-content').forEach(content => {
            content.style.display = content.dataset.test === testType ? 'block' : 'none';
        });
        
        // Update results content
        document.querySelectorAll('.result-content').forEach(content => {
            content.style.display = content.dataset.test === testType ? 'block' : 'none';
        });
        
        this.updateTestUI();
        this.displayTestHistory();
    }
    
    /**
     * Start calibration for current test
     */
    startCalibration() {
        if (!this.currentTest) return;
        
        const canvas = document.getElementById('analysis-canvas');
        this.currentTest.startCalibration(canvas);
        
        this.updateCalibrationStatus('Calibrating - click points on image...');
    }
    
    /**
     * Handle calibration complete
     */
    handleCalibrationComplete(data) {
        this.updateCalibrationStatus('Calibrated', true);
        document.getElementById('start-test-btn').disabled = false;
        console.log('Calibration complete for', this.currentTestType);
    }
    
    /**
     * Start athletic test
     */
    async startAthleticTest() {
        if (!this.currentTest || !this.currentTest.isCalibrated) {
            this.showError('Please calibrate the test first');
            return;
        }
        
        if (!this.userHeight) {
            this.showError('Please enter your height first');
            return;
        }
        
        try {
            // Start camera if not already running
            if (!this.camera.stream) {
                await this.startCamera();
            }
            
            // Start test
            this.currentTest.startTest();
            
            // Start frame processing loop
            this.startFrameLoop();
            
            // Update UI
            this.updateTestProgress('Running', true);
            document.getElementById('start-test-btn').disabled = true;
            document.getElementById('reset-test-btn').disabled = false;
            
        } catch (error) {
            this.showError(`Failed to start test: ${error.message}`);
        }
    }
    
    /**
     * Start frame processing loop
     */
    startFrameLoop() {
        this.isFrameLoopRunning = true;
        
        this.camera.startFrameLoop((frameData) => {
            if (!this.isFrameLoopRunning || !this.currentTest.isRunning) return;
            
            // Process frame with pose detection
            this.poseDetector.detectFromCanvas(frameData.canvas).then(() => {
                // Pose results will be handled by existing callback
            }).catch(error => {
                console.error('Frame pose detection error:', error);
            });
        });
    }
    
    /**
     * Stop frame processing loop
     */
    stopFrameLoop() {
        this.isFrameLoopRunning = false;
        this.camera.stopFrameLoop();
    }
    
    /**
     * Reset athletic test
     */
    resetAthleticTest() {
        if (this.currentTest) {
            this.currentTest.resetTest();
        }
        
        this.stopFrameLoop();
        
        // Update UI
        this.updateTestProgress('Ready');
        document.getElementById('start-test-btn').disabled = !this.currentTest?.isCalibrated;
        document.getElementById('save-test-btn').disabled = true;
        
        // Clear results display
        this.clearTestResultsDisplay();
    }
    
    /**
     * Handle test completion
     */
    handleTestComplete(results) {
        this.stopFrameLoop();
        
        // Update UI
        this.updateTestProgress('Completed', true);
        document.getElementById('start-test-btn').disabled = false;
        document.getElementById('save-test-btn').disabled = false;
        
        // Display results
        this.displayTestResults(results);
        
        console.log(`${this.currentTestType} test completed:`, results);
    }
    
    /**
     * Display test results
     */
    displayTestResults(results) {
        switch (this.currentTestType) {
            case 'broad-jump':
                document.getElementById('jump-distance').textContent = 
                    results.distance ? `${results.distance.toFixed(2)} m` : '-';
                document.getElementById('takeoff-speed').textContent = 
                    results.takeoffSpeed ? `${results.takeoffSpeed.toFixed(1)} m/s` : '-';
                break;
                
            case 'sprint':
                document.getElementById('split-0-15').textContent = 
                    results.splits['0-15m'] ? `${results.splits['0-15m'].toFixed(2)} s` : '-';
                document.getElementById('split-15-30').textContent = 
                    results.splits['15-30m'] ? `${results.splits['15-30m'].toFixed(2)} s` : '-';
                document.getElementById('total-time').textContent = 
                    results.totalTime ? `${results.totalTime.toFixed(2)} s` : '-';
                document.getElementById('avg-speed-total').textContent = 
                    results.avgSpeedTotal ? `${results.avgSpeedTotal.toFixed(1)} m/s` : '-';
                document.getElementById('max-speed').textContent = 
                    results.maxSpeed ? `${results.maxSpeed.toFixed(1)} m/s` : '-';
                document.getElementById('avg-accel-0-15').textContent = 
                    results.avgAccel0to15 ? `${results.avgAccel0to15.toFixed(1)} m/s²` : '-';
                
                // Draw speed chart if available
                if (results.speedHistory) {
                    this.drawSpeedChart(results.speedHistory);
                }
                break;
                
            case 'kick':
                document.getElementById('ball-speed-ms').textContent = 
                    results.ballSpeed ? `${results.ballSpeed.toFixed(1)} m/s` : '-';
                document.getElementById('ball-speed-kmh').textContent = 
                    results.ballSpeedKmh ? `${results.ballSpeedKmh.toFixed(1)} km/h` : '-';
                document.getElementById('flight-time').textContent = 
                    results.flightTime ? `${results.flightTime.toFixed(3)} s` : '-';
                break;
        }
    }
    
    /**
     * Draw speed chart for sprint results
     */
    drawSpeedChart(speedHistory) {
        const canvas = document.getElementById('speed-chart-canvas');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (speedHistory.length < 2) return;
        
        // Extract speed values
        const speeds = speedHistory.map(entry => entry.speed);
        
        // Use canvas renderer to draw sparkline
        this.canvasRenderer.canvas = canvas;
        this.canvasRenderer.ctx = ctx;
        this.canvasRenderer.drawSparkline(speeds, 10, 10, canvas.width - 20, canvas.height - 20);
    }
    
    /**
     * Clear test results display
     */
    clearTestResultsDisplay() {
        // Clear all result displays
        document.querySelectorAll('.result-metric span').forEach(span => {
            span.textContent = '-';
        });
        
        // Clear speed chart
        const canvas = document.getElementById('speed-chart-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    /**
     * Save test result
     */
    saveTestResult() {
        if (!this.currentTest || !this.currentTest.results) {
            this.showError('No test results to save');
            return;
        }
        
        try {
            this.storage.saveTestResult(this.currentTestType, this.currentTest.results);
            this.displayTestHistory();
            
            // Update save button
            const saveBtn = document.getElementById('save-test-btn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saved!';
            
            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Result';
            }, 2000);
            
        } catch (error) {
            this.showError('Failed to save test result');
        }
    }
    
    /**
     * Export test data
     */
    exportTestData() {
        try {
            this.dataExporter.exportAthleticTests();
        } catch (error) {
            this.showError('Failed to export test data');
        }
    }
    
    /**
     * Display test history
     */
    displayTestHistory() {
        const results = this.storage.getTestResults(this.currentTestType);
        const container = document.getElementById('test-history-list');
        
        if (results.length === 0) {
            container.innerHTML = '<p class="empty-state">No test results yet</p>';
            return;
        }
        
        container.innerHTML = results.slice(0, 10).map(result => {
            const date = new Date(result.timestamp).toLocaleDateString();
            const resultText = this.formatTestResult(result);
            
            return `
                <div class="test-history-item">
                    <div class="test-history-header">
                        <strong>${this.currentTestType.replace('-', ' ').toUpperCase()}</strong>
                        <span class="test-history-date">${date}</span>
                    </div>
                    <div class="test-history-results">${resultText}</div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Format test result for display
     */
    formatTestResult(result) {
        switch (this.currentTestType) {
            case 'broad-jump':
                return `Distance: ${result.distance?.toFixed(2) || '-'} m`;
            case 'sprint':
                return `Total: ${result.totalTime?.toFixed(2) || '-'} s, Max Speed: ${result.maxSpeed?.toFixed(1) || '-'} m/s`;
            case 'kick':
                return `Speed: ${result.ballSpeed?.toFixed(1) || '-'} m/s (${result.ballSpeedKmh?.toFixed(1) || '-'} km/h)`;
            default:
                return 'Test completed';
        }
    }
    
    /**
     * Clear test history
     */
    clearTestHistory() {
        if (confirm(`Clear all ${this.currentTestType} test results?`)) {
            this.storage.clearTestResults(this.currentTestType);
            this.displayTestHistory();
        }
    }
    
    /**
     * Update test UI state
     */
    updateTestUI() {
        const isCalibrated = this.currentTest?.isCalibrated || false;
        
        document.getElementById('start-test-btn').disabled = !isCalibrated;
        this.updateCalibrationStatus(isCalibrated ? 'Calibrated' : 'Not Calibrated', isCalibrated);
    }
    
    /**
     * Update calibration status
     */
    updateCalibrationStatus(message, isCalibrated = false) {
        const statusEl = document.getElementById('calibration-status');
        statusEl.textContent = message;
        statusEl.classList.toggle('calibrated', isCalibrated);
    }
    
    /**
     * Update test progress
     */
    updateTestProgress(message, isRunning = false) {
        const statusEl = document.getElementById('test-progress');
        statusEl.textContent = message;
        statusEl.classList.toggle('running', isRunning);
        statusEl.classList.toggle('completed', message === 'Completed');
    }

    /**
     * Save user height
     */
    saveHeight() {
        const heightInput = document.getElementById('height-input');
        const height = parseFloat(heightInput.value);

        if (!height || height < 100 || height > 250) {
            this.showError('Please enter a valid height between 100-250 cm');
            return;
        }

        this.userHeight = height;
        this.storage.saveUserHeight(height);
        this.displayHeight();
        this.updateAnalysisStatus('Height saved. You can now take a photo to measure body segments.');
    }

    /**
     * Load saved height from storage
     */
    loadSavedHeight() {
        const savedHeight = this.storage.getUserHeight();
        if (savedHeight) {
            this.userHeight = savedHeight;
            document.getElementById('height-input').value = savedHeight;
            this.displayHeight();
        }
    }

    /**
     * Display current height
     */
    displayHeight() {
        const display = document.getElementById('height-display');
        if (this.userHeight) {
            display.textContent = `Current height: ${this.userHeight} cm`;
            display.style.display = 'block';
        } else {
            display.style.display = 'none';
        }
    }

    /**
     * Start camera
     */
    async startCamera() {
        try {
            this.updateCameraStatus('Starting camera...');
            await this.camera.startCamera();
            document.getElementById('start-camera-btn').style.display = 'none';
        } catch (error) {
            this.showError(`Failed to start camera: ${error.message}`);
        }
    }

    /**
     * Capture photo and process
     */
    async capturePhoto() {
        if (!this.userHeight) {
            this.showError('Please enter your height first');
            return;
        }

        try {
            this.showLoading();
            this.updateCameraStatus('Capturing photo...');
            
            const imageData = this.camera.capturePhoto();
            this.updateAnalysisStatus('Analyzing pose...');
            
            await this.poseDetector.detectPose(imageData);
        } catch (error) {
            this.hideLoading();
            this.showError(`Failed to capture photo: ${error.message}`);
        }
    }

    /**
     * Handle pose detection results
     */
    handlePoseDetectionResults(results, imageData) {
        this.hideLoading();

        if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
            this.showError('No pose detected. Please ensure you are fully visible in the photo and try again.');
            return;
        }

        try {
            // Check if we're running an athletic test
            if (this.isFrameLoopRunning && this.currentTest && this.currentTest.isRunning) {
                // Process frame for athletic test
                const scale = this.getScaleFromCurrentMeasurement();
                if (scale) {
                    this.currentTest.processFrame(results.poseLandmarks, performance.now(), scale, imageData);
                }
            } else {
                // Regular body measurement processing
                this.currentMeasurements = this.measurementCalculator.calculateMeasurements(
                    results.poseLandmarks,
                    this.userHeight,
                    imageData.width,
                    imageData.height
                );

                // Render pose on canvas
                this.canvasRenderer.renderPoseResults(
                    imageData,
                    results.poseLandmarks,
                    this.currentMeasurements
                );

                // Display measurements
                this.displayMeasurements();
                this.updateAnalysisStatus('Analysis complete! Your measurements are shown below.');
                
                // Enable save button
                document.getElementById('save-results-btn').disabled = false;
            }

        } catch (error) {
            console.error('Error processing pose results:', error);
            this.showError('Failed to process pose detection results. Please try again.');
        }
    }
    
    /**
     * Get scale from current measurement for athletic tests
     */
    getScaleFromCurrentMeasurement() {
        if (this.currentMeasurements) {
            return MeasurementCalculator.getScaleFromMeasurement(this.currentMeasurements);
        }
        
        // Try to get from most recent saved measurement
        const savedMeasurements = this.storage.getSavedMeasurements();
        if (savedMeasurements.length > 0) {
            return MeasurementCalculator.getScaleFromMeasurement(savedMeasurements[0]);
        }
        
        // Fallback: create basic scale from user height
        if (this.userHeight) {
            return {
                pxPerCm: 5, // Rough estimate
                cmPerPx: 0.2,
                pxPerM: 500,
                imageWidth: 640,
                imageHeight: 480
            };
        }
        
        return null;
    }

    /**
     * Display current measurements
     */
    displayMeasurements() {
        if (!this.currentMeasurements) return;

        const measurements = this.currentMeasurements.segments;
        
        // Update measurement displays
        document.getElementById('upper-arm-measurement').textContent = 
            measurements.upperArm ? `${measurements.upperArm.toFixed(1)} cm` : '-';
        document.getElementById('forearm-measurement').textContent = 
            measurements.forearm ? `${measurements.forearm.toFixed(1)} cm` : '-';
        document.getElementById('thigh-measurement').textContent = 
            measurements.thigh ? `${measurements.thigh.toFixed(1)} cm` : '-';
        document.getElementById('shin-measurement').textContent = 
            measurements.shin ? `${measurements.shin.toFixed(1)} cm` : '-';

        // Add visual indication for available measurements
        this.updateMeasurementCards();
    }

    /**
     * Update measurement card styles
     */
    updateMeasurementCards() {
        const cards = document.querySelectorAll('.measurement-card');
        const measurements = this.currentMeasurements?.segments;

        cards.forEach((card, index) => {
            const segmentNames = ['upperArm', 'forearm', 'thigh', 'shin'];
            const segmentValue = measurements?.[segmentNames[index]];
            
            if (segmentValue && segmentValue > 0) {
                card.classList.add('has-value');
            } else {
                card.classList.remove('has-value');
            }
        });
    }

    /**
     * Save current measurement results
     */
    saveCurrentResults() {
        if (!this.currentMeasurements) {
            this.showError('No measurements to save');
            return;
        }

        try {
            this.storage.saveMeasurement(this.currentMeasurements);
            this.displaySavedResults();
            this.updateAnalysisStatus('Measurements saved successfully!');
            
            // Briefly disable save button to prevent duplicate saves
            const saveBtn = document.getElementById('save-results-btn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saved!';
            
            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Results';
            }, 2000);
            
        } catch (error) {
            this.showError('Failed to save measurements');
        }
    }

    /**
     * Clear current results
     */
    clearCurrentResults() {
        this.currentMeasurements = null;
        
        // Clear measurement displays
        document.querySelectorAll('.measurement-value').forEach(el => {
            el.textContent = '-';
        });
        
        // Remove visual indicators
        document.querySelectorAll('.measurement-card').forEach(card => {
            card.classList.remove('has-value');
        });
        
        // Clear canvas
        this.canvasRenderer.clearCanvas();
        
        // Disable save button
        document.getElementById('save-results-btn').disabled = true;
        
        this.updateAnalysisStatus('Results cleared. Take a new photo to measure again.');
    }

    /**
     * Display saved measurement results
     */
    displaySavedResults() {
        const savedResults = this.storage.getSavedMeasurements();
        const container = document.getElementById('saved-results-list');
        
        if (savedResults.length === 0) {
            container.innerHTML = '<p class="empty-state">No saved measurements yet</p>';
            return;
        }

        container.innerHTML = savedResults.map(result => `
            <div class="saved-result-item">
                <div class="saved-result-header">
                    <strong>Measurement #${result.id}</strong>
                    <span class="saved-result-date">${new Date(result.timestamp).toLocaleDateString()}</span>
                </div>
                <div class="saved-result-measurements">
                    <div>Upper Arm: ${result.segments.upperArm ? result.segments.upperArm.toFixed(1) + ' cm' : '-'}</div>
                    <div>Forearm: ${result.segments.forearm ? result.segments.forearm.toFixed(1) + ' cm' : '-'}</div>
                    <div>Thigh: ${result.segments.thigh ? result.segments.thigh.toFixed(1) + ' cm' : '-'}</div>
                    <div>Shin: ${result.segments.shin ? result.segments.shin.toFixed(1) + ' cm' : '-'}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Clear all saved results
     */
    clearAllSavedResults() {
        if (confirm('Are you sure you want to delete all saved measurements?')) {
            this.storage.clearAllMeasurements();
            this.displaySavedResults();
        }
    }

    /**
     * Update camera status message
     */
    updateCameraStatus(message) {
        document.getElementById('camera-status').textContent = message;
    }

    /**
     * Update analysis status message
     */
    updateAnalysisStatus(message) {
        document.getElementById('analysis-status').textContent = message;
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        document.getElementById('loading-overlay').classList.add('show');
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('show');
    }

    /**
     * Show error modal
     */
    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-modal').classList.add('show');
    }

    /**
     * Hide error modal
     */
    hideError() {
        document.getElementById('error-modal').classList.remove('show');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bodyMeasurementApp = new BodyMeasurementApp();
});
