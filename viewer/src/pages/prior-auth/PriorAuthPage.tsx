import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Badge,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  FormHelperText,
  Snackbar,
} from '@mui/material'
import {
  Add as AddIcon,
  CheckCircle as ApproveIcon,
  Cancel as DenyIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Info as InfoIcon,
  Note as NoteIcon,
  AttachFile as AttachIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  CheckCircle,
} from '@mui/icons-material'
import ApiService from '../../services/ApiService'
import {
  checkPriorAuthRequired,
  getInsurancePlans,
  getPlanTypes,
  getProcedureInfo,
  getProceduresByModality,
} from '../../config/priorAuthRules'

interface PriorAuth {
  _id: string
  authorizationNumber: string
  patientID: string
  patientName: string
  procedureCode: string
  procedureDescription: string
  modality: string
  bodyPart: string
  diagnosis: string[]
  clinicalIndication: string
  urgency: string
  status: 'pending' | 'in_review' | 'approved' | 'denied' | 'more_info_needed'
  insuranceProvider?: string
  insurancePolicyNumber?: string
  automatedChecks?: any
  notes?: Array<{ text: string; createdBy: string; createdAt: string }>
  documents?: Array<{ filename: string; uploadedAt: string }>
  createdAt: string
  updatedAt: string
  reviewedBy?: string
  reviewedAt?: string
  denialReason?: string
}

const PriorAuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [authorizations, setAuthorizations] = useState<PriorAuth[]>([])
  const [stats, setStats] = useState<any>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showDenyDialog, setShowDenyDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [selectedAuth, setSelectedAuth] = useState<PriorAuth | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    patientID: '',
    patientName: '',
    procedureCode: '',
    procedureDescription: '',
    modality: 'CT',
    bodyPart: '',
    diagnosis: '',
    clinicalIndication: '',
    urgency: 'routine',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    planType: ''
  })

  // Auto-check state
  const [authCheck, setAuthCheck] = useState<{
    required: boolean
    reason: string
    autoApprovalEligible: boolean
    estimatedCost?: number
  } | null>(null)
  const [availablePlanTypes, setAvailablePlanTypes] = useState<string[]>([])
  const [procedureInfo, setProcedureInfo] = useState<any>(null)

  // Action dialogs state
  const [approvalNotes, setApprovalNotes] = useState('')
  const [denialReason, setDenialReason] = useState('')
  const [denialNotes, setDenialNotes] = useState('')
  const [newNote, setNewNote] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)

  useEffect(() => {
    fetchAuthorizations()
    fetchStats()
  }, [activeTab])

  const fetchAuthorizations = async () => {
    setLoading(true)
    setError(null)
    try {
      const statusMap = ['', 'pending', 'in_review', 'approved', 'denied']
      const filters = statusMap[activeTab] ? { status: statusMap[activeTab] } : {}
      
      const response = await ApiService.getPriorAuths(filters)
      
      if (response.success) {
        setAuthorizations(response.data || [])
      } else {
        throw new Error(response.message || 'Failed to fetch authorizations')
      }
    } catch (err: any) {
      console.error('Failed to fetch authorizations:', err)
      setError(err.message || 'Failed to fetch authorizations')
      setAuthorizations([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await ApiService.getPriorAuthStats()
      if (response.success) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success'
      case 'denied': return 'error'
      case 'pending': return 'warning'
      case 'in_review': return 'info'
      case 'more_info_needed': return 'secondary'
      default: return 'default'
    }
  }

  const validateCPTCode = (code: string): boolean => {
    // CPT codes are 5 digits
    return /^\d{5}$/.test(code)
  }

  const validateICD10Code = (code: string): boolean => {
    // ICD-10 codes: Letter + 2 digits + optional decimal + up to 4 more characters
    return /^[A-Z]\d{2}(\.\d{1,4})?$/.test(code)
  }

  // Auto-check when insurance, plan type, procedure, or urgency changes
  useEffect(() => {
    if (formData.insuranceProvider && formData.planType && formData.procedureCode && formData.urgency) {
      const check = checkPriorAuthRequired(
        formData.insuranceProvider,
        formData.planType,
        formData.procedureCode,
        formData.urgency
      )
      setAuthCheck(check)
    } else {
      setAuthCheck(null)
    }
  }, [formData.insuranceProvider, formData.planType, formData.procedureCode, formData.urgency])

  // Update plan types when insurance changes
  useEffect(() => {
    if (formData.insuranceProvider) {
      const planTypes = getPlanTypes(formData.insuranceProvider)
      setAvailablePlanTypes(planTypes)
      if (planTypes.length > 0 && !planTypes.includes(formData.planType)) {
        setFormData(prev => ({ ...prev, planType: planTypes[0] }))
      }
    } else {
      setAvailablePlanTypes([])
    }
  }, [formData.insuranceProvider])

  // Get procedure info when CPT code changes
  useEffect(() => {
    if (formData.procedureCode && validateCPTCode(formData.procedureCode)) {
      const info = getProcedureInfo(formData.procedureCode)
      setProcedureInfo(info)
      if (info && !formData.procedureDescription) {
        setFormData(prev => ({ ...prev, procedureDescription: info.description }))
      }
    } else {
      setProcedureInfo(null)
    }
  }, [formData.procedureCode])

  const handleCreateRequest = async () => {
    try {
      setError(null)
      
      // Validation
      if (!formData.patientID || !formData.patientName) {
        setError('Patient ID and Name are required')
        return
      }
      
      if (!validateCPTCode(formData.procedureCode)) {
        setError('Invalid CPT code format. Must be 5 digits (e.g., 70450)')
        return
      }
      
      const diagnosisCodes = formData.diagnosis.split(',').map(d => d.trim()).filter(Boolean)
      if (diagnosisCodes.length === 0) {
        setError('At least one diagnosis code is required')
        return
      }
      
      for (const code of diagnosisCodes) {
        if (!validateICD10Code(code)) {
          setError(`Invalid ICD-10 code format: ${code}. Example: G43.909`)
          return
        }
      }
      
      if (!formData.clinicalIndication) {
        setError('Clinical indication is required')
        return
      }
      
      const response = await ApiService.createPriorAuth({
        ...formData,
        diagnosis: diagnosisCodes
      })
      
      if (response.success) {
        const autoApproved = response.automation?.autoApproved
        setSuccess(
          `Authorization ${autoApproved ? 'Auto-Approved' : 'Created'} Successfully!\n` +
          `Auth #: ${response.data.authorizationNumber}\n` +
          `${response.automation?.confidence ? `Confidence: ${response.automation.confidence}%` : ''}`
        )
        setShowCreateDialog(false)
        fetchAuthorizations()
        fetchStats()
        // Reset form
        setFormData({
          patientID: '',
          patientName: '',
          procedureCode: '',
          procedureDescription: '',
          modality: 'CT',
          bodyPart: '',
          diagnosis: '',
          clinicalIndication: '',
          urgency: 'routine',
          insuranceProvider: '',
          insurancePolicyNumber: '',
          planType: ''
        })
        setAuthCheck(null)
        setProcedureInfo(null)
      } else {
        throw new Error(response.message || 'Failed to create authorization')
      }
    } catch (err: any) {
      console.error('Error creating authorization:', err)
      setError(err.message || 'Failed to create authorization')
    }
  }

  const handleViewDetails = async (auth: PriorAuth) => {
    try {
      const response = await ApiService.getPriorAuth(auth._id)
      if (response.success) {
        setSelectedAuth(response.data)
        setShowDetailsDialog(true)
      }
    } catch (error) {
      console.error('Failed to fetch authorization details:', error)
      setError('Failed to load authorization details')
    }
  }

  const handleApprove = async () => {
    if (!selectedAuth) return
    
    try {
      const response = await ApiService.approvePriorAuth(selectedAuth._id, approvalNotes)
      
      if (response.success) {
        setSuccess('Authorization approved successfully')
        setShowApproveDialog(false)
        setShowDetailsDialog(false)
        setApprovalNotes('')
        fetchAuthorizations()
        fetchStats()
      } else {
        throw new Error(response.message || 'Failed to approve authorization')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve authorization')
    }
  }

  const handleDeny = async () => {
    if (!selectedAuth || !denialReason) {
      setError('Denial reason is required')
      return
    }
    
    try {
      const response = await ApiService.denyPriorAuth(selectedAuth._id, denialReason, denialNotes)
      
      if (response.success) {
        setSuccess('Authorization denied')
        setShowDenyDialog(false)
        setShowDetailsDialog(false)
        setDenialReason('')
        setDenialNotes('')
        fetchAuthorizations()
        fetchStats()
      } else {
        throw new Error(response.message || 'Failed to deny authorization')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to deny authorization')
    }
  }

  const handleAddNote = async () => {
    if (!selectedAuth || !newNote) return
    
    try {
      const response = await ApiService.addPriorAuthNote(selectedAuth._id, newNote)
      
      if (response.success) {
        setSuccess('Note added successfully')
        setNewNote('')
        setShowNoteDialog(false)
        // Refresh details
        handleViewDetails(selectedAuth)
      } else {
        throw new Error(response.message || 'Failed to add note')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add note')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAuth || !event.target.files || event.target.files.length === 0) return
    
    const file = event.target.files[0]
    setUploadingDoc(true)
    
    try {
      const response = await ApiService.uploadPriorAuthDocument(selectedAuth._id, file)
      
      if (response.success) {
        setSuccess('Document uploaded successfully')
        // Refresh details
        handleViewDetails(selectedAuth)
      } else {
        throw new Error(response.message || 'Failed to upload document')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload document')
    } finally {
      setUploadingDoc(false)
    }
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Paper sx={{ p: 3, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" fontWeight="bold">
            🏥 Prior Authorization
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => { fetchAuthorizations(); fetchStats(); }}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateDialog(true)}
            >
              New Request
            </Button>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats */}
        {stats && (
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="h4">{stats.total || 0}</Typography>
                  <Typography variant="caption">Total</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="warning.main">{stats.pending || 0}</Typography>
                  <Typography variant="caption">Pending</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="success.main">{stats.approved || 0}</Typography>
                  <Typography variant="caption">Approved</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="error.main">{stats.denied || 0}</Typography>
                  <Typography variant="caption">Denied</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="info.main">{stats.inReview || 0}</Typography>
                  <Typography variant="caption">In Review</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2}>
              <Card>
                <CardContent>
                  <Typography variant="h4">{stats.autoApprovalRate || 0}%</Typography>
                  <Typography variant="caption">Auto-Approved</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 0 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label={<Badge badgeContent={stats?.total} color="default">All</Badge>} />
          <Tab label={<Badge badgeContent={stats?.pending} color="warning">Pending</Badge>} />
          <Tab label={<Badge badgeContent={stats?.inReview} color="info">In Review</Badge>} />
          <Tab label={<Badge badgeContent={stats?.approved} color="success">Approved</Badge>} />
          <Tab label={<Badge badgeContent={stats?.denied} color="error">Denied</Badge>} />
        </Tabs>
      </Paper>

      {/* Table */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>Auth #</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Procedure</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Urgency</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {authorizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No authorizations found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  authorizations.map((auth) => (
                    <TableRow key={auth._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {auth.authorizationNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{auth.patientName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {auth.patientID}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{auth.procedureDescription}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {auth.modality} - {auth.bodyPart} (CPT: {auth.procedureCode})
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={auth.status.replace('_', ' ').toUpperCase()} 
                          size="small" 
                          color={getStatusColor(auth.status)} 
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={auth.urgency.toUpperCase()} 
                          size="small" 
                          variant="outlined"
                          color={auth.urgency === 'stat' || auth.urgency === 'emergency' ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(auth.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewDetails(auth)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Prior Authorization Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Patient ID"
                value={formData.patientID}
                onChange={(e) => setFormData({ ...formData, patientID: e.target.value })}
                required
                error={!formData.patientID && error !== null}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Patient Name"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                required
                error={!formData.patientName && error !== null}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Procedure Code (CPT)"
                value={formData.procedureCode}
                onChange={(e) => setFormData({ ...formData, procedureCode: e.target.value })}
                placeholder="e.g., 70450"
                required
                error={formData.procedureCode && !validateCPTCode(formData.procedureCode)}
                helperText="5-digit CPT code"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Procedure Description"
                value={formData.procedureDescription}
                onChange={(e) => setFormData({ ...formData, procedureDescription: e.target.value })}
                placeholder="e.g., CT Head without contrast"
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Modality"
                value={formData.modality}
                onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                SelectProps={{ native: true }}
              >
                <option value="CT">CT</option>
                <option value="MR">MR</option>
                <option value="XR">X-Ray</option>
                <option value="US">Ultrasound</option>
                <option value="NM">Nuclear Medicine</option>
                <option value="PT">PET</option>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Body Part"
                value={formData.bodyPart}
                onChange={(e) => setFormData({ ...formData, bodyPart: e.target.value })}
                placeholder="e.g., Head"
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Urgency"
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                SelectProps={{ native: true }}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
                <option value="emergency">Emergency</option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Diagnosis Codes (ICD-10)"
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                placeholder="e.g., G43.909, R51.9"
                helperText="Comma-separated ICD-10 codes (e.g., G43.909)"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Clinical Indication"
                value={formData.clinicalIndication}
                onChange={(e) => setFormData({ ...formData, clinicalIndication: e.target.value })}
                placeholder="Describe the clinical reason for this procedure..."
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Insurance Provider"
                value={formData.insuranceProvider}
                onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                SelectProps={{ native: true }}
                helperText="Select insurance to check prior auth requirements"
              >
                <option value="">Select Insurance</option>
                {getInsurancePlans().map(plan => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Plan Type"
                value={formData.planType}
                onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                SelectProps={{ native: true }}
                disabled={!formData.insuranceProvider}
                helperText="Plan type affects prior auth requirements"
              >
                <option value="">Select Plan Type</option>
                {availablePlanTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Policy Number"
                value={formData.insurancePolicyNumber}
                onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })}
                placeholder="Insurance policy number"
              />
            </Grid>

            {/* Auto-Check Results */}
            {authCheck && (
              <Grid item xs={12}>
                <Alert 
                  severity={
                    !authCheck.required ? 'success' : 
                    authCheck.autoApprovalEligible ? 'info' : 
                    'warning'
                  }
                  icon={authCheck.required ? <InfoIcon /> : <CheckCircle />}
                >
                  <Typography variant="subtitle2" fontWeight="bold">
                    {authCheck.required ? 'Prior Authorization Required' : 'Prior Authorization Not Required'}
                  </Typography>
                  <Typography variant="body2">{authCheck.reason}</Typography>
                  {authCheck.estimatedCost && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Estimated Cost: ${authCheck.estimatedCost}
                    </Typography>
                  )}
                  {authCheck.autoApprovalEligible && authCheck.required && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'success.main' }}>
                      ✓ Eligible for automatic approval
                    </Typography>
                  )}
                </Alert>
              </Grid>
            )}

            {/* Procedure Info */}
            {procedureInfo && (
              <Grid item xs={12}>
                <Alert severity="info" icon={<InfoIcon />}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Procedure Information
                  </Typography>
                  <Typography variant="body2">
                    {procedureInfo.description} - Estimated Cost: ${procedureInfo.costEstimate}
                  </Typography>
                  {procedureInfo.typicalDiagnoses && procedureInfo.typicalDiagnoses.length > 0 && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Typical Diagnoses: {procedureInfo.typicalDiagnoses.join(', ')}
                    </Typography>
                  )}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateRequest}
            disabled={!formData.patientID || !formData.procedureCode || !formData.diagnosis}
          >
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onClose={() => setShowDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Authorization Details</Typography>
            <IconButton onClick={() => setShowDetailsDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedAuth && (
            <Box>
              {/* Header Info */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">Authorization Number</Typography>
                  <Typography variant="h6">{selectedAuth.authorizationNumber}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip 
                      label={selectedAuth.status.replace('_', ' ').toUpperCase()} 
                      color={getStatusColor(selectedAuth.status)} 
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Patient Info */}
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Patient Information</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  <Typography>{selectedAuth.patientName}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">Patient ID</Typography>
                  <Typography>{selectedAuth.patientID}</Typography>
                </Grid>
                {selectedAuth.insuranceProvider && (
                  <>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Insurance Provider</Typography>
                      <Typography>{selectedAuth.insuranceProvider}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Policy Number</Typography>
                      <Typography>{selectedAuth.insurancePolicyNumber}</Typography>
                    </Grid>
                  </>
                )}
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Procedure Info */}
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Procedure Information</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">Procedure</Typography>
                  <Typography>{selectedAuth.procedureDescription}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">CPT Code</Typography>
                  <Typography>{selectedAuth.procedureCode}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">Modality</Typography>
                  <Typography>{selectedAuth.modality}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">Body Part</Typography>
                  <Typography>{selectedAuth.bodyPart}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">Urgency</Typography>
                  <Chip label={selectedAuth.urgency.toUpperCase()} size="small" />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Diagnosis Codes (ICD-10)</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {selectedAuth.diagnosis.map((code, idx) => (
                      <Chip key={idx} label={code} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Clinical Indication</Typography>
                  <Typography>{selectedAuth.clinicalIndication}</Typography>
                </Grid>
              </Grid>

              {/* Automated Checks */}
              {selectedAuth.automatedChecks && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Automated Checks</Typography>
                  <List dense>
                    {Object.entries(selectedAuth.automatedChecks).map(([key, check]: [string, any]) => (
                      <ListItem key={key}>
                        <ListItemText
                          primary={key.replace(/([A-Z])/g, ' $1').trim()}
                          secondary={check.message}
                          primaryTypographyProps={{ 
                            color: check.passed ? 'success.main' : 'error.main',
                            fontWeight: 'medium'
                          }}
                        />
                        {check.passed ? <CheckCircle color="success" /> : <Cancel color="error" />}
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {/* Notes */}
              {selectedAuth.notes && selectedAuth.notes.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Notes</Typography>
                  <List dense>
                    {selectedAuth.notes.map((note, idx) => (
                      <ListItem key={idx}>
                        <ListItemText
                          primary={note.text}
                          secondary={`${note.createdBy} - ${new Date(note.createdAt).toLocaleString()}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {/* Documents */}
              {selectedAuth.documents && selectedAuth.documents.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Documents</Typography>
                  <List dense>
                    {selectedAuth.documents.map((doc, idx) => (
                      <ListItem key={idx}>
                        <ListItemText
                          primary={doc.filename}
                          secondary={new Date(doc.uploadedAt).toLocaleString()}
                        />
                        <IconButton size="small">
                          <DownloadIcon />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {/* Denial Reason */}
              {selectedAuth.status === 'denied' && selectedAuth.denialReason && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Alert severity="error">
                    <Typography variant="subtitle2" fontWeight="bold">Denial Reason</Typography>
                    <Typography variant="body2">{selectedAuth.denialReason}</Typography>
                  </Alert>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Stack direction="row" spacing={1} sx={{ width: '100%', justifyContent: 'space-between' }}>
            <Box>
              <input
                accept="*/*"
                style={{ display: 'none' }}
                id="upload-document"
                type="file"
                onChange={handleFileUpload}
              />
              <label htmlFor="upload-document">
                <Button
                  component="span"
                  startIcon={<AttachIcon />}
                  disabled={uploadingDoc}
                >
                  {uploadingDoc ? 'Uploading...' : 'Upload Document'}
                </Button>
              </label>
              <Button
                startIcon={<NoteIcon />}
                onClick={() => setShowNoteDialog(true)}
              >
                Add Note
              </Button>
            </Box>
            <Box>
              {selectedAuth?.status === 'pending' || selectedAuth?.status === 'in_review' ? (
                <>
                  <Button
                    startIcon={<DenyIcon />}
                    color="error"
                    onClick={() => setShowDenyDialog(true)}
                  >
                    Deny
                  </Button>
                  <Button
                    startIcon={<ApproveIcon />}
                    variant="contained"
                    color="success"
                    onClick={() => setShowApproveDialog(true)}
                  >
                    Approve
                  </Button>
                </>
              ) : (
                <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
              )}
            </Box>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onClose={() => setShowApproveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Authorization</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Are you sure you want to approve this authorization?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Approval Notes (Optional)"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Add any notes about this approval..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowApproveDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleApprove}>
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={showDenyDialog} onClose={() => setShowDenyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Deny Authorization</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Please provide a reason for denial:
          </Typography>
          <TextField
            fullWidth
            label="Denial Reason"
            value={denialReason}
            onChange={(e) => setDenialReason(e.target.value)}
            placeholder="e.g., Medical necessity not established"
            required
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Additional Notes (Optional)"
            value={denialNotes}
            onChange={(e) => setDenialNotes(e.target.value)}
            placeholder="Add any additional details..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDenyDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleDeny}
            disabled={!denialReason}
          >
            Deny
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onClose={() => setShowNoteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Note</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter your note..."
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNoteDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddNote}
            disabled={!newNote}
          >
            Add Note
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        message={success}
      />
    </Box>
  )
}

export default PriorAuthPage
