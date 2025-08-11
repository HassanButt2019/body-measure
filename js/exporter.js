/**
 * Data Exporter
 * Handles JSON export of test results and measurements
 */
class DataExporter {
    constructor() {
        this.storage = null;
    }

    /**
     * Set storage reference
     */
    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Export all athletic test results as JSON
     */
    exportAthleticTests() {
        if (!this.storage) {
            throw new Error('Storage not initialized');
        }

        const exportData = {
            exportInfo: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                type: 'athletic_tests'
            },
            broadJumpResults: this.storage.getTestResults('broad-jump'),
            sprintResults: this.storage.getTestResults('sprint'),
            kickResults: this.storage.getTestResults('kick'),
            userHeight: this.storage.getUserHeight(),
            calibrations: this.getCalibrationData()
        };

        return this.downloadJSON(exportData, 'athletic-test-results.json');
    }

    /**
     * Export specific test results
     */
    exportTestResults(testType) {
        if (!this.storage) {
            throw new Error('Storage not initialized');
        }

        const testResults = this.storage.getTestResults(testType);
        
        const exportData = {
            exportInfo: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                type: testType,
                testCount: testResults.length
            },
            testType: testType,
            results: testResults,
            userHeight: this.storage.getUserHeight(),
            calibration: this.getTestCalibration(testType)
        };

        const filename = `${testType}-results-${this.formatDateForFilename()}.json`;
        return this.downloadJSON(exportData, filename);
    }

    /**
     * Export body measurements (existing functionality)
     */
    exportBodyMeasurements() {
        if (!this.storage) {
            throw new Error('Storage not initialized');
        }

        const exportData = {
            exportInfo: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                type: 'body_measurements'
            },
            measurements: this.storage.getSavedMeasurements(),
            userHeight: this.storage.getUserHeight(),
            settings: this.storage.getSettings()
        };

        return this.downloadJSON(exportData, 'body-measurements.json');
    }

    /**
     * Export complete app data
     */
    exportAllData() {
        if (!this.storage) {
            throw new Error('Storage not initialized');
        }

        const exportData = {
            exportInfo: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                type: 'complete_export'
            },
            bodyMeasurements: {
                measurements: this.storage.getSavedMeasurements(),
                userHeight: this.storage.getUserHeight(),
                settings: this.storage.getSettings()
            },
            athleticTests: {
                broadJump: this.storage.getTestResults('broad-jump'),
                sprint: this.storage.getTestResults('sprint'),
                kick: this.storage.getTestResults('kick'),
                calibrations: this.getCalibrationData()
            }
        };

        return this.downloadJSON(exportData, `complete-export-${this.formatDateForFilename()}.json`);
    }

    /**
     * Get calibration data from localStorage
     */
    getCalibrationData() {
        try {
            const saved = localStorage.getItem('athleticTestCalibrations');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Failed to get calibration data:', error);
            return {};
        }
    }

    /**
     * Get calibration for specific test
     */
    getTestCalibration(testType) {
        const calibrations = this.getCalibrationData();
        return calibrations[testType] || null;
    }

    /**
     * Download JSON data as file
     */
    downloadJSON(data, filename) {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // Create download link
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up
            URL.revokeObjectURL(url);

            console.log(`Exported data to ${filename}`);
            return true;

        } catch (error) {
            console.error('Failed to export JSON:', error);
            throw new Error('Failed to export data');
        }
    }

    /**
     * Format date for filename
     */
    formatDateForFilename() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        return `${year}${month}${day}-${hours}${minutes}`;
    }

    /**
     * Import JSON data (for future use)
     */
    importJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (!data.exportInfo || !data.exportInfo.type) {
                throw new Error('Invalid export format');
            }

            // Handle different import types
            switch (data.exportInfo.type) {
                case 'body_measurements':
                    return this.importBodyMeasurements(data);
                case 'athletic_tests':
                    return this.importAthleticTests(data);
                case 'complete_export':
                    return this.importCompleteData(data);
                default:
                    throw new Error('Unknown export type');
            }

        } catch (error) {
            console.error('Failed to import JSON:', error);
            throw new Error('Failed to import data: ' + error.message);
        }
    }

    /**
     * Import body measurements
     */
    importBodyMeasurements(data) {
        if (!this.storage) {
            throw new Error('Storage not initialized');
        }

        // This would use existing storage import functionality
        return this.storage.importMeasurements(JSON.stringify(data));
    }

    /**
     * Import athletic test data
     */
    importAthleticTests(data) {
        if (!this.storage) {
            throw new Error('Storage not initialized');
        }

        // Import test results
        if (data.broadJumpResults) {
            data.broadJumpResults.forEach(result => {
                this.storage.saveTestResult('broad-jump', result);
            });
        }

        if (data.sprintResults) {
            data.sprintResults.forEach(result => {
                this.storage.saveTestResult('sprint', result);
            });
        }

        if (data.kickResults) {
            data.kickResults.forEach(result => {
                this.storage.saveTestResult('kick', result);
            });
        }

        // Import calibrations
        if (data.calibrations) {
            localStorage.setItem('athleticTestCalibrations', JSON.stringify(data.calibrations));
        }

        return true;
    }

    /**
     * Import complete data
     */
    importCompleteData(data) {
        // Import body measurements
        if (data.bodyMeasurements) {
            this.importBodyMeasurements({
                measurements: data.bodyMeasurements.measurements,
                userHeight: data.bodyMeasurements.userHeight,
                settings: data.bodyMeasurements.settings
            });
        }

        // Import athletic tests
        if (data.athleticTests) {
            this.importAthleticTests({
                broadJumpResults: data.athleticTests.broadJump,
                sprintResults: data.athleticTests.sprint,
                kickResults: data.athleticTests.kick,
                calibrations: data.athleticTests.calibrations
            });
        }

        return true;
    }

    /**
     * Generate summary statistics for export
     */
    generateSummaryStats() {
        if (!this.storage) return null;

        const stats = {
            bodyMeasurements: {
                count: this.storage.getSavedMeasurements().length,
                userHeight: this.storage.getUserHeight()
            },
            athleticTests: {
                broadJump: {
                    count: this.storage.getTestResults('broad-jump').length,
                    bestDistance: this.getBestResult('broad-jump', 'distance')
                },
                sprint: {
                    count: this.storage.getTestResults('sprint').length,
                    bestTime: this.getBestResult('sprint', 'totalTime')
                },
                kick: {
                    count: this.storage.getTestResults('kick').length,
                    bestSpeed: this.getBestResult('kick', 'ballSpeed')
                }
            }
        };

        return stats;
    }

    /**
     * Get best result for a test type and metric
     */
    getBestResult(testType, metric) {
        if (!this.storage) return null;

        const results = this.storage.getTestResults(testType);
        if (results.length === 0) return null;

        // Determine if higher or lower is better
        const higherIsBetter = ['distance', 'ballSpeed', 'maxSpeed'].includes(metric);
        
        let bestValue = higherIsBetter ? -Infinity : Infinity;
        
        results.forEach(result => {
            const value = result[metric];
            if (value !== undefined && value !== null) {
                if (higherIsBetter && value > bestValue) {
                    bestValue = value;
                } else if (!higherIsBetter && value < bestValue) {
                    bestValue = value;
                }
            }
        });

        return bestValue === Infinity || bestValue === -Infinity ? null : bestValue;
    }
}