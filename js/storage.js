/**
 * Measurement Storage
 * Handles localStorage operations for saving and retrieving measurements and user data
 */
class MeasurementStorage {
    constructor() {
        this.storageKeys = {
            measurements: 'bodyMeasurements',
            userHeight: 'userHeight',
            settings: 'appSettings'
        };
        
        // Initialize storage structure if not exists
        this.initializeStorage();
    }

    /**
     * Initialize storage structure
     */
    initializeStorage() {
        try {
            // Check if localStorage is available
            if (!this.isLocalStorageAvailable()) {
                console.warn('localStorage not available, using memory storage');
                this.memoryStorage = {};
                return;
            }

            // Initialize measurements array if not exists
            if (!localStorage.getItem(this.storageKeys.measurements)) {
                localStorage.setItem(this.storageKeys.measurements, JSON.stringify([]));
            }

            // Initialize settings if not exists
            if (!localStorage.getItem(this.storageKeys.settings)) {
                const defaultSettings = {
                    unit: 'cm',
                    theme: 'light',
                    savePhotos: false,
                    maxSavedMeasurements: 50
                };
                localStorage.setItem(this.storageKeys.settings, JSON.stringify(defaultSettings));
            }

        } catch (error) {
            console.error('Failed to initialize storage:', error);
            this.memoryStorage = {};
        }
    }

