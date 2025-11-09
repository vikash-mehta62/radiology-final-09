const fs = require('fs');
const path = require('path');

/**
 * Upload signature image to filesystem
 * Cloudinary removed - using local storage
 */
exports.uploadSignature = async (req, res) => {
  try {
    const { signatureDataUrl, reportId, radiologistName } = req.body;

    if (!signatureDataUrl) {
      return res.status(400).json({
        success: false,
        error: 'Signature data is required'
      });
    }

    // Create signatures directory
    const signaturesDir = path.join(__dirname, '../../backend/signatures');
    if (!fs.existsSync(signaturesDir)) {
      fs.mkdirSync(signaturesDir, { recursive: true });
    }

    // Extract base64 data
    const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filename
    const filename = `signature_${reportId || Date.now()}.png`;
    const filepath = path.join(signaturesDir, filename);

    // Save to filesystem
    fs.writeFileSync(filepath, buffer);

    const signatureUrl = `/api/signature/file/${filename}`;

    console.log('✅ Signature saved to filesystem:', filepath);

    res.json({
      success: true,
      data: {
        signatureUrl: signatureUrl,
        filename: filename,
        uploadedAt: new Date().toISOString(),
        reportId: reportId,
        radiologist: radiologistName
      },
      message: 'Signature uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload signature',
      details: error.message
    });
  }
};

/**
 * Get signature file
 */
exports.getSignature = async (req, res) => {
  try {
    const { filename } = req.params;

    const signaturesDir = path.join(__dirname, '../../backend/signatures');
    const filepath = path.join(signaturesDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'Signature not found'
      });
    }

    // Send file
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(filepath);

  } catch (error) {
    console.error('Error fetching signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch signature',
      details: error.message
    });
  }
};

/**
 * Delete signature
 */
exports.deleteSignature = async (req, res) => {
  try {
    const { filename } = req.params;

    const signaturesDir = path.join(__dirname, '../../backend/signatures');
    const filepath = path.join(signaturesDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'Signature not found or already deleted'
      });
    }

    // Delete file
    fs.unlinkSync(filepath);

    res.json({
      success: true,
      message: 'Signature deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete signature',
      details: error.message
    });
  }
};
