// Minimal shim for @icr/polyseg-wasm to avoid bundling WASM in production build
// This provides no-op or throwing implementations so the app can bundle
// successfully in environments where polyseg is not required.

// Initialize stub – in real module this would init the WASM
export async function init(): Promise<void> {
  // No operation – pretend initialization succeeded
}

// Common conversion entry points – throw to signal disabled functionality
export async function convertSegmentation(..._args: any[]): Promise<never> {
  throw new Error('PolySeg conversion disabled in this build');
}

export async function convertRTSTRUCTToSegmentation(..._args: any[]): Promise<never> {
  throw new Error('PolySeg RTSTRUCT conversion disabled in this build');
}

export async function convertContourData(..._args: any[]): Promise<never> {
  throw new Error('PolySeg contour conversion disabled in this build');
}

// No default export to avoid conflicts with consumer modules
// This disables polySeg conversions; calls will throw with a clear message.

type ProgressCallback = (progress: number) => void

class PolySegInstanceShim {
  async convertContourRoiToSurface(): Promise<never> {
    throw new Error('PolySeg WASM is disabled in this build. Enable polyseg to use this feature.')
  }
  async convertLabelmapToSurface(): Promise<never> {
    throw new Error('PolySeg WASM is disabled in this build. Enable polyseg to use this feature.')
  }
  async convertSurfaceToLabelmap(): Promise<never> {
    throw new Error('PolySeg WASM is disabled in this build. Enable polyseg to use this feature.')
  }
}

export default class ICRPolySeg {
  public instance: PolySegInstanceShim
  constructor() {
    this.instance = new PolySegInstanceShim()
  }
  async initialize(_opts?: { updateProgress?: ProgressCallback }): Promise<void> {
    // no-op
    return
  }
}