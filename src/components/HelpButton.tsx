'use client'

import { useState } from 'react'
import {
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material'
import {
  Help as HelpIcon,
  Close as CloseIcon
} from '@mui/icons-material'

interface HelpContent {
  title: string
  description: string
  features: {
    name: string
    description: string
    tip?: string
  }[]
  quickTips: string[]
  comingSoon?: string[]
}

interface HelpButtonProps {
  helpContent: HelpContent
  size?: 'small' | 'medium' | 'large'
}

export default function HelpButton({ helpContent, size = 'medium' }: HelpButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        size={size}
        title="Help & Tips"
        sx={{
          color: 'primary.main',
          '&:hover': { backgroundColor: 'primary.light', color: 'primary.contrastText' }
        }}
      >
        <HelpIcon />
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{helpContent.title}</Typography>
            <IconButton onClick={() => setOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
            {helpContent.description}
          </Typography>

          {/* Features */}
          <Typography variant="h6" gutterBottom>
            📋 Features
          </Typography>
          <List>
            {helpContent.features.map((feature, index) => (
              <ListItem key={index} sx={{ py: 1 }}>
                <ListItemText
                  primary={feature.name}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        {feature.description}
                      </Typography>
                      {feature.tip && (
                        <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
                          💡 Tip: {feature.tip}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>

          {/* Quick Tips */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            💡 Quick Tips
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {helpContent.quickTips.map((tip, index) => (
              <Chip
                key={index}
                label={tip}
                variant="outlined"
                size="small"
                color="primary"
              />
            ))}
          </Box>

          {/* Coming Soon */}
          {helpContent.comingSoon && helpContent.comingSoon.length > 0 && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                🚀 Coming Soon
              </Typography>
              <List>
                {helpContent.comingSoon.map((item, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip label="Future" size="small" color="secondary" />
                          <Typography variant="body2">{item}</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)} variant="contained">
            Got it!
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}