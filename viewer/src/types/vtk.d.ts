/**
 * TypeScript type declarations for VTK.js
 * Provides type safety for VTK.js imports
 */

declare module '@kitware/vtk.js/Common/DataModel/ImageData' {
  export interface vtkImageData {
    setDimensions(width: number, height: number, depth: number): void
    setSpacing(x: number, y: number, z: number): void
    setOrigin(x: number, y: number, z: number): void
    getPointData(): any
    getDimensions(): [number, number, number]
    getSpacing(): [number, number, number]
  }
  
  export default function newInstance(): vtkImageData
}

declare module '@kitware/vtk.js/Common/Core/DataArray' {
  export interface vtkDataArray {
    setName(name: string): void
    setNumberOfComponents(n: number): void
  }
  
  export default function newInstance(options: {
    numberOfComponents: number
    values: Float32Array | Uint8Array
    name?: string
  }): vtkDataArray
}

declare module '@kitware/vtk.js/Rendering/Core/RenderWindow' {
  export interface vtkRenderWindow {
    addRenderer(renderer: any): void
    render(): void
    delete(): void
    getViews(): any[]
  }
  
  export default function newInstance(): vtkRenderWindow
}

declare module '@kitware/vtk.js/Rendering/Core/Renderer' {
  export interface vtkRenderer {
    addVolume(volume: any): void
    removeVolume(volume: any): void
    resetCamera(): void
    getActiveCamera(): any
  }
  
  export default function newInstance(options?: { background?: [number, number, number] }): vtkRenderer
}

declare module '@kitware/vtk.js/Rendering/Core/Volume' {
  export interface vtkVolume {
    setMapper(mapper: any): void
    getProperty(): any
  }
  
  export default function newInstance(): vtkVolume
}

declare module '@kitware/vtk.js/Rendering/Core/VolumeMapper' {
  export interface vtkVolumeMapper {
    setInputData(data: any): void
    setSampleDistance(distance: number): void
    setMaximumSamplesPerRay(samples: number): void
    setAutoAdjustSampleDistances(auto: boolean): void
    setBlendMode(mode: number): void
  }
  
  export namespace BlendMode {
    export const COMPOSITE_BLEND: number
    export const MAXIMUM_INTENSITY_BLEND: number
    export const MINIMUM_INTENSITY_BLEND: number
    export const AVERAGE_INTENSITY_BLEND: number
  }
  
  export default function newInstance(): vtkVolumeMapper
}

declare module '@kitware/vtk.js/Rendering/Core/VolumeProperty' {
  export interface vtkVolumeProperty {
    setRGBTransferFunction(index: number, func: any): void
    setScalarOpacity(index: number, func: any): void
    setShade(shade: boolean): void
    setAmbient(ambient: number): void
    setDiffuse(diffuse: number): void
    setSpecular(specular: number): void
  }
  
  export default function newInstance(): vtkVolumeProperty
}

declare module '@kitware/vtk.js/Common/DataModel/PiecewiseFunction' {
  export interface vtkPiecewiseFunction {
    addPoint(x: number, y: number): void
    removeAllPoints(): void
  }
  
  export default function newInstance(): vtkPiecewiseFunction
}

declare module '@kitware/vtk.js/Rendering/Core/ColorTransferFunction' {
  export interface vtkColorTransferFunction {
    addRGBPoint(x: number, r: number, g: number, b: number): void
    removeAllPoints(): void
  }
  
  export default function newInstance(): vtkColorTransferFunction
}

declare module '@kitware/vtk.js/Rendering/OpenGL/RenderWindow' {
  export default function newInstance(): any
}

declare module '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor' {
  export interface vtkRenderWindowInteractor {
    setView(view: any): void
    initialize(): void
    bindEvents(container: HTMLElement): void
    unbindEvents(): void
    setInteractorStyle(style: any): void
    onStartInteraction(callback: () => void): void
    onEndInteraction(callback: () => void): void
  }
  
  export default function newInstance(): vtkRenderWindowInteractor
}

declare module '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera' {
  export default function newInstance(): any
}

declare module '@kitware/vtk.js/Filters/General/ContourFilter' {
  export interface vtkContourFilter {
    setInputData(data: any): void
    setContourValue(value: number): void
    getOutputPort(): any
  }
  
  export default function newInstance(): vtkContourFilter
}

declare module '@kitware/vtk.js/Rendering/Core/Mapper' {
  export interface vtkMapper {
    setInputConnection(port: any): void
  }
  
  export default function newInstance(): vtkMapper
}

declare module '@kitware/vtk.js/Rendering/Core/Actor' {
  export interface vtkActor {
    setMapper(mapper: any): void
  }
  
  export default function newInstance(): vtkActor
}
