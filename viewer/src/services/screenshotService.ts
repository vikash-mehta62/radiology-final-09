/**
 * Screenshot Service
 * Captures canvas with AI overlays for report embedding
 */

export interface ScreenshotOptions {
  includeAIOverlay: boolean;
  includeAnnotations: boolean;
  includeMeasurements: boolean;
  quality: number; // 0-1
  format: 'png' | 'jpeg';
  maxWidth?: number;
  maxHeight?: number;
}

export interface CapturedImage {
  id: string;
  dataUrl: string;
  caption: string;
  timestamp: Date;
  metadata: {
    studyUID: string;
    seriesUID?: string;
    instanceUID?: string;
    frameIndex?: number;
    windowLevel?: { width: number; center: number };
    zoom?: number;
    hasAIOverlay: boolean;
    hasAnnotations: boolean;
  };
}

export class ScreenshotService {
  private capturedImages: CapturedImage[] = [];

  /**
   * Capture canvas as image
   */
  captureCanvas(
    canvas: HTMLCanvasElement,
    options: Partial<ScreenshotOptions> = {}
  ): string {
    const opts: ScreenshotOptions = {
      includeAIOverlay: true,
      includeAnnotations: true,
      includeMeasurements: true,
      quality: 0.95,
      format: 'png',
      ...options
    };

    try {
      // Get data URL from canvas
      const mimeType = opts.format === 'png' ? 'image/png' : 'image/jpeg';
      let dataUrl = canvas.toDataURL(mimeType, opts.quality);

      // Resize if needed
      if (opts.maxWidth || opts.maxHeight) {
        dataUrl = this.resizeImage(dataUrl, opts.maxWidth, opts.maxHeight);
      }

      console.log('📸 Screenshot captured:', {
        format: opts.format,
        quality: opts.quality,
        size: dataUrl.length
      });

      return dataUrl;
    } catch (error) {
      console.error('❌ Screenshot capture failed:', error);
      throw error;
    }
  }

  /**
   * Resize image data URL
   */
  private resizeImage(dataUrl: string, maxWidth?: number, maxHeight?: number): string {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (maxWidth && width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (maxHeight && height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Create temporary canvas for resizing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          tempCtx.drawImage(img, 0, 0, width, height);
          resolve(tempCanvas.toDataURL('image/png', 0.95));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    }) as any;
  }

  /**
   * Save captured image with metadata
   */
  saveCapturedImage(
    dataUrl: string,
    caption: string,
    metadata: CapturedImage['metadata']
  ): CapturedImage {
    const image: CapturedImage = {
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dataUrl,
      caption,
      timestamp: new Date(),
      metadata
    };

    this.capturedImages.push(image);
    console.log('💾 Image saved:', image.id, caption);

    return image;
  }

  /**
   * Get all captured images
   */
  getCapturedImages(): CapturedImage[] {
    return this.capturedImages;
  }

  /**
   * Get image by ID
   */
  getImageById(id: string): CapturedImage | undefined {
    return this.capturedImages.find(img => img.id === id);
  }

  /**
   * Remove image
   */
  removeImage(id: string): void {
    this.capturedImages = this.capturedImages.filter(img => img.id !== id);
    console.log('🗑️ Image removed:', id);
  }

  /**
   * Clear all images
   */
  clearAllImages(): void {
    this.capturedImages = [];
    console.log('🗑️ All images cleared');
  }

  /**
   * Update image caption
   */
  updateCaption(id: string, caption: string): void {
    const image = this.getImageById(id);
    if (image) {
      image.caption = caption;
      console.log('✏️ Caption updated:', id, caption);
    }
  }

  /**
   * Export images for report
   */
  exportForReport(): Array<{ id: string; dataUrl: string; caption: string }> {
    return this.capturedImages.map(img => ({
      id: img.id,
      dataUrl: img.dataUrl,
      caption: img.caption
    }));
  }

  /**
   * Download image
   */
  downloadImage(id: string, filename?: string): void {
    const image = this.getImageById(id);
    if (!image) {
      console.error('❌ Image not found:', id);
      return;
    }

    const link = document.createElement('a');
    link.href = image.dataUrl;
    link.download = filename || `medical-image-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('⬇️ Image downloaded:', filename);
  }

  /**
   * Get image count
   */
  getImageCount(): number {
    return this.capturedImages.length;
  }

  /**
   * Create thumbnail
   */
  createThumbnail(dataUrl: string, size: number = 150): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Calculate thumbnail dimensions (maintain aspect ratio)
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > size) {
            height = (height * size) / width;
            width = size;
          }
        } else {
          if (height > size) {
            width = (width * size) / height;
            height = size;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/png', 0.8));
      };
      img.src = dataUrl;
    });
  }
}

// Singleton instance
export const screenshotService = new ScreenshotService();
