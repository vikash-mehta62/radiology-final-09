import type { Annotation } from '../types/viewer'

/**
 * Export annotations to JSON format
 */
export const exportAnnotations = (annotations: Annotation[]): string => {
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    annotationCount: annotations.length,
    annotations: annotations.map(annotation => ({
      id: annotation.id,
      type: annotation.type,
      points: annotation.points,
      text: annotation.text,
      label: annotation.label,
      style: annotation.style,
      transform: annotation.transform,
      metadata: annotation.metadata,
      frameIndex: annotation.frameIndex,
      normalized: annotation.normalized,
      createdAt: annotation.createdAt,
      updatedAt: annotation.updatedAt,
    })),
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Download annotations as JSON file
 */
export const downloadAnnotations = (annotations: Annotation[], filename?: string): void => {
  const jsonString = exportAnnotations(annotations)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `annotations-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

/**
 * Validate imported annotation data structure
 */
const validateAnnotationData = (data: any): boolean => {
  if (!data || typeof data !== 'object') {
    return false
  }

  // Check required fields
  if (!data.id || !data.type || !Array.isArray(data.points)) {
    return false
  }

  // Validate points structure
  if (!data.points.every((p: any) => typeof p.x === 'number' && typeof p.y === 'number')) {
    return false
  }

  // Validate style
  if (!data.style || typeof data.style !== 'object') {
    return false
  }

  // Validate transform
  if (!data.transform || typeof data.transform !== 'object') {
    return false
  }

  // Validate metadata
  if (!data.metadata || typeof data.metadata !== 'object') {
    return false
  }

  return true
}

/**
 * Import annotations from JSON string
 */
export const importAnnotations = (jsonString: string): {
  success: boolean
  annotations?: Annotation[]
  error?: string
} => {
  try {
    const data = JSON.parse(jsonString)

    // Validate structure
    if (!data.annotations || !Array.isArray(data.annotations)) {
      return {
        success: false,
        error: 'Invalid file format: missing annotations array',
      }
    }

    // Validate each annotation
    const invalidAnnotations: number[] = []
    data.annotations.forEach((annotation: any, index: number) => {
      if (!validateAnnotationData(annotation)) {
        invalidAnnotations.push(index)
      }
    })

    if (invalidAnnotations.length > 0) {
      return {
        success: false,
        error: `Invalid annotation data at indices: ${invalidAnnotations.join(', ')}`,
      }
    }

    // Generate new IDs to avoid conflicts
    const annotations: Annotation[] = data.annotations.map((annotation: any) => ({
      ...annotation,
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    return {
      success: true,
      annotations,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse JSON',
    }
  }
}

/**
 * Read file as text
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsText(file)
  })
}
