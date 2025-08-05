/**
 * Camera Controller
 * Handles camera initialization, photo capture, and video stream management
 */
class CameraController {
    constructor() {
        this.stream = null;
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Callbacks
        this.onCameraReady = null;
        this.onCameraError = null;
        
        this.setupVideo();
    }

    /**
     * Set up video element
     */
    setupVideo() {
        this.video.addEventListener('loadedmetadata', () => {
            this.updateCanvasSize();
            if (this.onCameraReady) {
                this.onCameraReady();
            }
        });

        this.video.addEventListener('resize', () => {
            this.updateCanvasSize();
        });
    }

    /**
     * Start camera stream
     */
    async startCamera() {
        try {
            // Request camera access with mobile-optimized constraints
            const constraints = {
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    facingMode: 'environment', // Use back camera on mobile
                    aspectRatio: { ideal: 4/3 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            // Wait for video to be ready
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    this.updateCanvasSize();
                    resolve();
                };
                
                this.video.onerror = () => {
                    reject(new Error('Failed to load video stream'));
                };

                // Timeout after 10 seconds
                setTimeout(() => {
                    reject(new Error('Camera initialization timeout'));
                }, 10000);
            });

        } catch (error) {
            let errorMessage = 'Failed to access camera';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera access denied. Please allow camera permissions and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera found on this device.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Camera not supported on this device.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Camera is already in use by another application.';
            }

            if (this.onCameraError) {
                this.onCameraError(errorMessage);
            }
            throw new Error(errorMessage);
        }
    }

    /**
     * Update canvas size to match video
     */
    updateCanvasSize() {
        if (this.video.videoWidth && this.video.videoHeight) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Update canvas style to maintain aspect ratio
            const aspectRatio = this.video.videoWidth / this.video.videoHeight;
            const containerWidth = this.video.clientWidth;
            const containerHeight = containerWidth / aspectRatio;
            
            this.canvas.style.width = containerWidth + 'px';
            this.canvas.style.height = containerHeight + 'px';
        }
    }

    /**
     * Capture photo from video stream
     */
    capturePhoto() {
        if (!this.stream || !this.video.videoWidth) {
            throw new Error('Camera not ready');
        }

        // Create a capture canvas with video dimensions
        const captureCanvas = document.createElement('canvas');
        const captureCtx = captureCanvas.getContext('2d');
        
        captureCanvas.width = this.video.videoWidth;
        captureCanvas.height = this.video.videoHeight;

        // Draw current video frame
        captureCtx.drawImage(this.video, 0, 0, captureCanvas.width, captureCanvas.height);

        // Get image data
        const imageData = captureCtx.getImageData(0, 0, captureCanvas.width, captureCanvas.height);

        // Also get data URL for display purposes
        const dataURL = captureCanvas.toDataURL('image/jpeg', 0.9);

        return {
            imageData: imageData,
            dataURL: dataURL,
            width: captureCanvas.width,
            height: captureCanvas.height,
            canvas: captureCanvas
        };
    }

    /**
     * Stop camera stream
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
            this.video.srcObject = null;
        }
    }

    /**
     * Check if camera is available
     */
    static async isCameraAvailable() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(device => device.kind === 'videoinput');
        } catch (error) {
            return false;
        }
    }

    /**
     * Get camera capabilities
     */
    async getCameraCapabilities() {
        if (!this.stream) {
            throw new Error('Camera not started');
        }

        const videoTrack = this.stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();
        const settings = videoTrack.getSettings();

        return {
            capabilities,
            settings,
            constraints: videoTrack.getConstraints()
        };
    }

    /**
     * Switch camera (front/back) on mobile devices
     */
    async switchCamera() {
        if (!this.stream) return;

        const currentTrack = this.stream.getVideoTracks()[0];
        const currentSettings = currentTrack.getSettings();
        
        // Toggle between front and back camera
        const newFacingMode = currentSettings.facingMode === 'user' ? 'environment' : 'user';
        
        try {
            this.stopCamera();
            
            const constraints = {
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    facingMode: newFacingMode
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
        } catch (error) {
            // Fallback to any available camera
            try {
                const constraints = {
                    video: {
                        width: { ideal: 640, max: 1280 },
                        height: { ideal: 480, max: 720 }
                    }
                };
                
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.video.srcObject = this.stream;
            } catch (fallbackError) {
                if (this.onCameraError) {
                    this.onCameraError('Failed to switch camera');
                }
            }
        }
    }
}
