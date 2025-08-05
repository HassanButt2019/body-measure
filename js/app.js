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

            // Set up event listeners
            this.setupEventListeners();

            // Load saved height
            this.loadSavedHeight();

            // Load saved measurements
            this.displaySavedResults();

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
            // Calculate measurements
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

        } catch (error) {
            console.error('Error processing pose results:', error);
            this.showError('Failed to process pose detection results. Please try again.');
        }
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
