import React, { useState, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Button,
  Collapse,
  IconButton,
  Grid,
  Autocomplete,
} from '@mui/material'
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

import type { WorklistFilters } from '@/types/worklist'

interface WorklistFiltersProps {
  filters: Partial<WorklistFilters>
  onFiltersChange: (filters: Partial<WorklistFilters>) => void
  onSearch: (searchTerm: string) => void
  searchTerm?: string
  loading?: boolean
}

const MODALITIES = [
  'CT', 'MR', 'XR', 'US', 'NM', 'PT', 'MG', 'DX', 'CR', 'DR', 'RF', 'SC'
]

const PRIORITIES = [
  'STAT', 'URGENT', 'HIGH', 'ROUTINE', 'LOW'
]

// ✅ WORKLIST EMPTY FIX: Add "All" option alongside Pending/In-Progress/Completed
const STATUSES = [
  'ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
]

const AI_STATUSES = [
  'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_APPLICABLE'
]

export const WorklistFilters: React.FC<WorklistFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  searchTerm = '',
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)

  const handleFilterChange = useCallback((key: keyof WorklistFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    })
  }, [filters, onFiltersChange])

  const handleMultiSelectChange = useCallback((key: keyof WorklistFilters, values: string[]) => {
    handleFilterChange(key, values)
  }, [handleFilterChange])

  const handleDateRangeChange = useCallback((field: 'start' | 'end', date: Date | null) => {
    const dateRange = filters.dateRange || { start: null, end: null }
    handleFilterChange('dateRange', {
      ...dateRange,
      [field]: date ? date.toISOString().split('T')[0] : null,
    })
  }, [filters.dateRange, handleFilterChange])

  // ✅ WORKLIST EMPTY FIX: Don't pass empty search strings to API
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    // Don't pass empty search strings to avoid server filtering by q=""
    if (localSearchTerm.trim()) {
      onSearch(localSearchTerm)
    } else {
      onSearch('')
    }
  }, [localSearchTerm, onSearch])

  // ✅ WORKLIST EMPTY FIX: Reset Filters - set status='ALL', from=now-90d
  const clearFilters = useCallback(() => {
    const now = new Date()
    const defaultStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    
    onFiltersChange({
      statuses: ['ALL'],
      dateRange: {
        start: defaultStartDate.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      }
    })
    setLocalSearchTerm('')
    onSearch('')
  }, [onFiltersChange, onSearch])

  const hasActiveFilters = Object.values(filters).some(value => {
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== null && v !== '')
    }
    return value !== null && value !== undefined && value !== ''
  })

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {/* Search Bar */}
      <Box component="form" onSubmit={handleSearchSubmit} sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <TextField
              fullWidth
              placeholder="Search by patient name, ID, accession number..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              disabled={loading}
            />
          </Grid>
          <Grid item>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ minWidth: 100 }}
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Filter Toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon color="action" />
          <Typography variant="subtitle2">
            Filters
          </Typography>
          {hasActiveFilters && (
            <Chip
              size="small"
              label="Active"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasActiveFilters && (
            <Button
              size="small"
              startIcon={<ClearIcon />}
              onClick={clearFilters}
              disabled={loading}
            >
              Clear All
            </Button>
          )}
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Filter Controls */}
      <Collapse in={expanded}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Date Range */}
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Start Date"
                value={filters.dateRange?.start ? new Date(filters.dateRange.start) : null}
                onChange={(date) => handleDateRangeChange('start', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                  },
                }}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="End Date"
                value={filters.dateRange?.end ? new Date(filters.dateRange.end) : null}
                onChange={(date) => handleDateRangeChange('end', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                  },
                }}
                disabled={loading}
              />
            </Grid>

            {/* Modalities */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Modalities</InputLabel>
                <Select
                  multiple
                  value={filters.modalities || []}
                  onChange={(e) => handleMultiSelectChange('modalities', e.target.value as string[])}
                  input={<OutlinedInput label="Modalities" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                  disabled={loading}
                >
                  {MODALITIES.map((modality) => (
                    <MenuItem key={modality} value={modality}>
                      <Checkbox checked={(filters.modalities || []).includes(modality)} />
                      <ListItemText primary={modality} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Priorities */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Priorities</InputLabel>
                <Select
                  multiple
                  value={filters.priorities || []}
                  onChange={(e) => handleMultiSelectChange('priorities', e.target.value as string[])}
                  input={<OutlinedInput label="Priorities" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                  disabled={loading}
                >
                  {PRIORITIES.map((priority) => (
                    <MenuItem key={priority} value={priority}>
                      <Checkbox checked={(filters.priorities || []).includes(priority)} />
                      <ListItemText primary={priority} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Statuses */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Statuses</InputLabel>
                <Select
                  multiple
                  value={filters.statuses || []}
                  onChange={(e) => handleMultiSelectChange('statuses', e.target.value as string[])}
                  input={<OutlinedInput label="Statuses" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                  disabled={loading}
                >
                  {STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      <Checkbox checked={(filters.statuses || []).includes(status)} />
                      <ListItemText primary={status} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* AI Status */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>AI Status</InputLabel>
                <Select
                  multiple
                  value={filters.aiStatus || []}
                  onChange={(e) => handleMultiSelectChange('aiStatus', e.target.value as string[])}
                  input={<OutlinedInput label="AI Status" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                  disabled={loading}
                >
                  {AI_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      <Checkbox checked={(filters.aiStatus || []).includes(status)} />
                      <ListItemText primary={status} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Assigned To */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Assigned To"
                value={filters.assignedTo || ''}
                onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
                disabled={loading}
              />
            </Grid>

            {/* Patient Name */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Patient Name"
                value={filters.patientName || ''}
                onChange={(e) => handleFilterChange('patientName', e.target.value)}
                disabled={loading}
              />
            </Grid>
          </Grid>
        </LocalizationProvider>
      </Collapse>
    </Paper>
  )
}

export default WorklistFilters