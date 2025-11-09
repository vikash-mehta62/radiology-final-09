/**
 * Quick Phrase Button
 * Dropdown menu with common phrases for quick insertion
 */

import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  ListItemText,
  Divider,
  Box,
  Typography
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Add as AddIcon
} from '@mui/icons-material';

interface QuickPhraseButtonProps {
  phrases: string[];
  onInsert: (phrase: string) => void;
  label?: string;
}

const QuickPhraseButton: React.FC<QuickPhraseButtonProps> = ({
  phrases,
  onInsert,
  label = 'Quick Phrases'
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleInsert = (phrase: string) => {
    onInsert(phrase);
    handleClose();
  };

  if (!phrases || phrases.length === 0) {
    return null;
  }

  return (
    <>
      <Tooltip title={label}>
        <IconButton 
          size="small" 
          onClick={handleClick}
          sx={{ 
            ml: 1,
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.light',
              color: 'primary.contrastText'
            }
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            maxHeight: 400,
            width: 350
          }
        }}
      >
        <Box sx={{ px: 2, py: 1, bgcolor: 'primary.main', color: 'white' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {label}
          </Typography>
          <Typography variant="caption">
            Click to insert into report
          </Typography>
        </Box>
        
        <Divider />
        
        {phrases.map((phrase, index) => (
          <MenuItem 
            key={index} 
            onClick={() => handleInsert(phrase)}
            sx={{
              py: 1.5,
              '&:hover': {
                bgcolor: 'primary.light'
              }
            }}
          >
            <AddIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
            <ListItemText 
              primary={phrase}
              primaryTypographyProps={{
                variant: 'body2',
                sx: { whiteSpace: 'normal' }
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default QuickPhraseButton;
