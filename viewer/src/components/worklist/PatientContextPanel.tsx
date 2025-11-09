import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material'
import {
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  Assignment as ReportIcon,
  LocalHospital as ServiceIcon,
  Science as ObservationIcon,
  Task as TaskIcon,
  Close as CloseIcon,
  Cake as BirthdateIcon,
  Wc as GenderIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as AddressIcon,
} from '@mui/icons-material'
import { format, parseISO, differenceInYears } from 'date-fns'

import { fhirService } from '@/services/fhirService'
import type { Study } from '@/types/worklist'
import type {
  FHIRPatient,
  FHIRDiagnosticReport,
  FHIRServiceRequest,
  FHIRObservation,
  FHIRTask,
  PatientContext,
} from '@medical-imaging/shared-types'

interface PatientContextPanelProps {
  study: Study | null
  onClose?: () => void
}

export const PatientContextPanel: React.FC<PatientContextPanelProps> = ({
  study,
  onClose,
}) => {
  const [patientContext, setPatientContext] = useState<PatientContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!study) {
      setPatientContext(null)
      return
    }

    const loadPatientContext = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const context = await fhirService.getPatientContext(study.patientID)
        setPatientContext(context)
      } catch (err) {
        console.error('Failed to load patient context:', err)
        setError('Failed to load patient information')
      } finally {
        setLoading(false)
      }
    }

    loadPatientContext()
  }, [study])

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  const calculateAge = (birthDate: string) => {
    try {
      return differenceInYears(new Date(), parseISO(birthDate))
    } catch {
      return null
    }
  }

  const getPatientInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const renderPatientDemographics = (patient: FHIRPatient) => {
    const age = patient.birthDate ? calculateAge(patient.birthDate) : null
    const name = patient.name?.[0]
    const displayName = name ? `${name.given?.join(' ')} ${name.family}` : 'Unknown Patient'
    
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {getPatientInitials(displayName)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {patient.id}
              </Typography>
            </Box>
          </Box>

          <List dense>
            {patient.birthDate && (
              <ListItem>
                <ListItemIcon>
                  <BirthdateIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Birth Date"
                  secondary={`${formatDate(patient.birthDate)}${age ? ` (${age} years old)` : ''}`}
                />
              </ListItem>
            )}
            
            {patient.gender && (
              <ListItem>
                <ListItemIcon>
                  <GenderIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Gender"
                  secondary={patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                />
              </ListItem>
            )}

            {patient.telecom?.map((contact, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {contact.system === 'phone' ? <PhoneIcon /> : <EmailIcon />}
                </ListItemIcon>
                <ListItemText
                  primary={contact.system?.charAt(0).toUpperCase() + contact.system?.slice(1)}
                  secondary={contact.value}
                />
              </ListItem>
            ))}

            {patient.address?.[0] && (
              <ListItem>
                <ListItemIcon>
                  <AddressIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Address"
                  secondary={[
                    patient.address[0].line?.join(', '),
                    patient.address[0].city,
                    patient.address[0].state,
                    patient.address[0].postalCode,
                  ].filter(Boolean).join(', ')}
                />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>
    )
  }

  const renderDiagnosticReports = (reports: FHIRDiagnosticReport[]) => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReportIcon />
          <Typography>Diagnostic Reports ({reports.length})</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <List dense>
          {reports.slice(0, 10).map((report, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={report.code?.text || 'Unknown Report'}
                secondary={
                  <Box>
                    <Typography variant="caption" display="block">
                      {report.effectiveDateTime && formatDate(report.effectiveDateTime)}
                    </Typography>
                    <Chip
                      size="small"
                      label={report.status}
                      color={report.status === 'final' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                }
              />
            </ListItem>
          ))}
          {reports.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No diagnostic reports found"
                secondary="No previous reports available"
              />
            </ListItem>
          )}
        </List>
      </AccordionDetails>
    </Accordion>
  )

  const renderServiceRequests = (requests: FHIRServiceRequest[]) => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ServiceIcon />
          <Typography>Service Requests ({requests.length})</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <List dense>
          {requests.slice(0, 10).map((request, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={request.code?.text || 'Unknown Service'}
                secondary={
                  <Box>
                    <Typography variant="caption" display="block">
                      {request.authoredOn && formatDate(request.authoredOn)}
                    </Typography>
                    <Chip
                      size="small"
                      label={request.status}
                      color={request.status === 'completed' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                }
              />
            </ListItem>
          ))}
          {requests.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No service requests found"
                secondary="No imaging orders available"
              />
            </ListItem>
          )}
        </List>
      </AccordionDetails>
    </Accordion>
  )

  const renderObservations = (observations: FHIRObservation[]) => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ObservationIcon />
          <Typography>Observations ({observations.length})</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <List dense>
          {observations.slice(0, 10).map((observation, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={observation.code?.text || 'Unknown Observation'}
                secondary={
                  <Box>
                    <Typography variant="caption" display="block">
                      {observation.effectiveDateTime && formatDate(observation.effectiveDateTime)}
                    </Typography>
                    {observation.valueQuantity && (
                      <Typography variant="body2">
                        {observation.valueQuantity.value} {observation.valueQuantity.unit}
                      </Typography>
                    )}
                    {observation.valueString && (
                      <Typography variant="body2">
                        {observation.valueString}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
          {observations.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No observations found"
                secondary="No clinical observations available"
              />
            </ListItem>
          )}
        </List>
      </AccordionDetails>
    </Accordion>
  )

  const renderTasks = (tasks: FHIRTask[]) => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TaskIcon />
          <Typography>Tasks ({tasks.length})</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <List dense>
          {tasks.slice(0, 10).map((task, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={task.description || 'Unknown Task'}
                secondary={
                  <Box>
                    <Typography variant="caption" display="block">
                      {task.authoredOn && formatDate(task.authoredOn)}
                    </Typography>
                    <Chip
                      size="small"
                      label={task.status}
                      color={task.status === 'completed' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                }
              />
            </ListItem>
          ))}
          {tasks.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No tasks found"
                secondary="No workflow tasks available"
              />
            </ListItem>
          )}
        </List>
      </AccordionDetails>
    </Accordion>
  )

  if (!study) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', minHeight: 200 }}>
        <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Study Selected
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a study from the worklist to view patient context
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Patient Context
          </Typography>
          {onClose && (
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {study.patientName} • {study.studyDescription}
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {patientContext && (
          <Box>
            {/* Patient Demographics */}
            {patientContext.patient && renderPatientDemographics(patientContext.patient)}

            <Divider sx={{ my: 2 }} />

            {/* Clinical Data */}
            <Box sx={{ '& .MuiAccordion-root': { mb: 1 } }}>
              {renderDiagnosticReports(patientContext.diagnosticReports || [])}
              {renderServiceRequests(patientContext.serviceRequests || [])}
              {renderObservations(patientContext.observations || [])}
              {renderTasks(patientContext.tasks || [])}
            </Box>
          </Box>
        )}

        {!loading && !error && !patientContext && (
          <Alert severity="info">
            No patient context available for this study
          </Alert>
        )}
      </Box>
    </Paper>
  )
}

export default PatientContextPanel