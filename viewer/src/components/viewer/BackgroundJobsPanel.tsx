/**
 * Background Jobs Panel
 * Shows all background analysis jobs with status
 */

import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  LinearProgress,
  Collapse,
  Button,
  Divider,
} from '@mui/material'
import {
  CheckCircle as CompleteIcon,
  Error as ErrorIcon,
  HourglassEmpty as QueuedIcon,
  PlayArrow as ProcessingIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Delete as DeleteIcon,
  Refresh as RetryIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { aiAnalysisQueue, QueueJob } from '../../services/AIAnalysisQueue'

interface BackgroundJobsPanelProps {
  onViewResult?: (job: QueueJob) => void
}

export const BackgroundJobsPanel: React.FC<BackgroundJobsPanelProps> = ({
  onViewResult
}) => {
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())

  // Subscribe to queue updates
  useEffect(() => {
    const updateJobs = () => {
      setJobs(aiAnalysisQueue.getAllJobs())
    }

    const unsubscribe = aiAnalysisQueue.subscribe(updateJobs)
    updateJobs() // Initial load

    return unsubscribe
  }, [])

  const toggleExpand = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }

  const getStatusIcon = (status: QueueJob['status']) => {
    switch (status) {
      case 'complete':
        return <CompleteIcon color="success" />
      case 'failed':
        return <ErrorIcon color="error" />
      case 'processing':
        return <ProcessingIcon color="primary" />
      case 'queued':
        return <QueuedIcon color="action" />
    }
  }

  const getStatusColor = (status: QueueJob['status']): 'success' | 'error' | 'primary' | 'default' => {
    switch (status) {
      case 'complete':
        return 'success'
      case 'failed':
        return 'error'
      case 'processing':
        return 'primary'
      case 'queued':
        return 'default'
    }
  }

  const formatDuration = (startedAt?: number, completedAt?: number) => {
    if (!startedAt) return '-'
    const end = completedAt || Date.now()
    const duration = Math.round((end - startedAt) / 1000)
    return `${duration}s`
  }

  if (jobs.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No background jobs
        </Typography>
      </Paper>
    )
  }

  // Group jobs by status
  const groupedJobs = {
    processing: jobs.filter(j => j.status === 'processing'),
    queued: jobs.filter(j => j.status === 'queued'),
    complete: jobs.filter(j => j.status === 'complete'),
    failed: jobs.filter(j => j.status === 'failed'),
  }

  return (
    <Paper sx={{ maxHeight: 600, overflow: 'auto' }}>
      <Box sx={{ p: 2, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
        <Typography variant="h6" gutterBottom>
          Background Analysis Jobs
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<ProcessingIcon />}
            label={`${groupedJobs.processing.length} Processing`}
            size="small"
            color="primary"
          />
          <Chip
            icon={<QueuedIcon />}
            label={`${groupedJobs.queued.length} Queued`}
            size="small"
          />
          <Chip
            icon={<CompleteIcon />}
            label={`${groupedJobs.complete.length} Complete`}
            size="small"
            color="success"
          />
          {groupedJobs.failed.length > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${groupedJobs.failed.length} Failed`}
              size="small"
              color="error"
            />
          )}
        </Box>
      </Box>

      <Divider />

      <List>
        {jobs.map((job) => {
          const isExpanded = expandedJobs.has(job.id)
          
          return (
            <React.Fragment key={job.id}>
              <ListItem
                sx={{
                  borderLeft: 4,
                  borderColor: `${getStatusColor(job.status)}.main`,
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <ListItemIcon>
                  {getStatusIcon(job.status)}
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        Slice {job.sliceIndex + 1}
                      </Typography>
                      <Chip
                        label={job.status}
                        size="small"
                        color={getStatusColor(job.status)}
                      />
                      {job.priority === 'urgent' && (
                        <Chip label="URGENT" size="small" color="error" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      {job.status === 'processing' && (
                        <LinearProgress
                          variant="determinate"
                          value={job.progress}
                          sx={{ mt: 1, mb: 0.5 }}
                        />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {job.status === 'complete' && `Completed in ${formatDuration(job.startedAt, job.completedAt)}`}
                        {job.status === 'processing' && `Processing... ${job.progress}%`}
                        {job.status === 'queued' && `Queued (priority: ${job.priority})`}
                        {job.status === 'failed' && `Failed: ${job.error}`}
                      </Typography>
                    </Box>
                  }
                />

                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {job.status === 'complete' && onViewResult && (
                    <IconButton
                      size="small"
                      onClick={() => onViewResult(job)}
                      title="View Result"
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  )}
                  
                  {job.status === 'failed' && (
                    <IconButton
                      size="small"
                      onClick={() => {
                        // Retry single job
                        aiAnalysisQueue.retryFailed()
                      }}
                      title="Retry"
                    >
                      <RetryIcon fontSize="small" />
                    </IconButton>
                  )}

                  <IconButton
                    size="small"
                    onClick={() => toggleExpand(job.id)}
                  >
                    {isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                  </IconButton>
                </Box>
              </ListItem>

              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ pl: 9, pr: 2, pb: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="caption" component="div" gutterBottom>
                    <strong>Job ID:</strong> {job.id}
                  </Typography>
                  <Typography variant="caption" component="div" gutterBottom>
                    <strong>Study UID:</strong> {job.studyInstanceUID.substring(0, 20)}...
                  </Typography>
                  {job.seriesInstanceUID && (
                    <Typography variant="caption" component="div" gutterBottom>
                      <strong>Series UID:</strong> {job.seriesInstanceUID.substring(0, 20)}...
                    </Typography>
                  )}
                  <Typography variant="caption" component="div" gutterBottom>
                    <strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}
                  </Typography>
                  {job.startedAt && (
                    <Typography variant="caption" component="div" gutterBottom>
                      <strong>Started:</strong> {new Date(job.startedAt).toLocaleString()}
                    </Typography>
                  )}
                  {job.completedAt && (
                    <Typography variant="caption" component="div" gutterBottom>
                      <strong>Completed:</strong> {new Date(job.completedAt).toLocaleString()}
                    </Typography>
                  )}
                  {job.retryCount > 0 && (
                    <Typography variant="caption" component="div" gutterBottom>
                      <strong>Retry Count:</strong> {job.retryCount}
                    </Typography>
                  )}
                  {job.error && (
                    <Typography variant="caption" component="div" color="error" gutterBottom>
                      <strong>Error:</strong> {job.error}
                    </Typography>
                  )}
                </Box>
              </Collapse>

              <Divider />
            </React.Fragment>
          )
        })}
      </List>

      {/* Actions */}
      <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<DeleteIcon />}
          onClick={() => aiAnalysisQueue.clearCompleted()}
          disabled={groupedJobs.complete.length === 0}
        >
          Clear Completed
        </Button>
        <Button
          size="small"
          startIcon={<RetryIcon />}
          onClick={() => aiAnalysisQueue.retryFailed()}
          disabled={groupedJobs.failed.length === 0}
        >
          Retry Failed
        </Button>
      </Box>
    </Paper>
  )
}

export default BackgroundJobsPanel
