import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox
} from '@mui/material'
import {
  Security as SecurityIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { Helmet } from 'react-helmet-async'

interface AnonymizationPolicy {
  _id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'pending_approval'
  createdBy: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  rules: {
    field: string
    action: 'remove' | 'hash' | 'replace' | 'keep'
    replacement?: string
  }[]
}

interface AnonymizationRequest {
  _id: string
  policyId: string
  policyName: string
  resourceType: 'patient' | 'study' | 'report'
  resourceId: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  approvedBy?: string
  approvedAt?: string
  completedAt?: string
}

const AnonymizationPage: React.FC = () => {
  const [policies, setPolicies] = useState<AnonymizationPolicy[]>([])
  const [requests, setRequests] = useState<AnonymizationRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'policies' | 'requests'>('policies')

  // Policy Dialog
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<AnonymizationPolicy | null>(null)
  const [policyName, setPolicyName] = useState('')
  const [policyDescription, setPolicyDescription] = useState('')
  const [policyRules, setPolicyRules] = useState<AnonymizationPolicy['rules']>([
    { field: 'patientName', action: 'hash' },
    { field: 'patientID', action: 'hash' },
    { field: 'birthDate', action: 'remove' }
  ])

  // Request Dialog
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AnonymizationRequest | null>(null)

  // Available fields for anonymization
  const availableFields = [
    'patientName',
    'patientID',
    'birthDate',
    'sex',
    'address',
    'phoneNumber',
    'email',
    'ssn',
    'medicalRecordNumber',
    'studyDescription',
    'physicianName',
    'institutionName'
  ]

  useEffect(() => {
    if (activeTab === 'policies') {
      fetchPolicies()
    } else {
      fetchRequests()
    }
  }, [activeTab, page, rowsPerPage])

  const fetchPolicies = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/anonymization/policies?page=${page + 1}&limit=${rowsPerPage}`,
        { credentials: 'include' }
      )

      const data = await response.json()

      if (data.success) {
        setPolicies(data.data.policies)
        setTotalCount(data.data.total)
      } else {
        setError(data.message || 'Failed to load policies')
      }
    } catch (err: any) {
      setError(err.message || 'Error loading policies')
    } finally {
      setLoading(false)
    }
  }

  const fetchRequests = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/anonymization/requests?page=${page + 1}&limit=${rowsPerPage}`,
        { credentials: 'include' }
      )

      const data = await response.json()

      if (data.success) {
        setRequests(data.data.requests)
        setTotalCount(data.data.total)
      } else {
        setError(data.message || 'Failed to load requests')
      }
    } catch (err: any) {
      setError(err.message || 'Error loading requests')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePolicy = () => {
    setEditingPolicy(null)
    setPolicyName('')
    setPolicyDescription('')
    setPolicyRules([
      { field: 'patientName', action: 'hash' },
      { field: 'patientID', action: 'hash' },
      { field: 'birthDate', action: 'remove' }
    ])
    setPolicyDialogOpen(true)
  }

  const handleEditPolicy = (policy: AnonymizationPolicy) => {
    setEditingPolicy(policy)
    setPolicyName(policy.name)
    setPolicyDescription(policy.description)
    setPolicyRules(policy.rules)
    setPolicyDialogOpen(true)
  }

  const handleSavePolicy = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = editingPolicy
        ? `/api/anonymization/policies/${editingPolicy._id}`
        : '/api/anonymization/policies'

      const response = await fetch(url, {
        method: editingPolicy ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: policyName,
          description: policyDescription,
          rules: policyRules
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(
          editingPolicy
            ? 'Policy updated successfully'
            : 'Policy created successfully (pending approval)'
        )
        setPolicyDialogOpen(false)
        fetchPolicies()
      } else {
        setError(data.message || 'Failed to save policy')
      }
    } catch (err: any) {
      setError(err.message || 'Error saving policy')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/anonymization/policies/${policyId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Policy deleted successfully')
        fetchPolicies()
      } else {
        setError(data.message || 'Failed to delete policy')
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting policy')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/anonymization/requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Request approved and anonymization started')
        fetchRequests()
      } else {
        setError(data.message || 'Failed to approve request')
      }
    } catch (err: any) {
      setError(err.message || 'Error approving request')
    } finally {
      setLoading(false)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/anonymization/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Request rejected')
        fetchRequests()
      } else {
        setError(data.message || 'Failed to reject request')
      }
    } catch (err: any) {
      setError(err.message || 'Error rejecting request')
    } finally {
      setLoading(false)
    }
  }

  const addRule = () => {
    setPolicyRules([...policyRules, { field: 'patientName', action: 'hash' }])
  }

  const updateRule = (index: number, field: keyof AnonymizationPolicy['rules'][0], value: any) => {
    const newRules = [...policyRules]
    newRules[index] = { ...newRules[index], [field]: value }
    setPolicyRules(newRules)
  }

  const removeRule = (index: number) => {
    setPolicyRules(policyRules.filter((_, i) => i !== index))
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      active: 'success',
      inactive: 'default',
      pending_approval: 'warning',
      pending: 'warning',
      approved: 'info',
      rejected: 'error',
      completed: 'success'
    }
    return colors[status] || 'default'
  }

  return (
    <>
      <Helmet>
        <title>Data Anonymization - Medical Imaging Viewer</title>
      </Helmet>

      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', p: 4 }}>
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <SecurityIcon sx={{ color: '#fff', fontSize: 32 }} />
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>
                  Data Anonymization
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                HIPAA-compliant data anonymization policies and approval workflow
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => (activeTab === 'policies' ? fetchPolicies() : fetchRequests())}
                sx={{
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Refresh
              </Button>
              {activeTab === 'policies' && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreatePolicy}
                  sx={{
                    bgcolor: '#fff',
                    color: '#667eea',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
                  }}
                >
                  Create Policy
                </Button>
              )}
            </Stack>
          </Box>
        </Paper>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Stack direction="row" spacing={0}>
            <Button
              onClick={() => setActiveTab('policies')}
              sx={{
                flex: 1,
                py: 2,
                borderRadius: 0,
                bgcolor: activeTab === 'policies' ? 'primary.main' : 'transparent',
                color: activeTab === 'policies' ? '#fff' : 'text.primary',
                '&:hover': {
                  bgcolor: activeTab === 'policies' ? 'primary.dark' : 'grey.100'
                }
              }}
            >
              Anonymization Policies
            </Button>
            <Button
              onClick={() => setActiveTab('requests')}
              sx={{
                flex: 1,
                py: 2,
                borderRadius: 0,
                bgcolor: activeTab === 'requests' ? 'primary.main' : 'transparent',
                color: activeTab === 'requests' ? '#fff' : 'text.primary',
                '&:hover': {
                  bgcolor: activeTab === 'requests' ? 'primary.dark' : 'grey.100'
                }
              }}
            >
              Approval Requests
            </Button>
          </Stack>
        </Paper>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Policies Table */}
        {activeTab === 'policies' && (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell>Policy Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Rules</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : policies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                        <Typography variant="body1" color="text.secondary">
                          No anonymization policies found
                        </Typography>
                        <Button
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={handleCreatePolicy}
                          sx={{ mt: 2 }}
                        >
                          Create First Policy
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    policies.map((policy) => (
                      <TableRow key={policy._id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {policy.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {policy.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={`${policy.rules.length} rules`} size="small" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={policy.status.replace('_', ' ')}
                            size="small"
                            color={getStatusColor(policy.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{policy.createdBy}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(policy.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  alert(JSON.stringify(policy.rules, null, 2))
                                }}
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEditPolicy(policy)}
                                disabled={policy.status === 'pending_approval'}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeletePolicy(policy._id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </Paper>
        )}

        {/* Requests Table */}
        {activeTab === 'requests' && (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell>Policy</TableCell>
                    <TableCell>Resource</TableCell>
                    <TableCell>Requested By</TableCell>
                    <TableCell>Requested At</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                        <Typography variant="body1" color="text.secondary">
                          No anonymization requests found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((request) => (
                      <TableRow key={request._id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {request.policyName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{request.resourceType}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {request.resourceId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{request.requestedBy}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(request.requestedAt).toLocaleTimeString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={request.status.replace('_', ' ')}
                            size="small"
                            color={getStatusColor(request.status)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {request.status === 'pending' && (
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Tooltip title="Approve">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleApproveRequest(request._id)}
                                >
                                  <ApproveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRejectRequest(request._id)}
                                >
                                  <RejectIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          )}
                          {request.status !== 'pending' && (
                            <Typography variant="caption" color="text.secondary">
                              {request.status === 'completed' && 'Completed'}
                              {request.status === 'approved' && 'Processing...'}
                              {request.status === 'rejected' && 'Rejected'}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </Paper>
        )}

        {/* Policy Dialog */}
        <Dialog
          open={policyDialogOpen}
          onClose={() => setPolicyDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingPolicy ? 'Edit Anonymization Policy' : 'Create Anonymization Policy'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <TextField
                label="Policy Name"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                fullWidth
                required
              />

              <TextField
                label="Description"
                value={policyDescription}
                onChange={(e) => setPolicyDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                required
              />

              <Divider />

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Anonymization Rules
                  </Typography>
                  <Button startIcon={<AddIcon />} onClick={addRule} size="small">
                    Add Rule
                  </Button>
                </Box>

                <Stack spacing={2}>
                  {policyRules.map((rule, index) => (
                    <Card key={index} variant="outlined">
                      <CardContent>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} sm={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Field</InputLabel>
                              <Select
                                value={rule.field}
                                label="Field"
                                onChange={(e) => updateRule(index, 'field', e.target.value)}
                              >
                                {availableFields.map((field) => (
                                  <MenuItem key={field} value={field}>
                                    {field}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Action</InputLabel>
                              <Select
                                value={rule.action}
                                label="Action"
                                onChange={(e) => updateRule(index, 'action', e.target.value)}
                              >
                                <MenuItem value="remove">Remove</MenuItem>
                                <MenuItem value="hash">Hash</MenuItem>
                                <MenuItem value="replace">Replace</MenuItem>
                                <MenuItem value="keep">Keep</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          {rule.action === 'replace' && (
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Replacement Value"
                                value={rule.replacement || ''}
                                onChange={(e) => updateRule(index, 'replacement', e.target.value)}
                                fullWidth
                                size="small"
                              />
                            </Grid>
                          )}
                          <Grid item xs={12} sm={rule.action === 'replace' ? 1 : 5}>
                            <IconButton
                              color="error"
                              onClick={() => removeRule(index)}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>

              <Alert severity="warning" icon={<WarningIcon />}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Important:
                </Typography>
                <Typography variant="caption">
                  • New policies require approval before activation
                  <br />
                  • Anonymization is irreversible
                  <br />• Ensure compliance with your organization's data policies
                </Typography>
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPolicyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSavePolicy}
              variant="contained"
              disabled={!policyName || !policyDescription || policyRules.length === 0}
            >
              {editingPolicy ? 'Update Policy' : 'Create Policy'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  )
}

export default AnonymizationPage