    /**
     * Check if localStorage is available
     */
    isLocalStorageAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Save user height
     */
    saveUserHeight(height) {
        try {
            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(this.storageKeys.userHeight, height.toString());
            } else {
                this.memoryStorage.userHeight = height;
            }
            return true;
        } catch (error) {
            console.error('Failed to save user height:', error);
            return false;
        }
    }

    /**
     * Get user height
     */
    getUserHeight() {
        try {
            if (this.isLocalStorageAvailable()) {
                const height = localStorage.getItem(this.storageKeys.userHeight);
                return height ? parseFloat(height) : null;
            } else {
                return this.memoryStorage.userHeight || null;
            }
        } catch (error) {
            console.error('Failed to get user height:', error);
            return null;
        }
    }

    /**
     * Save measurement result
     */
    saveMeasurement(measurement) {
        try {
            const measurements = this.getSavedMeasurements();
            
            // Add unique ID and timestamp
            const measurementToSave = {
                ...measurement,
                id: this.generateMeasurementId(),
                timestamp: Date.now()
            };

            // Add to beginning of array (newest first)
            measurements.unshift(measurementToSave);

            // Limit number of saved measurements
            const maxSaved = this.getSettings().maxSavedMeasurements || 50;
            if (measurements.length > maxSaved) {
                measurements.splice(maxSaved);
            }

            // Save back to storage
            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(this.storageKeys.measurements, JSON.stringify(measurements));
            } else {
                this.memoryStorage.measurements = measurements;
            }

            return measurementToSave.id;

        } catch (error) {
            console.error('Failed to save measurement:', error);
            throw new Error('Failed to save measurement');
        }
    }

    /**
     * Get all saved measurements
     */
    getSavedMeasurements() {
        try {
            if (this.isLocalStorageAvailable()) {
                const measurements = localStorage.getItem(this.storageKeys.measurements);
                return measurements ? JSON.parse(measurements) : [];
            } else {
                return this.memoryStorage.measurements || [];
            }
        } catch (error) {
            console.error('Failed to get saved measurements:', error);
            return [];
        }
    }

    /**
     * Get measurement by ID
     */
    getMeasurementById(id) {
        const measurements = this.getSavedMeasurements();
        return measurements.find(measurement => measurement.id === id);
    }

    /**
     * Delete measurement by ID
     */
    deleteMeasurement(id) {
        try {
            const measurements = this.getSavedMeasurements();
            const filteredMeasurements = measurements.filter(measurement => measurement.id !== id);
            
            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(this.storageKeys.measurements, JSON.stringify(filteredMeasurements));
            } else {
                this.memoryStorage.measurements = filteredMeasurements;
            }

            return true;
        } catch (error) {
            console.error('Failed to delete measurement:', error);
            return false;
        }
    }

    /**
     * Clear all measurements
     */
    clearAllMeasurements() {
        try {
            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(this.storageKeys.measurements, JSON.stringify([]));
            } else {
                this.memoryStorage.measurements = [];
            }
            return true;
        } catch (error) {
            console.error('Failed to clear all measurements:', error);
            return false;
        }
    }

    /**
     * Get app settings
     */
    getSettings() {
        try {
            if (this.isLocalStorageAvailable()) {
                const settings = localStorage.getItem(this.storageKeys.settings);
                return settings ? JSON.parse(settings) : {};
            } else {
                return this.memoryStorage.settings || {};
            }
        } catch (error) {
            console.error('Failed to get settings:', error);
            return {};
        }
    }

    /**
     * Save app settings
     */
    saveSettings(settings) {
        try {
            const currentSettings = this.getSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            
            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(this.storageKeys.settings, JSON.stringify(updatedSettings));
            } else {
                this.memoryStorage.settings = updatedSettings;
            }
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Export measurements data
     */
    exportMeasurements() {
        try {
            const data = {
                measurements: this.getSavedMeasurements(),
                userHeight: this.getUserHeight(),
                settings: this.getSettings(),
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Failed to export measurements:', error);
            throw new Error('Failed to export data');
        }
    }

    /**
     * Import measurements data
     */
    importMeasurements(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Validate data structure
            if (!data.measurements || !Array.isArray(data.measurements)) {
                throw new Error('Invalid data format');
            }

            // Import measurements
            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(this.storageKeys.measurements, JSON.stringify(data.measurements));
                
                if (data.userHeight) {
                    localStorage.setItem(this.storageKeys.userHeight, data.userHeight.toString());
                }
                
                if (data.settings) {
                    localStorage.setItem(this.storageKeys.settings, JSON.stringify(data.settings));
                }
            } else {
                this.memoryStorage.measurements = data.measurements;
                if (data.userHeight) {
                    this.memoryStorage.userHeight = data.userHeight;
                }
                if (data.settings) {
                    this.memoryStorage.settings = data.settings;
                }
            }

            return true;
        } catch (error) {
            console.error('Failed to import measurements:', error);
            throw new Error('Failed to import data: ' + error.message);
        }
    }

    /**
     * Get storage usage statistics
     */
    getStorageStats() {
        try {
            const measurements = this.getSavedMeasurements();
            const totalMeasurements = measurements.length;
            
            let storageSize = 0;
            if (this.isLocalStorageAvailable()) {
                // Calculate approximate storage size
                const allData = {
                    measurements: measurements,
                    userHeight: this.getUserHeight(),
                    settings: this.getSettings()
                };
                storageSize = JSON.stringify(allData).length;
            }

            return {
                totalMeasurements,
                storageSize,
                oldestMeasurement: measurements.length > 0 ? measurements[measurements.length - 1].timestamp : null,
                newestMeasurement: measurements.length > 0 ? measurements[0].timestamp : null
            };
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            return {
                totalMeasurements: 0,
                storageSize: 0,
                oldestMeasurement: null,
                newestMeasurement: null
            };
        }
    }

    /**
     * Generate unique measurement ID
     */
    generateMeasurementId() {
        return 'measurement_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Clean old measurements (older than specified days)
     */
    cleanOldMeasurements(daysToKeep = 90) {
        try {
            const measurements = this.getSavedMeasurements();
            const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
            
            const filteredMeasurements = measurements.filter(measurement => 
                measurement.timestamp > cutoffDate
            );

            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(this.storageKeys.measurements, JSON.stringify(filteredMeasurements));
            } else {
                this.memoryStorage.measurements = filteredMeasurements;
            }

            return measurements.length - filteredMeasurements.length; // Return number of deleted measurements
        } catch (error) {
            console.error('Failed to clean old measurements:', error);
            return 0;
        }
    }
}
