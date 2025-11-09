import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore,
  Description,
  Assignment,
  Person,
  CalendarToday
} from '@mui/icons-material';

interface SRContent {
  conceptName: string;
  conceptCode?: string;
  value?: string;
  unit?: string;
  children?: SRContent[];
  type?: 'TEXT' | 'NUM' | 'CODE' | 'DATE' | 'TIME' | 'CONTAINER';
}

interface StructuredReportData {
  patientName?: string;
  patientID?: string;
  studyDate?: string;
  reportTitle?: string;
  completionFlag?: string;
  verificationFlag?: string;
  content: SRContent[];
}

interface StructuredReportViewerProps {
  instanceId: string;
  onLoad?: (data: StructuredReportData) => void;
}

const StructuredReportViewer: React.FC<StructuredReportViewerProps> = ({
  instanceId,
  onLoad
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<StructuredReportData | null>(null);

  useEffect(() => {
    loadStructuredReport();
  }, [instanceId]);

  const loadStructuredReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch SR metadata from Orthanc
      const response = await fetch(
        `http://localhost:8001/api/dicom/instances/${instanceId}/metadata`
      );

      if (!response.ok) {
        throw new Error('Failed to load structured report');
      }

      const metadata = await response.json();
      
      // Parse SR content
      const parsed = parseStructuredReport(metadata);
      setReportData(parsed);
      
      if (onLoad) {
        onLoad(parsed);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseStructuredReport = (metadata: any): StructuredReportData => {
    // Parse DICOM SR tags
    return {
      patientName: metadata.PatientName || 'Unknown',
      patientID: metadata.PatientID || 'Unknown',
      studyDate: metadata.StudyDate || '',
      reportTitle: metadata.ContentLabel || metadata.SeriesDescription || 'Structured Report',
      completionFlag: metadata.CompletionFlag || 'PARTIAL',
      verificationFlag: metadata.VerificationFlag || 'UNVERIFIED',
      content: parseContentSequence(metadata.ContentSequence || [])
    };
  };

  const parseContentSequence = (sequence: any[]): SRContent[] => {
    return sequence.map(item => ({
      conceptName: item.ConceptNameCodeSequence?.[0]?.CodeMeaning || 'Unknown',
      conceptCode: item.ConceptNameCodeSequence?.[0]?.CodeValue,
      value: item.TextValue || item.NumericValue || item.DateTime || '',
      unit: item.MeasurementUnitsCodeSequence?.[0]?.CodeMeaning,
      type: item.ValueType || 'TEXT',
      children: item.ContentSequence ? parseContentSequence(item.ContentSequence) : []
    }));
  };

  const renderContent = (content: SRContent, level: number = 0): React.ReactNode => {
    const hasChildren = content.children && content.children.length > 0;

    if (hasChildren) {
      return (
        <Accordion key={content.conceptName} defaultExpanded={level === 0}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" fontWeight="bold">
              {content.conceptName}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ pl: 2 }}>
              {content.children!.map((child, index) => (
                <Box key={index} sx={{ mb: 1 }}>
                  {renderContent(child, level + 1)}
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <Typography variant="body2" fontWeight="medium" sx={{ minWidth: 200 }}>
          {content.conceptName}:
        </Typography>
        <Typography variant="body2">
          {content.value}
          {content.unit && ` ${content.unit}`}
        </Typography>
        {content.conceptCode && (
          <Chip label={content.conceptCode} size="small" variant="outlined" />
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!reportData) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No report data available
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Description color="primary" />
          <Typography variant="h6">{reportData.reportTitle}</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person fontSize="small" />
            <Typography variant="body2">
              <strong>Patient:</strong> {reportData.patientName} ({reportData.patientID})
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarToday fontSize="small" />
            <Typography variant="body2">
              <strong>Date:</strong> {reportData.studyDate}
            </Typography>
          </Box>

          <Chip
            label={reportData.completionFlag}
            color={reportData.completionFlag === 'COMPLETE' ? 'success' : 'warning'}
            size="small"
          />

          <Chip
            label={reportData.verificationFlag}
            color={reportData.verificationFlag === 'VERIFIED' ? 'success' : 'default'}
            size="small"
          />
        </Box>
      </Paper>

      {/* Content */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Report Content
        </Typography>
        {reportData.content.map((item, index) => (
          <Box key={index} sx={{ mb: 1 }}>
            {renderContent(item)}
          </Box>
        ))}
      </Paper>
    </Box>
  );
};

export default StructuredReportViewer;
