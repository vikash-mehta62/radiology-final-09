/**
 * View Report Button Component
 * Shows if a report exists for the current study and allows viewing/exporting it
 */

import React, { useState, useEffect } from 'react';
import { Button, Menu, MenuItem, Chip, CircularProgress, Tooltip } from '@mui/material';
import { Description, Visibility, Download, Edit } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../../services/ReportsApi';

interface ViewReportButtonProps {
  studyInstanceUID: string;
  patientID?: string;
  patientName?: string;
  modality?: string;
}

export const ViewReportButton: React.FC<ViewReportButtonProps> = ({
  studyInstanceUID,
  patientID,
  patientName,
  modality
}) => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    loadReports();
  }, [studyInstanceUID]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await reportsApi.listByStudy(studyInstanceUID);
      setReports(response.reports || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (reports.length === 1) {
      // If only one report, go directly to it
      viewReport(reports[0].reportId || reports[0]._id);
    } else if (reports.length > 1) {
      // If multiple reports, show menu
      setAnchorEl(event.currentTarget);
    } else {
      // No reports, create new one
      createNewReport();
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const viewReport = (reportId: string) => {
    handleClose();
    navigate(`/app/reporting?reportId=${reportId}&studyUID=${studyInstanceUID}`);
  };

  const createNewReport = () => {
    navigate(
      `/app/reporting?studyUID=${studyInstanceUID}&patientID=${patientID || ''}&patientName=${patientName || ''}&modality=${modality || ''}`
    );
  };

  const getReportStatusColor = (status: string) => {
    switch (status) {
      case 'final':
      case 'finalized':
        return 'success';
      case 'preliminary':
        return 'warning';
      case 'draft':
        return 'default';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Button disabled startIcon={<CircularProgress size={16} />}>
        Loading...
      </Button>
    );
  }

  if (reports.length === 0) {
    return (
      <Tooltip title="Create a new report for this study">
        <Button
          variant="contained"
          color="primary"
          startIcon={<Description />}
          onClick={createNewReport}
        >
          Create Report
        </Button>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title={reports.length === 1 ? 'View existing report' : 'View reports'}>
        <Button
          variant="contained"
          color="success"
          startIcon={<Visibility />}
          onClick={handleClick}
          endIcon={reports.length > 1 ? <Chip label={reports.length} size="small" /> : null}
        >
          {reports.length === 1 ? 'View Report' : `View Reports (${reports.length})`}
        </Button>
      </Tooltip>

      {reports.length > 1 && (
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
          {reports.map((report, index) => (
            <MenuItem key={report._id} onClick={() => viewReport(report.reportId || report._id)}>
              <Description sx={{ mr: 1 }} fontSize="small" />
              Report {index + 1} - 
              <Chip
                label={report.reportStatus || report.status || 'draft'}
                size="small"
                color={getReportStatusColor(report.reportStatus || report.status)}
                sx={{ ml: 1 }}
              />
              {report.reportDate && (
                <span style={{ marginLeft: 8, fontSize: '0.85em', color: 'gray' }}>
                  {new Date(report.reportDate).toLocaleDateString()}
                </span>
              )}
            </MenuItem>
          ))}
          <MenuItem onClick={createNewReport}>
            <Edit sx={{ mr: 1 }} fontSize="small" />
            Create New Report
          </MenuItem>
        </Menu>
      )}
    </>
  );
};
