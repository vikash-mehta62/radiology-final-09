/**
 * Modern UI/UX Enhancements
 * Best-in-class design components and animations
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Fade,
  Slide,
  Zoom,
  Collapse,
  IconButton,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  Favorite as FavoriteIcon,
  ExpandMore as ExpandIcon,
  TrendingUp as TrendingIcon
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';

// Animated components
const pulseAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const slideInAnimation = keyframes`
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const AnimatedCard = styled(Card)(({ theme }) => ({
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    '& .card-actions': {
      opacity: 1,
      transform: 'translateY(0)'
    }
  }
}));

const GlassCard = styled(Paper)(({ theme }) => ({
  background: alpha(theme.palette.background.paper, 0.8),
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  borderRadius: theme.spacing(2)
}));

const PulseButton = styled(Button)({
  animation: `${pulseAnimation} 2s infinite`,
  '&:hover': {
    animation: 'none'
  }
});

interface ModernUIEnhancementsProps {
  data?: any[];
  onAction?: (action: string, item: any) => void;
}

const ModernUIEnhancements: React.FC<ModernUIEnhancementsProps> = ({
  data = [],
  onAction
}) => {
  const theme = useTheme();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());

  const handleCardExpand = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const handleFavorite = (itemId: string) => {
    const newFavorites = new Set(favoriteItems);
    if (newFavorites.has(itemId)) {
      newFavorites.delete(itemId);
    } else {
      newFavorites.add(itemId);
    }
    setFavoriteItems(newFavorites);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Hero Section with Glass Effect */}
      <GlassCard elevation={0} sx={{ p: 4, mb: 4, textAlign: 'center' }}>
        <Zoom in timeout={1000}>
          <Box>
            <Typography variant="h3" gutterBottom sx={{ 
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 'bold'
            }}>
              Advanced Reporting System
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
              Experience the future of medical reporting with our modern interface
            </Typography>
            <PulseButton variant="contained" size="large" startIcon={<TrendingIcon />}>
              Get Started
            </PulseButton>
          </Box>
        </Zoom>
      </GlassCard>

      {/* Feature Cards Grid */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 3,
        mb: 4
      }}>
        {[
          { id: '1', title: 'Voice Dictation', description: 'AI-powered voice recognition', color: 'primary' },
          { id: '2', title: 'Smart Export', description: 'Professional report generation', color: 'secondary' },
          { id: '3', title: 'Mobile Review', description: 'Review reports anywhere', color: 'success' },
          { id: '4', title: 'Real-time Sync', description: 'Instant collaboration', color: 'warning' }
        ].map((feature, index) => (
          <Fade in timeout={1000 + index * 200} key={feature.id}>
            <AnimatedCard>
              <CardContent sx={{ position: 'relative', overflow: 'hidden' }}>
                {/* Background Pattern */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 100,
                    height: 100,
                    background: `linear-gradient(135deg, ${alpha(theme.palette[feature.color as keyof typeof theme.palette].main, 0.1)}, transparent)`,
                    borderRadius: '50%',
                    transform: 'translate(30px, -30px)'
                  }}
                />
                
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {feature.description}
                </Typography>
                
                {/* Hover Actions */}
                <Box 
                  className="card-actions"
                  sx={{ 
                    opacity: 0, 
                    transform: 'translateY(10px)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    gap: 1
                  }}
                >
                  <Tooltip title="View Details">
                    <IconButton size="small" color="primary">
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" color="secondary">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Share">
                    <IconButton size="small">
                      <ShareIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Favorite">
                    <IconButton 
                      size="small" 
                      color={favoriteItems.has(feature.id) ? 'error' : 'default'}
                      onClick={() => handleFavorite(feature.id)}
                    >
                      <FavoriteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </AnimatedCard>
          </Fade>
        ))}
      </Box>

      {/* Expandable Information Cards */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        System Features
      </Typography>
      
      {[
        { id: 'voice', title: 'Voice Recognition', content: 'Advanced speech-to-text with medical terminology support' },
        { id: 'export', title: 'Export Options', content: 'Multiple formats including PDF, DOCX, and custom templates' },
        { id: 'mobile', title: 'Mobile Access', content: 'Full-featured mobile app for reviewing reports on the go' }
      ].map((item, index) => (
        <Slide in direction="right" timeout={1000 + index * 300} key={item.id}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center"
                onClick={() => handleCardExpand(item.id)}
                sx={{ cursor: 'pointer' }}
              >
                <Typography variant="h6">{item.title}</Typography>
                <IconButton
                  sx={{
                    transform: expandedCard === item.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}
                >
                  <ExpandIcon />
                </IconButton>
              </Box>
              
              <Collapse in={expandedCard === item.id}>
                <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary">
                    {item.content}
                  </Typography>
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </Slide>
      ))}
    </Box>
  );
};

export default ModernUIEnhancements;