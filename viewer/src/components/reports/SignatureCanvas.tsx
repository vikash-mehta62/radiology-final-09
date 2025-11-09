import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Paper,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Clear as ClearIcon,
  Undo as UndoIcon,
  Save as SaveIcon,
  Edit as EditIcon
} from '@mui/icons-material';

interface SignatureCanvasProps {
  onSave: (signatureDataUrl: string) => void;
  width?: number;
  height?: number;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onSave,
  width = 500,
  height = 200
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setContext(ctx);
        
        // Set white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
    }
  }, [width, height]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!context) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    setIsEmpty(false);
    
    // Save state for undo
    saveState();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !context) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
  };

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas || !context) return;
    
    const imageData = context.getImageData(0, 0, width, height);
    setHistory(prev => [...prev, imageData]);
  };

  const clear = () => {
    if (!context) return;
    
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    setHistory([]);
    setIsEmpty(true);
  };

  const undo = () => {
    if (!context || history.length === 0) return;
    
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    
    if (newHistory.length > 0) {
      const previousState = newHistory[newHistory.length - 1];
      context.putImageData(previousState, 0, 0);
    } else {
      clear();
    }
    
    setHistory(newHistory);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) {
      alert('⚠️ Please draw your signature first');
      return;
    }
    
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        display: 'inline-block',
        backgroundColor: '#f5f5f5'
      }}
    >
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">
            Draw Your Signature
          </Typography>
        </Box>
        
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Undo">
            <IconButton
              onClick={undo}
              disabled={history.length === 0}
              size="small"
            >
              <UndoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Clear">
            <IconButton
              onClick={clear}
              disabled={isEmpty}
              size="small"
              color="error"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ButtonGroup>
      </Box>

      <Box
        sx={{
          border: '2px solid #1976d2',
          borderRadius: 1,
          backgroundColor: '#ffffff',
          cursor: 'crosshair',
          display: 'inline-block'
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            display: 'block',
            touchAction: 'none'
          }}
        />
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="success"
          startIcon={<SaveIcon />}
          onClick={save}
          disabled={isEmpty}
          size="large"
        >
          Save Signature
        </Button>
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1, textAlign: 'center' }}
      >
        Draw your signature using mouse or touchpad
      </Typography>
    </Paper>
  );
};

export default SignatureCanvas;
