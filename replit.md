# Body Segment Measurement App

## Overview

This is a web-based body measurement application that uses computer vision and pose detection to measure body segments through camera input. The app leverages MediaPipe's pose detection capabilities to identify body landmarks and calculate measurements like arm length, leg length, and other body segments using the user's height as a reference scale.

The application provides a complete measurement workflow: users input their height, take a photo using their device camera, and receive calculated body segment measurements overlaid on their captured image. All measurements and user data are stored locally in the browser.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Pure vanilla JavaScript architecture** organized into modular classes without any frameworks
- **Component-based structure** with dedicated modules for different functionalities:
  - `BodyMeasurementApp`: Main application controller coordinating all modules
  - `CameraController`: Handles camera access, video streaming, and photo capture
  - `PoseDetector`: Manages MediaPipe pose detection and landmark processing
  - `MeasurementCalculator`: Performs body segment calculations and pixel-to-cm conversions
  - `CanvasRenderer`: Handles drawing pose landmarks and measurements on canvas
  - `MeasurementStorage`: Manages localStorage operations for data persistence

### Computer Vision Pipeline
- **MediaPipe Pose Detection**: Uses Google's MediaPipe library loaded via CDN for real-time pose estimation
- **Landmark Processing**: Extracts 33 body landmarks and determines optimal measurement points
- **Scale Calibration**: Uses user-provided height and detected pose to establish pixel-to-centimeter ratio
- **Measurement Validation**: Compares calculated measurements against standard body proportions for accuracy

### Data Storage Strategy
- **Browser LocalStorage**: Primary storage for user height, measurement history, and app settings
- **Memory Fallback**: Graceful degradation to in-memory storage when localStorage is unavailable
- **Data Structure**: JSON-based storage with versioning support for future migrations

### Canvas Rendering System
- **Dual Canvas Setup**: Separate canvases for live camera feed and static analysis display
- **Overlay Graphics**: Custom drawing system for pose landmarks, measurement lines, and annotations
- **Responsive Design**: Canvas automatically adjusts to different screen sizes and orientations

### Camera Integration
- **MediaDevices API**: Uses modern web APIs for camera access with mobile optimization
- **Constraint Optimization**: Automatically selects appropriate camera (back camera on mobile) and resolution
- **Error Handling**: Comprehensive camera permission and hardware failure management

## External Dependencies

### Third-Party Libraries
- **MediaPipe Pose**: Google's pose detection library loaded from CDN
  - `@mediapipe/camera_utils`: Camera utilities for MediaPipe integration
  - `@mediapipe/control_utils`: Control utilities for pose detection
  - `@mediapipe/drawing_utils`: Drawing utilities for landmark visualization
  - `@mediapipe/pose`: Core pose detection model and algorithms

### Browser APIs
- **MediaDevices API**: For camera access and video streaming
- **Canvas API**: For image processing and landmark rendering
- **LocalStorage API**: For persistent data storage
- **File API**: For image capture and processing

### CDN Dependencies
- All MediaPipe libraries are loaded from `cdn.jsdelivr.net` with crossorigin support
- No build process or package manager dependencies
- Self-contained application that runs entirely in the browser