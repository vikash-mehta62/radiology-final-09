/**
 * Image Embedding Utilities
 * Handles inline image embedding with captions
 */

const sharp = require('sharp');

/**
 * Process and validate image data
 * @param {String|Buffer} imageData - Base64 string or Buffer
 * @returns {Object} Processed image data
 */
async function processImageData(imageData) {
  try {
    let buffer;

    // Convert to buffer if base64 string
    if (typeof imageData === 'string') {
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else if (Buffer.isBuffer(imageData)) {
      buffer = imageData;
    } else {
      throw new Error('Invalid image data format');
    }

    // Get image metadata
    const metadata = await sharp(buffer).metadata();

    return {
      buffer,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
      isValid: true
    };

  } catch (error) {
    return {
      buffer: null,
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Optimize image for embedding
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Optimization options
 * @returns {Buffer} Optimized image buffer
 */
async function optimizeImage(imageBuffer, options = {}) {
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 85,
    format = 'jpeg'
  } = options;

  try {
    let image = sharp(imageBuffer);

    // Get current dimensions
    const metadata = await image.metadata();

    // Resize if needed
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      image = image.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to specified format
    if (format === 'jpeg') {
      image = image.jpeg({ quality });
    } else if (format === 'png') {
      image = image.png({ quality });
    }

    return await image.toBuffer();

  } catch (error) {
    console.error('Error optimizing image:', error);
    return imageBuffer; // Return original if optimization fails
  }
}

/**
 * Generate image caption
 * @param {Object} frame - Frame data
 * @param {Object} options - Caption options
 * @returns {String} Caption text
 */
function generateCaption(frame, options = {}) {
  const {
    includeFrameIndex = true,
    includeTimestamp = true,
    includeClassification = false,
    includeConfidence = false,
    customPrefix = null
  } = options;

  let caption = customPrefix || 'Frame';

  if (includeFrameIndex && frame.frameIndex !== undefined) {
    caption += ` ${frame.frameIndex}`;
  }

  if (includeClassification && frame.classification) {
    const label = frame.classification.label || frame.classification;
    caption += ` - ${label}`;
  }

  if (includeConfidence && frame.classification?.confidence !== undefined) {
    caption += ` (${(frame.classification.confidence * 100).toFixed(1)}% confidence)`;
  }

  if (includeTimestamp) {
    const timestamp = frame.timestamp || frame.analyzedAt || new Date();
    caption += `, captured at ${new Date(timestamp).toLocaleString()}`;
  }

  return caption;
}

/**
 * Embed image in PDF document
 * @param {Object} doc - PDFKit document
 * @param {Object} imageData - Image data with buffer
 * @param {Object} options - Embedding options
 */
async function embedImageInPDF(doc, imageData, options = {}) {
  const {
    maxWidth = 400,
    maxHeight = 300,
    align = 'center',
    caption = null,
    captionStyle = {}
  } = options;

  try {
    if (!imageData || !imageData.buffer) {
      // Show placeholder if no image
      doc.fontSize(9)
         .fillColor('#999999')
         .text('[Image not available]', { align: 'center' });
      return;
    }

    // Optimize image for PDF
    const optimizedBuffer = await optimizeImage(imageData.buffer, {
      maxWidth,
      maxHeight,
      quality: 85,
      format: 'jpeg'
    });

    // Embed image
    doc.image(optimizedBuffer, {
      fit: [maxWidth, maxHeight],
      align: align
    });

    // Add caption if provided
    if (caption) {
      doc.moveDown(0.3);
      doc.fontSize(captionStyle.fontSize || 9)
         .fillColor(captionStyle.color || '#666666')
         .font(captionStyle.font || 'Helvetica')
         .text(caption, { align: 'center' });
    }

  } catch (error) {
    console.error('Error embedding image in PDF:', error);
    doc.fontSize(9)
       .fillColor('#999999')
       .text('[Error loading image]', { align: 'center' });
  }
}

/**
 * Embed image in HTML report
 * @param {Object} imageData - Image data
 * @param {Object} options - Embedding options
 * @returns {String} HTML img tag
 */
function embedImageInHTML(imageData, options = {}) {
  const {
    maxWidth = 600,
    caption = null,
    alt = 'Medical image',
    className = 'medical-image'
  } = options;

  if (!imageData || !imageData.data) {
    return `<div class="image-placeholder">[Image not available]</div>`;
  }

  let html = `<figure class="medical-image-container">`;
  html += `<img src="${imageData.data}" alt="${alt}" class="${className}" style="max-width: ${maxWidth}px;" />`;
  
  if (caption) {
    html += `<figcaption>${caption}</figcaption>`;
  }
  
  html += `</figure>`;

  return html;
}

/**
 * Validate image data for embedding
 * @param {Object} imageData - Image data to validate
 * @returns {Object} Validation result
 */
async function validateImageForEmbedding(imageData) {
  const validation = {
    isValid: false,
    errors: [],
    warnings: [],
    metadata: null
  };

  if (!imageData) {
    validation.errors.push('No image data provided');
    return validation;
  }

  // Check if data exists
  if (!imageData.data && !imageData.buffer) {
    validation.errors.push('Image data or buffer is missing');
    return validation;
  }

  try {
    // Process and validate
    const processed = await processImageData(imageData.data || imageData.buffer);

    if (!processed.isValid) {
      validation.errors.push(processed.error);
      return validation;
    }

    validation.metadata = {
      format: processed.format,
      width: processed.width,
      height: processed.height,
      size: processed.size,
      sizeKB: (processed.size / 1024).toFixed(2)
    };

    // Check size limits
    if (processed.size > 10 * 1024 * 1024) { // 10MB
      validation.warnings.push('Image size exceeds 10MB, may cause performance issues');
    }

    // Check dimensions
    if (processed.width > 4000 || processed.height > 4000) {
      validation.warnings.push('Image dimensions are very large, consider resizing');
    }

    validation.isValid = true;

  } catch (error) {
    validation.errors.push(`Validation error: ${error.message}`);
  }

  return validation;
}

/**
 * Extract and prepare images from frames
 * @param {Array} frames - Array of frame data
 * @returns {Promise<Array>} Processed images
 */
async function prepareImagesFromFrames(frames) {
  if (!Array.isArray(frames)) {
    return [];
  }

  const processedImages = [];

  for (const frame of frames) {
    if (!frame.imageSnapshot) {
      processedImages.push({
        frameIndex: frame.frameIndex,
        available: false,
        reason: 'No image snapshot'
      });
      continue;
    }

    try {
      const processed = await processImageData(frame.imageSnapshot.data || frame.imageSnapshot);
      
      if (processed.isValid) {
        processedImages.push({
          frameIndex: frame.frameIndex,
          available: true,
          buffer: processed.buffer,
          metadata: {
            format: processed.format,
            width: processed.width,
            height: processed.height,
            size: processed.size
          },
          caption: generateCaption(frame, {
            includeFrameIndex: true,
            includeTimestamp: true,
            includeClassification: true
          })
        });
      } else {
        processedImages.push({
          frameIndex: frame.frameIndex,
          available: false,
          reason: processed.error
        });
      }

    } catch (error) {
      processedImages.push({
        frameIndex: frame.frameIndex,
        available: false,
        reason: error.message
      });
    }
  }

  return processedImages;
}

module.exports = {
  processImageData,
  optimizeImage,
  generateCaption,
  embedImageInPDF,
  embedImageInHTML,
  validateImageForEmbedding,
  prepareImagesFromFrames
};
