/**
 * Captured Images Gallery
 * Shows all captured screenshots with preview and management
 */

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Grid,
  Chip,
} from '@mui/material'
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
} from '@mui/icons-material'
import { screenshotService, CapturedImage } from '../../services/screenshotService'

interface CapturedImagesGalleryProps {
  open: boolean
  onClose: () => void
}

export const CapturedImagesGallery: React.FC<CapturedImagesGalleryProps> = ({
  open,
  onClose
}) => {
  const [images, setImages] = React.useState<CapturedImage[]>([])

  // Load images when dialog opens
  React.useEffect(() => {
    if (open) {
      setImages(screenshotService.getCapturedImages())
    }
  }, [open])

  const handleDelete = (id: string) => {
    screenshotService.removeImage(id)
    setImages(screenshotService.getCapturedImages())
  }

  const handleDownload = (id: string) => {
    screenshotService.downloadImage(id)
  }

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all captured images?')) {
      screenshotService.clearAllImages()
      setImages([])
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">
              📸 Captured Images
            </Typography>
            <Chip label={`${images.length} images`} color="primary" size="small" />
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {images.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No images captured yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Use the camera button in the toolbar to capture images
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {images.map((image) => (
              <Grid item xs={12} sm={6} md={4} key={image.id}>
                <Card>
                  <CardMedia
                    component="img"
                    height="200"
                    image={image.dataUrl}
                    alt={image.caption}
                    sx={{ objectFit: 'contain', bgcolor: 'black' }}
                  />
                  <CardContent>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      {image.caption}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {new Date(image.timestamp).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Frame: {(image.metadata.frameIndex || 0) + 1}
                    </Typography>
                    {image.metadata.hasAIOverlay && (
                      <Chip label="AI Overlay" size="small" color="primary" sx={{ mt: 1, mr: 0.5 }} />
                    )}
                    {image.metadata.hasAnnotations && (
                      <Chip label="Annotations" size="small" color="secondary" sx={{ mt: 1 }} />
                    )}
                  </CardContent>
                  <CardActions>
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(image.id)}
                      title="Download"
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(image.id)}
                      title="Delete"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        {images.length > 0 && (
          <Button
            onClick={handleClearAll}
            color="error"
            startIcon={<DeleteIcon />}
          >
            Clear All
          </Button>
        )}
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CapturedImagesGallery
