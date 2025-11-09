// Mock viewer service for development
class ViewerService {
  async loadStudy(studyInstanceUID: string) {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500))
    return {
      studyInstanceUID,
      studyDate: '20240101',
      studyDescription: 'Mock Study',
      patientName: 'Test Patient',
      series: []
    }
  }

  async loadSeries(studyInstanceUID: string, seriesInstanceUID: string) {
    await new Promise(resolve => setTimeout(resolve, 300))
    return {
      seriesInstanceUID,
      studyInstanceUID,
      seriesDescription: 'Mock Series',
      instances: []
    }
  }

  async loadInstance(studyInstanceUID: string, seriesInstanceUID: string, sopInstanceUID: string) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      sopInstanceUID,
      seriesInstanceUID,
      studyInstanceUID,
      imageData: null
    }
  }

  async saveMeasurement(measurement: any) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      ...measurement,
      id: `measurement-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
  }

  async saveAnnotation(annotation: any) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      ...annotation,
      id: `annotation-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
  }
}

export const viewerService = new ViewerService()