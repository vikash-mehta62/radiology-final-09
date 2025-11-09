import React, { useState, useEffect } from 'react';
import { Box, Alert, CircularProgress, Chip } from '@mui/material';
import EnhancedCineControls from './EnhancedCineControls';
import StructuredReportViewer from './StructuredReportViewer';
import { isDopplerImage, renderDopplerToCanvas, DOPPLER_COLOR_MAPS } from '../../utils/colorDopplerRenderer';
import { isColorImage } from '../../utils/colorImageRenderer';

interface SmartModalityViewerProps {
  instanceId: string;
  metadata: any;
  children?: React.ReactNode; // Existing viewer component
}

/**
 * Smart Modality Viewer
 * Automatically detects modality and applies appropriate rendering
 * Wraps existing viewer without breaking it
 */
const SmartModalityViewer: React.FC<SmartModalityViewerProps> = ({
  instanceId,
  metadata,
  children
}) => {
  const [viewerType, setViewerType] = useState<'standard' | 'cine' | 'doppler' | 'sr'>('standard');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(15);

  useEffect(() => {
    detectViewerType();
  }, [metadata]);

  const detectViewerType = () => {
    const modality = metadata?.Modality || metadata?.modality;
    const numberOfFrames = parseInt(metadata?.NumberOfFrames || '1');
    const sopClassUID = metadata?.SOPClassUID;

    // Structured Report
    if (sopClassUID?.includes('1.2.840.10008.5.1.4.1.1.88')) {
      setViewerType('sr');
      return;
    }

    // Color Image (Echocardiogram, Color US)
    if (isColorImage(metadata)) {
      console.log('🎨 Color image detected:', metadata.PhotometricInterpretation);
      setViewerType('doppler'); // Use doppler viewer type for color rendering
      return;
    }

    // Color Doppler Ultrasound
    if (isDopplerImage(metadata)) {
      setViewerType('doppler');
      return;
    }

    // Multi-frame/Cine (Ultrasound, XA, etc.)
    if (numberOfFrames > 1 && (modality === 'US' || modality === 'XA' || modality === 'RF')) {
      setViewerType('cine');
      return;
    }

    // Standard viewer for everything else
    setViewerType('standard');
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const totalFrames = parseInt(metadata?.NumberOfFrames || '1');

  // Render based on detected type
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Modality Badge */}
      <Chip
        label={`${metadata?.Modality || 'Unknown'} - ${viewerType.toUpperCase()}`}
        color="primary"
        size="small"
        sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}
      />

      {/* Structured Report Viewer */}
      {viewerType === 'sr' && (
        <StructuredReportViewer instanceId={instanceId} />
      )}

      {/* Standard/Doppler/Cine - Use existing viewer */}
      {viewerType !== 'sr' && (
        <>
          {/* Existing viewer component */}
          <Box sx={{ height: viewerType === 'cine' ? 'calc(100% - 150px)' : '100%' }}>
            {children}
          </Box>

          {/* Enhanced Cine Controls for multi-frame */}
          {/* {viewerType === 'cine' && totalFrames > 1 && (
            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.8)' }}>
              <EnhancedCineControls
                currentFrame={currentFrame}
                totalFrames={totalFrames}
                isPlaying={isPlaying}
                fps={fps}
                onFrameChange={setCurrentFrame}
                onPlayPause={handlePlayPause}
                onFpsChange={setFps}
              />
            </Box>
          )} */}

          {/* Color Image Indicator */}
          {viewerType === 'doppler' && (
            <Box sx={{ position: 'absolute', top: 60, right: 10 }}>
              <Alert severity="info" sx={{ mb: 1 }}>
                {isColorImage(metadata) ? 'Color Image Detected' : 'Color Doppler Detected'}
              </Alert>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default SmartModalityViewer;
