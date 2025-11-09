/**
 * Anatomical Diagram Panel
 * Interactive body diagrams for marking findings
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Chip,
  Button
} from '@mui/material';
import {
  Place as PointIcon,
  RadioButtonUnchecked as CircleIcon,
  ArrowForward as ArrowIcon,
  Gesture as FreehandIcon,
  Delete as DeleteIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon
} from '@mui/icons-material';
import { useReporting, type AnatomicalMarking } from '../../../contexts/ReportingContext';

// Body diagram configurations with Wikimedia Commons SVGs
const BODY_DIAGRAMS = {
  'CT': {
    'Head/Brain': ['axial', 'sagittal', 'coronal'],
    'Chest': ['frontal', 'lateral', 'axial'],
    'Abdomen': ['frontal', 'quadrants'],
    'Spine': ['frontal', 'lateral'],
    'Pelvis': ['frontal'],
    'Full Body': ['neutral_frontal', 'female_frontal']
  },
  'MRI': {
    'Head/Brain': ['axial', 'sagittal', 'coronal'],
    'Spine': ['frontal', 'lateral'],
    'Extremities': ['hand', 'shoulder', 'knee']
  },
  'XA': {
    'Chest': ['frontal', 'lateral'],
    'Abdomen': ['frontal', 'quadrants'],
    'Extremities': ['hand', 'shoulder', 'knee'],
    'Spine': ['frontal', 'lateral']
  },
  'X-Ray': {
    'Chest': ['frontal', 'lateral'],
    'Abdomen': ['frontal', 'quadrants'],
    'Extremities': ['hand', 'shoulder', 'knee'],
    'Spine': ['frontal', 'lateral']
  }
};

// Diagram file mapping (matches downloaded files from Wikimedia)
const DIAGRAM_FILE_MAP: Record<string, Record<string, string>> = {
  'headbrain': {
    'axial': 'headbrain-axial.svg',
    'sagittal': 'headbrain-sagittal.svg',
    'coronal': 'headbrain-coronal.svg'
  },
  'chest': {
    'frontal': 'chest-frontal.svg',
    'lateral': 'chest-lateral.svg',
    'axial': 'chest-axial.svg'
  },
  'abdomen': {
    'frontal': 'abdomen-frontal.svg',
    'quadrants': 'abdomen-quadrants.svg'
  },
  'spine': {
    'frontal': 'spine-frontal.svg',
    'lateral': 'spine-lateral.svg'
  },
  'pelvis': {
    'frontal': 'pelvis-frontal.svg'
  },
  'fullbody': {
    'neutral_frontal': 'fullbody-neutral_frontal.svg',
    'female_frontal': 'fullbody-female_frontal.svg'
  },
  'extremities': {
    'hand': 'extremities-hand.svg',
    'shoulder': 'extremities-shoulder.svg',
    'knee': 'extremities-knee.svg'
  }
};

const AnatomicalDiagramPanel: React.FC = () => {
  const { state, actions } = useReporting();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('Chest');
  const [selectedView, setSelectedView] = useState<string>('frontal');
  const [drawingTool, setDrawingTool] = useState<'point' | 'circle' | 'arrow' | 'freehand' | 'ruler' | 'angle'>('point');
  const [drawingColor, setDrawingColor] = useState<string>('#ff0000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [measurements, setMeasurements] = useState<Array<{ id: string; type: string; value: number; points: any[]; label: string }>>([]);
  const [measurementPoints, setMeasurementPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [diagramImage, setDiagramImage] = useState<HTMLImageElement | null>(null);
  
  // Get available views for current modality and body part
  const availableBodyParts = BODY_DIAGRAMS[state.patientInfo.modality as keyof typeof BODY_DIAGRAMS] || BODY_DIAGRAMS['CT'];
  const availableViews = availableBodyParts[selectedBodyPart as keyof typeof availableBodyParts] || ['frontal'];
  
  // Handle canvas click for point marking and measurements
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (drawingTool === 'point') {
      addMarking({
        type: 'point',
        coordinates: { x, y },
        anatomicalLocation: `${selectedBodyPart} - ${selectedView}`
      });
    } else if (drawingTool === 'ruler') {
      // Ruler needs 2 points
      const newPoints = [...measurementPoints, { x, y }];
      setMeasurementPoints(newPoints);
      
      if (newPoints.length === 2) {
        // Calculate distance
        const dx = newPoints[1].x - newPoints[0].x;
        const dy = newPoints[1].y - newPoints[0].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Assume 1 pixel = 0.5mm (this should be calibrated)
        const distanceMM = distance * 0.5;
        
        const measurement = {
          id: `measure-${Date.now()}`,
          type: 'ruler',
          value: distanceMM,
          points: newPoints,
          label: `Distance: ${distanceMM.toFixed(1)} mm`
        };
        
        setMeasurements([...measurements, measurement]);
        setMeasurementPoints([]);
        redrawCanvas();
      }
    } else if (drawingTool === 'angle') {
      // Angle needs 3 points
      const newPoints = [...measurementPoints, { x, y }];
      setMeasurementPoints(newPoints);
      
      if (newPoints.length === 3) {
        // Calculate angle
        const [p1, p2, p3] = newPoints;
        const angle1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        let angleDeg = ((angle2 - angle1) * 180 / Math.PI);
        if (angleDeg < 0) angleDeg += 360;
        if (angleDeg > 180) angleDeg = 360 - angleDeg;
        
        const measurement = {
          id: `measure-${Date.now()}`,
          type: 'angle',
          value: angleDeg,
          points: newPoints,
          label: `Angle: ${angleDeg.toFixed(1)}°`
        };
        
        setMeasurements([...measurements, measurement]);
        setMeasurementPoints([]);
        redrawCanvas();
      }
    }
  };
  
  // Handle mouse down for drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawingTool === 'freehand') {
      setIsDrawing(true);
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrentPath([{ x, y }]);
    }
  };
  
  // Handle mouse move for drawing
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing && drawingTool === 'freehand') {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrentPath([...currentPath, { x, y }]);
      
      // Draw on canvas
      const ctx = canvasRef.current!.getContext('2d');
      if (ctx && currentPath.length > 0) {
        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };
  
  // Handle mouse up for drawing
  const handleMouseUp = () => {
    if (isDrawing && drawingTool === 'freehand' && currentPath.length > 1) {
      addMarking({
        type: 'freehand',
        coordinates: {
          x: currentPath[0].x,
          y: currentPath[0].y,
          points: currentPath
        },
        anatomicalLocation: `${selectedBodyPart} - ${selectedView}`
      });
    }
    setIsDrawing(false);
    setCurrentPath([]);
  };
  
  // Add marking and create linked finding
  const addMarking = (markingData: Partial<AnatomicalMarking>) => {
    const marking: AnatomicalMarking = {
      id: `marking-${Date.now()}`,
      type: markingData.type || 'point',
      anatomicalLocation: markingData.anatomicalLocation || selectedBodyPart,
      coordinates: markingData.coordinates || { x: 0, y: 0 },
      view: selectedView,
      color: drawingColor,
      timestamp: new Date()
    };
    
    actions.addMarking(marking);
    
    // Auto-create linked finding
    const finding = {
      id: `finding-${Date.now()}`,
      location: marking.anatomicalLocation,
      description: `Finding marked on ${selectedBodyPart} (${selectedView} view)`,
      severity: 'normal' as const,
      coordinates: marking.coordinates,
      linkedMarkingId: marking.id
    };
    
    actions.addFinding(finding);
    
    // Draw on canvas
    drawMarking(marking);
  };
  
  // Draw marking on canvas
  const drawMarking = (marking: AnatomicalMarking) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = marking.color;
    ctx.strokeStyle = marking.color;
    ctx.lineWidth = 2;
    
    switch (marking.type) {
      case 'point':
        ctx.beginPath();
        ctx.arc(marking.coordinates.x, marking.coordinates.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        break;
        
      case 'circle':
        ctx.beginPath();
        ctx.arc(
          marking.coordinates.x, 
          marking.coordinates.y, 
          marking.coordinates.width || 20, 
          0, 
          2 * Math.PI
        );
        ctx.stroke();
        break;
        
      case 'freehand':
        if (marking.coordinates.points && marking.coordinates.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(marking.coordinates.points[0].x, marking.coordinates.points[0].y);
          marking.coordinates.points.forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
        break;
    }
  };
  
  // Redraw all markings for current view
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw diagram image if loaded
    if (diagramImage) {
      ctx.drawImage(diagramImage, 0, 0, canvas.width, canvas.height);
    } else {
      // Draw placeholder if image not loaded
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#ccc';
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      // Draw text placeholder
      ctx.fillStyle = '#999';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${selectedBodyPart} - ${selectedView} View`, canvas.width / 2, canvas.height / 2);
      ctx.font = '12px Arial';
      ctx.fillText('(Loading diagram...)', canvas.width / 2, canvas.height / 2 + 20);
    }
    
    // Redraw all markings for this view
    state.anatomicalMarkings
      .filter(m => m.view === selectedView)
      .forEach(marking => drawMarking(marking));
    
    // Draw measurements
    measurements.forEach(measurement => drawMeasurement(measurement, ctx));
  };
  
  // Draw measurement on canvas
  const drawMeasurement = (measurement: any, ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#0066ff';
    ctx.fillStyle = '#0066ff';
    ctx.lineWidth = 2;
    ctx.font = '12px Arial';
    
    if (measurement.type === 'ruler' && measurement.points.length === 2) {
      const [p1, p2] = measurement.points;
      
      // Draw line
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      
      // Draw endpoints
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw measurement label
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(midX - 30, midY - 10, 60, 20);
      ctx.fillStyle = '#0066ff';
      ctx.textAlign = 'center';
      ctx.fillText(`${measurement.value.toFixed(1)} mm`, midX, midY + 5);
    } else if (measurement.type === 'angle' && measurement.points.length === 3) {
      const [p1, p2, p3] = measurement.points;
      
      // Draw lines
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
      
      // Draw points
      [p1, p2, p3].forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
      
      // Draw angle arc
      const angle1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 30, angle1, angle2);
      ctx.stroke();
      
      // Draw angle label
      ctx.fillStyle = '#fff';
      ctx.fillRect(p2.x - 25, p2.y - 40, 50, 20);
      ctx.fillStyle = '#0066ff';
      ctx.textAlign = 'center';
      ctx.fillText(`${measurement.value.toFixed(1)}°`, p2.x, p2.y - 25);
    }
  };
  
  // Load diagram image when body part or view changes
  React.useEffect(() => {
    const loadDiagram = async () => {
      const img = new Image();
      
      // Get diagram file from map
      const bodyPartKey = selectedBodyPart.toLowerCase().replace(/\//g, '').replace(/\s+/g, '');
      const diagramFile = DIAGRAM_FILE_MAP[bodyPartKey]?.[selectedView];
      
      if (diagramFile) {
        const diagramPath = `/diagrams/${diagramFile}`;
        
        img.onload = () => {
          console.log(`✅ Loaded diagram: ${diagramPath}`);
          setDiagramImage(img);
          redrawCanvas();
        };
        
        img.onerror = () => {
          console.warn(`⚠️ Diagram not found: ${diagramPath}, using placeholder`);
          setDiagramImage(null);
          redrawCanvas();
        };
        
        img.src = diagramPath;
      } else {
        console.warn(`⚠️ No diagram mapping for: ${bodyPartKey} - ${selectedView}`);
        setDiagramImage(null);
        redrawCanvas();
      }
    };
    
    loadDiagram();
  }, [selectedView, selectedBodyPart]);
  
  // Redraw when view changes
  React.useEffect(() => {
    redrawCanvas();
  }, [selectedView, selectedBodyPart, state.anatomicalMarkings, measurements, diagramImage]);
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
        Anatomical Diagram
      </Typography>
      
      {/* Body Part Selector */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Body Part</InputLabel>
        <Select
          value={selectedBodyPart}
          label="Body Part"
          onChange={(e) => {
            setSelectedBodyPart(e.target.value);
            setSelectedView(availableBodyParts[e.target.value as keyof typeof availableBodyParts]?.[0] || 'frontal');
          }}
        >
          {Object.keys(availableBodyParts).map(part => (
            <MenuItem key={part} value={part}>{part}</MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* View Selector */}
      <Box mb={2}>
        <Typography variant="caption" display="block" gutterBottom>
          View
        </Typography>
        <ToggleButtonGroup
          value={selectedView}
          exclusive
          onChange={(_, value) => value && setSelectedView(value)}
          size="small"
          fullWidth
        >
          {availableViews.map(view => (
            <ToggleButton key={view} value={view}>
              {view}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      
      {/* Drawing Tools */}
      <Paper elevation={1} sx={{ p: 1, mb: 2 }}>
        <Typography variant="caption" display="block" gutterBottom>
          Drawing Tools
        </Typography>
        <Box display="flex" gap={0.5} mb={1} flexWrap="wrap">
          <Tooltip title="Point Marker">
            <IconButton
              size="small"
              color={drawingTool === 'point' ? 'primary' : 'default'}
              onClick={() => { setDrawingTool('point'); setMeasurementPoints([]); }}
            >
              <PointIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Circle">
            <IconButton
              size="small"
              color={drawingTool === 'circle' ? 'primary' : 'default'}
              onClick={() => { setDrawingTool('circle'); setMeasurementPoints([]); }}
            >
              <CircleIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Arrow">
            <IconButton
              size="small"
              color={drawingTool === 'arrow' ? 'primary' : 'default'}
              onClick={() => { setDrawingTool('arrow'); setMeasurementPoints([]); }}
            >
              <ArrowIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Freehand">
            <IconButton
              size="small"
              color={drawingTool === 'freehand' ? 'primary' : 'default'}
              onClick={() => { setDrawingTool('freehand'); setMeasurementPoints([]); }}
            >
              <FreehandIcon />
            </IconButton>
          </Tooltip>
          
          <Box sx={{ width: '100%', my: 0.5, borderTop: 1, borderColor: 'divider' }} />
          
          <Tooltip title="Ruler (Measure Distance) - Click 2 points">
            <IconButton
              size="small"
              color={drawingTool === 'ruler' ? 'secondary' : 'default'}
              onClick={() => { setDrawingTool('ruler'); setMeasurementPoints([]); }}
              sx={{ bgcolor: drawingTool === 'ruler' ? 'secondary.light' : 'transparent' }}
            >
              <Typography sx={{ fontSize: '18px' }}>📏</Typography>
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Angle (Measure Angle) - Click 3 points">
            <IconButton
              size="small"
              color={drawingTool === 'angle' ? 'secondary' : 'default'}
              onClick={() => { setDrawingTool('angle'); setMeasurementPoints([]); }}
              sx={{ bgcolor: drawingTool === 'angle' ? 'secondary.light' : 'transparent' }}
            >
              <Typography sx={{ fontSize: '18px' }}>📐</Typography>
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Measurement Instructions */}
        {(drawingTool === 'ruler' || drawingTool === 'angle') && (
          <Box sx={{ bgcolor: 'info.light', p: 1, borderRadius: 1, mb: 1 }}>
            <Typography variant="caption">
              {drawingTool === 'ruler' 
                ? `📏 Click 2 points to measure distance (${measurementPoints.length}/2)`
                : `📐 Click 3 points to measure angle (${measurementPoints.length}/3)`
              }
            </Typography>
          </Box>
        )}
        
        {/* Color Picker */}
        <Box display="flex" gap={1}>
          {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'].map(color => (
            <Box
              key={color}
              sx={{
                width: 24,
                height: 24,
                bgcolor: color,
                border: drawingColor === color ? 3 : 1,
                borderColor: drawingColor === color ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer'
              }}
              onClick={() => setDrawingColor(color)}
            />
          ))}
        </Box>
      </Paper>
      
      {/* Canvas */}
      <Paper elevation={2} sx={{ mb: 2, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={400}
          height={500}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ 
            cursor: 'crosshair',
            display: 'block',
            width: '100%'
          }}
        />
      </Paper>
      
      {/* Canvas Actions */}
      <Box display="flex" gap={1} mb={2}>
        <Button 
          fullWidth 
          variant="outlined" 
          size="small"
          onClick={redrawCanvas}
        >
          Refresh Canvas
        </Button>
        <Button 
          fullWidth 
          variant="contained" 
          size="small"
          color="primary"
          onClick={() => {
            if (canvasRef.current) {
              const dataUrl = canvasRef.current.toDataURL('image/png');
              actions.addKeyImage({
                id: `img-${Date.now()}`,
                dataUrl,
                timestamp: new Date(),
                description: `${selectedBodyPart} - ${selectedView} view with ${state.anatomicalMarkings.length} marking(s)`
              });
              // Show success message
              alert('Canvas snapshot saved to key images!');
            }
          }}
        >
          📸 Save Snapshot
        </Button>
      </Box>
      
      {/* Measurements List */}
      {measurements.length > 0 && (
        <>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Measurements ({measurements.length})
          </Typography>
          <List dense>
            {measurements.map(measurement => (
              <ListItem 
                key={measurement.id}
                sx={{ 
                  border: 1, 
                  borderColor: 'divider', 
                  borderRadius: 1, 
                  mb: 1,
                  bgcolor: 'info.light'
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography sx={{ fontSize: '16px' }}>
                        {measurement.type === 'ruler' ? '📏' : '📐'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {measurement.label}
                      </Typography>
                    </Box>
                  }
                  secondary={`${measurement.type === 'ruler' ? 'Distance' : 'Angle'} measurement`}
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      setMeasurements(measurements.filter(m => m.id !== measurement.id));
                      redrawCanvas();
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </>
      )}
      
      {/* Markings List */}
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
        Markings ({state.anatomicalMarkings.length})
      </Typography>
      
      {state.anatomicalMarkings.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No markings yet. Click on the diagram to add markings.
        </Typography>
      ) : (
        <List dense>
          {state.anatomicalMarkings.map(marking => (
            <ListItem 
              key={marking.id}
              sx={{ 
                border: 1, 
                borderColor: 'divider', 
                borderRadius: 1, 
                mb: 1,
                bgcolor: 'background.default'
              }}
            >
              <ListItemText
                primary={marking.anatomicalLocation}
                secondary={`${marking.type} - ${marking.view} view`}
              />
              <ListItemSecondaryAction>
                <IconButton 
                  size="small" 
                  onClick={() => actions.deleteMarking(marking.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default AnatomicalDiagramPanel;
