// Unified Viewer Service - Combines Orthanc + Database data
const orthancViewerService = require('./orthanc-viewer-service');
const Study = require('../models/Study');
const Instance = require('../models/Instance');

class UnifiedViewerService {

    /**
     * Get all studies from both Orthanc and Database
     */
    async getAllStudies() {
        try {
            // Fetch from both sources in parallel
            const [orthancStudies, dbStudies] = await Promise.all([
                this.getOrthancStudies(),
                this.getDatabaseStudies()
            ]);

            // Merge and deduplicate by studyInstanceUID
            const studiesMap = new Map();

            // Add Orthanc studies
            orthancStudies.forEach(study => {
                studiesMap.set(study.studyInstanceUID, {
                    ...study,
                    source: 'orthanc',
                    hasOrthancData: true,
                    hasDatabaseData: false
                });
            });

            // Add/merge database studies
            dbStudies.forEach(study => {
                const existing = studiesMap.get(study.studyInstanceUID);
                if (existing) {
                    // Study exists in both - merge data
                    studiesMap.set(study.studyInstanceUID, {
                        ...existing,
                        ...study,
                        source: 'both',
                        hasDatabaseData: true,
                        dbId: study._id
                    });
                } else {
                    // Study only in database
                    studiesMap.set(study.studyInstanceUID, {
                        ...study,
                        source: 'database',
                        hasOrthancData: false,
                        hasDatabaseData: true,
                        dbId: study._id
                    });
                }
            });

            // Convert map to array and sort by date
            const allStudies = Array.from(studiesMap.values());
            allStudies.sort((a, b) => {
                const dateA = a.studyDate || '';
                const dateB = b.studyDate || '';
                return dateB.localeCompare(dateA); // Newest first
            });

            return allStudies;
        } catch (error) {
            console.error('Error fetching unified studies:', error);
            throw error;
        }
    }

    /**
     * Get studies from Orthanc
     */
    async getOrthancStudies() {
        try {
            return await orthancViewerService.getAllStudies();
        } catch (error) {
            console.error('Error fetching Orthanc studies:', error);
            return []; // Return empty array if Orthanc is down
        }
    }

    /**
     * Get studies from Database
     */
    async getDatabaseStudies() {
        try {
            const studies = await Study.find()
                .sort({ studyDate: -1 })
                .lean();

            // Get instance counts for each study
            const studiesWithCounts = await Promise.all(
                studies.map(async (study) => {
                    const instanceCount = await Instance.countDocuments({
                        studyInstanceUID: study.studyInstanceUID
                    });

                    return {
                        id: study._id.toString(),
                        patientID: study.patientID || 'Unknown',
                        patientName: study.patientName || 'Unknown',
                        studyDate: study.studyDate || '',
                        studyTime: study.studyTime || '',
                        studyDescription: study.studyDescription || '',
                        modality: study.modality || '',
                        studyInstanceUID: study.studyInstanceUID,
                        instancesCount: instanceCount,
                        seriesCount: 1, // Approximate
                        _id: study._id
                    };
                })
            );

            return studiesWithCounts;
        } catch (error) {
            console.error('Error fetching database studies:', error);
            return []; // Return empty array if database is down
        }
    }

    /**
     * Search studies across both sources
     */
    async searchStudies(query) {
        try {
            const allStudies = await this.getAllStudies();

            const searchTerm = query.toLowerCase();
            return allStudies.filter(study =>
                (study.patientName || '').toLowerCase().includes(searchTerm) ||
                (study.patientID || '').toLowerCase().includes(searchTerm) ||
                (study.studyDescription || '').toLowerCase().includes(searchTerm) ||
                (study.modality || '').toLowerCase().includes(searchTerm)
            );
        } catch (error) {
            console.error('Error searching studies:', error);
            throw error;
        }
    }

    /**
     * Get study details from appropriate source
     */
    async getStudyDetails(studyId, source = 'auto') {
        try {
            if (source === 'orthanc' || source === 'auto') {
                // Try Orthanc first
                try {
                    const orthancStudy = await orthancViewerService.getStudyComplete(studyId);
                    if (orthancStudy) {
                        return {
                            ...orthancStudy,
                            source: 'orthanc'
                        };
                    }
                } catch (error) {
                    console.log('Study not found in Orthanc, trying database...');
                }
            }

            if (source === 'database' || source === 'auto') {
                // Try database
                const dbStudy = await Study.findById(studyId).lean();
                if (dbStudy) {
                    const instances = await Instance.find({
                        studyInstanceUID: dbStudy.studyInstanceUID
                    }).lean();

                    return {
                        id: dbStudy._id.toString(),
                        patientID: dbStudy.patientID,
                        patientName: dbStudy.patientName,
                        studyDate: dbStudy.studyDate,
                        studyTime: dbStudy.studyTime,
                        studyDescription: dbStudy.studyDescription,
                        modality: dbStudy.modality,
                        studyInstanceUID: dbStudy.studyInstanceUID,
                        instancesCount: instances.length,
                        instances: instances,
                        source: 'database'
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('Error fetching study details:', error);
            throw error;
        }
    }

    /**
     * Get statistics from both sources
     */
    async getStatistics() {
        try {
            const [orthancStats, dbStats] = await Promise.all([
                this.getOrthancStats(),
                this.getDatabaseStats()
            ]);

            return {
                orthanc: orthancStats,
                database: dbStats,
                combined: {
                    totalStudies: (orthancStats.CountStudies || 0) + (dbStats.studies || 0),
                    totalInstances: (orthancStats.CountInstances || 0) + (dbStats.instances || 0)
                }
            };
        } catch (error) {
            console.error('Error fetching statistics:', error);
            throw error;
        }
    }

    async getOrthancStats() {
        try {
            return await orthancViewerService.getStatistics();
        } catch (error) {
            return { CountStudies: 0, CountSeries: 0, CountInstances: 0 };
        }
    }

    async getDatabaseStats() {
        try {
            const [studyCount, instanceCount] = await Promise.all([
                Study.countDocuments(),
                Instance.countDocuments()
            ]);

            return {
                studies: studyCount,
                instances: instanceCount
            };
        } catch (error) {
            return { studies: 0, instances: 0 };
        }
    }

    /**
     * Get image URL based on source
     */
    getImageUrl(study, instanceId) {
        if (study.source === 'orthanc' || study.hasOrthancData) {
            return orthancViewerService.getInstancePreviewUrl(instanceId);
        }
        return null;
    }
}

module.exports = new UnifiedViewerService();
