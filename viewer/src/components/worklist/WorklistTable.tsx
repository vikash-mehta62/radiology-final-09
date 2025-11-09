import React, { useState, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Assignment as AssignIcon,
  PriorityHigh as PriorityIcon,
  SmartToy as AIIcon,
  Person as PatientIcon,
} from '@mui/icons-material'
import { format, parseISO } from 'date-fns'

import type { Study, SortOptions } from '@/types/worklist'

interface WorklistTableProps {
  studies: Study[]
  loading?: boolean
  sortOptions?: SortOptions
  onSortChange?: (sort: SortOptions) => void
  onStudySelect?: (study: Study) => void
  onStudyAssign?: (study: Study) => void
  onPriorityChange?: (study: Study, priority: Study['priority']) => void
  selectedStudyId?: string
}

const priorityColors = {
  STAT: 'error',
  URGENT: 'warning', 
  HIGH: 'info',
  ROUTINE: 'default',
  LOW: 'default',
} as const

// ✅ WORKLIST EMPTY FIX: Update status colors to match new status values
const statusColors = {
  ALL: 'default',
  PENDING: 'default',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  REPORTED: 'success',
} as const

const aiStatusColors = {
  PENDING: 'default',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
  NOT_APPLICABLE: 'default',
} as const

export const WorklistTable: React.FC<WorklistTableProps> = ({
  studies,
  loading = false,
  sortOptions,
  onSortChange,
  onStudySelect,
  onStudyAssign,
  onPriorityChange,
  selectedStudyId,
}) => {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const handleSort = useCallback((field: keyof Study) => {
    if (!onSortChange) return
    
    const direction = 
      sortOptions?.field === field && sortOptions?.direction === 'asc' 
        ? 'desc' 
        : 'asc'
    
    onSortChange({ field, direction })
  }, [sortOptions, onSortChange])

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    try {
      // Assuming DICOM time format HHMMSS
      const hours = timeString.substring(0, 2)
      const minutes = timeString.substring(2, 4)
      return `${hours}:${minutes}`
    } catch {
      return timeString
    }
  }

  const getAIPriorityScore = (study: Study): number => {
    if (!study.aiResults?.length) return 0
    
    const maxConfidence = Math.max(...study.aiResults.map(r => r.confidence))
    const criticalFindings = study.aiResults.some(r => 
      r.findings.some(f => f.severity === 'CRITICAL')
    )
    const highFindings = study.aiResults.some(r => 
      r.findings.some(f => f.severity === 'HIGH')
    )
    
    if (criticalFindings) return 100
    if (highFindings) return 80
    return Math.round(maxConfidence * 100)
  }

  const renderAIStatus = (study: Study) => {
    const score = getAIPriorityScore(study)
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          size="small"
          label={study.aiStatus}
          color={aiStatusColors[study.aiStatus]}
          variant="outlined"
        />
        {study.aiStatus === 'COMPLETED' && study.aiResults?.length && (
          <Tooltip title={`AI Priority Score: ${score}%`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AIIcon fontSize="small" color={score > 70 ? 'error' : score > 40 ? 'warning' : 'action'} />
              <Typography variant="caption" color="text.secondary">
                {score}%
              </Typography>
            </Box>
          </Tooltip>
        )}
      </Box>
    )
  }

  if (loading) {
    return (
      <Paper>
        <LinearProgress />
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Loading worklist...
          </Typography>
        </Box>
      </Paper>
    )
  }

  return (
    <TableContainer component={Paper}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>
              <TableSortLabel
                active={sortOptions?.field === 'patientName'}
                direction={sortOptions?.field === 'patientName' ? sortOptions.direction : 'asc'}
                onClick={() => handleSort('patientName')}
              >
                Patient
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortOptions?.field === 'studyDate'}
                direction={sortOptions?.field === 'studyDate' ? sortOptions.direction : 'asc'}
                onClick={() => handleSort('studyDate')}
              >
                Study Date
              </TableSortLabel>
            </TableCell>
            <TableCell>Modality</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>
              <TableSortLabel
                active={sortOptions?.field === 'priority'}
                direction={sortOptions?.field === 'priority' ? sortOptions.direction : 'asc'}
                onClick={() => handleSort('priority')}
              >
                Priority
              </TableSortLabel>
            </TableCell>
            <TableCell>Status</TableCell>
            <TableCell>AI Analysis</TableCell>
            <TableCell>Assigned To</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* ✅ WORKLIST EMPTY FIX: Render rows keyed by worklistId || studyInstanceUID */}
          {studies.map((study) => (
            <TableRow
              key={(study as any).worklistId || study.studyInstanceUID}
              hover
              selected={selectedStudyId === study.studyInstanceUID}
              onMouseEnter={() => setHoveredRow(study.studyInstanceUID)}
              onMouseLeave={() => setHoveredRow(null)}
              sx={{
                cursor: 'pointer',
                '&.Mui-selected': {
                  backgroundColor: 'action.selected',
                },
              }}
              onClick={() => onStudySelect?.(study)}
            >
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    <PatientIcon fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {study.patientName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {study.patientID}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              
              <TableCell>
                <Box>
                  <Typography variant="body2">
                    {formatDate(study.studyDate)}
                  </Typography>
                  {study.studyTime && (
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(study.studyTime)}
                    </Typography>
                  )}
                </Box>
              </TableCell>
              
              <TableCell>
                <Chip
                  size="small"
                  label={study.modality}
                  variant="outlined"
                />
              </TableCell>
              
              <TableCell>
                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                  {study.studyDescription || 'No description'}
                </Typography>
                {study.accessionNumber && (
                  <Typography variant="caption" color="text.secondary">
                    Acc: {study.accessionNumber}
                  </Typography>
                )}
              </TableCell>
              
              <TableCell>
                <Chip
                  size="small"
                  label={study.priority}
                  color={priorityColors[study.priority]}
                  icon={study.priority === 'STAT' || study.priority === 'URGENT' ? <PriorityIcon /> : undefined}
                />
              </TableCell>
              
              <TableCell>
                <Chip
                  size="small"
                  label={study.status}
                  color={statusColors[study.status]}
                  variant="outlined"
                />
              </TableCell>
              
              <TableCell>
                {renderAIStatus(study)}
              </TableCell>
              
              <TableCell>
                {study.assignedTo ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      {study.assignedTo.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2">
                      {study.assignedTo}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Unassigned
                  </Typography>
                )}
              </TableCell>
              
              <TableCell align="right">
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="View Study">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        onStudySelect?.(study)
                      }}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Assign Study">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        onStudyAssign?.(study)
                      }}
                    >
                      <AssignIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
          
          {studies.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No studies found
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default WorklistTable