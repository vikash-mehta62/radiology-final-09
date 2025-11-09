import type { Study } from '../types/worklist'

// Mock worklist service for development
class WorklistService {
  async getWorklist(params: any = {}) {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const mockStudies: Study[] = [
      {
        studyInstanceUID: '1.2.3.4.5.6.7.8.9.1',
        studyDate: '20240101',
        studyTime: '120000',
        studyDescription: 'CT Chest',
        patientName: 'Doe, John',
        patientID: 'P001',
        patientBirthDate: '19800101',
        patientSex: 'M',
        modality: 'CT',
        numberOfSeries: 3,
        numberOfInstances: 150,
        priority: 'High',
        status: 'Pending',
        aiStatus: 'Completed'
      },
      {
        studyInstanceUID: '1.2.3.4.5.6.7.8.9.2',
        studyDate: '20240102',
        studyTime: '140000',
        studyDescription: 'MRI Brain',
        patientName: 'Smith, Jane',
        patientID: 'P002',
        patientBirthDate: '19750615',
        patientSex: 'F',
        modality: 'MR',
        numberOfSeries: 5,
        numberOfInstances: 200,
        priority: 'Normal',
        status: 'In Progress',
        aiStatus: 'Pending'
      }
    ]

    return {
      studies: mockStudies,
      total: mockStudies.length
    }
  }

  async getStudyDetails(studyInstanceUID: string) {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return {
      studyInstanceUID,
      studyDate: '20240101',
      studyTime: '120000',
      studyDescription: 'Mock Study Details',
      patientName: 'Test Patient',
      patientID: 'P001',
      patientBirthDate: '19800101',
      patientSex: 'M',
      modality: 'CT',
      numberOfSeries: 3,
      numberOfInstances: 150,
      priority: 'High',
      status: 'Pending',
      aiStatus: 'Completed'
    }
  }

  async updateStudyPriority(studyInstanceUID: string, priority: string) {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    return {
      studyInstanceUID,
      priority,
      updatedAt: new Date().toISOString()
    }
  }

  async assignStudy(studyInstanceUID: string, userId: string) {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    return {
      studyInstanceUID,
      assignedTo: userId,
      updatedAt: new Date().toISOString()
    }
  }
}

export const worklistService = new WorklistService()