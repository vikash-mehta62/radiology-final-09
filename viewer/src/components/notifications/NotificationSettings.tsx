/**
 * NotificationSettings Component
 * Allows users to configure notification preferences
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Button,
  Alert,
  CircularProgress,
  TextField,
  Grid,
  Chip,
  Slider,
  IconButton,
} from '@mui/material';
import {
  Email as EmailIcon,
  Sms as SmsIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as PushIcon,
  VolumeUp as SoundIcon,
  VolumeOff as VolumeOffIcon,
  DoNotDisturb as DoNotDisturbIcon,
  Save as SaveIcon,
  PlayArrow as PlayIcon,
} from '@mui/material/icons-material';
import notificationService from '../../services/notificationService';
import { NotificationSettings as NotificationSettingsType } from '../../types/notifications';
import {
  loadSoundSettings,
  saveSoundSettings,
  testNotificationSound,
  SoundSettings,
  NotificationSoundType,
} from '../../utils/notificationSound';

export const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettingsType | null>(null);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(loadSoundSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testingSound, setTestingSound] = useState<NotificationSoundType | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationService.getSettings();
      
      if (data) {
        setSettings(data);
      } else {
        // Set default settings if none exist
        setSettings({
          userId: '',
          channels: {
            email: true,
            sms: false,
            inApp: true,
            push: true,
          },
          soundEnabled: true,
          doNotDisturb: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
          },
          severityFilters: {
            critical: true,
            high: true,
            medium: true,
          },
        });
      }
    } catch (err) {
      setError('Failed to load notification settings');
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      // Save notification settings
      const success = await notificationService.updateSettings(settings);
      
      // Save sound settings
      saveSoundSettings(soundSettings);
      
      if (success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save notification settings');
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSound = async (type: NotificationSoundType) => {
    setTestingSound(type);
    try {
      await testNotificationSound(type);
    } catch (error) {
      console.error('Failed to test sound:', error);
    } finally {
      setTimeout(() => setTestingSound(null), 1000);
    }
  };

  const handleChannelChange = (channel: keyof NotificationSettingsType['channels']) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      channels: {
        ...settings.channels,
        [channel]: !settings.channels[channel],
      },
    });
  };

  const handleSeverityChange = (severity: keyof NotificationSettingsType['severityFilters']) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      severityFilters: {
        ...settings.severityFilters,
        [severity]: !settings.severityFilters[severity],
      },
    });
  };

  const handleSoundToggle = () => {
    setSoundSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleVolumeChange = (_event: Event, value: number | number[]) => {
    setSoundSettings(prev => ({ ...prev, volume: value as number }));
  };

  const handleSeveritySoundToggle = (severity: 'critical' | 'high' | 'medium') => {
    setSoundSettings(prev => ({
      ...prev,
      [`${severity}Enabled`]: !prev[`${severity}Enabled` as keyof SoundSettings],
    }));
  };

  const handleDoNotDisturbToggle = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      doNotDisturb: {
        ...settings.doNotDisturb,
        enabled: !settings.doNotDisturb.enabled,
      },
    });
  };

  const handleTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      doNotDisturb: {
        ...settings.doNotDisturb,
        [field]: value,
      },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!settings) {
    return (
      <Alert severity="error">Failed to load notification settings</Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Notification Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          Settings saved successfully
        </Alert>
      )}

      {/* Notification Channels */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <NotificationsIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Notification Channels</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose how you want to receive critical notifications
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.channels.email}
                  onChange={() => handleChannelChange('email')}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmailIcon fontSize="small" />
                  <span>Email Notifications</span>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.channels.sms}
                  onChange={() => handleChannelChange('sms')}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SmsIcon fontSize="small" />
                  <span>SMS Notifications</span>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.channels.inApp}
                  onChange={() => handleChannelChange('inApp')}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NotificationsIcon fontSize="small" />
                  <span>In-App Notifications</span>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.channels.push}
                  onChange={() => handleChannelChange('push')}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PushIcon fontSize="small" />
                  <span>Browser Push Notifications</span>
                </Box>
              }
            />
          </FormGroup>
        </CardContent>
      </Card>

      {/* Sound Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {soundSettings.enabled ? <SoundIcon sx={{ mr: 1 }} /> : <VolumeOffIcon sx={{ mr: 1 }} />}
            <Typography variant="h6">Sound Alerts</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure notification sound alerts
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={soundSettings.enabled}
                onChange={handleSoundToggle}
              />
            }
            label="Enable notification sounds"
            sx={{ mb: 2 }}
          />

          {soundSettings.enabled && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  Volume
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <VolumeOffIcon fontSize="small" />
                  <Slider
                    value={soundSettings.volume}
                    onChange={handleVolumeChange}
                    min={0}
                    max={1}
                    step={0.1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                    sx={{ flex: 1 }}
                  />
                  <SoundIcon fontSize="small" />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
                Sound by Severity
              </Typography>
              <FormGroup>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={soundSettings.criticalEnabled}
                        onChange={() => handleSeveritySoundToggle('critical')}
                        color="error"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>Critical</span>
                        <Chip label="Urgent" size="small" color="error" />
                      </Box>
                    }
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleTestSound('critical')}
                    disabled={!soundSettings.criticalEnabled || testingSound === 'critical'}
                  >
                    <PlayIcon />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={soundSettings.highEnabled}
                        onChange={() => handleSeveritySoundToggle('high')}
                        color="warning"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>High Priority</span>
                        <Chip label="Important" size="small" color="warning" />
                      </Box>
                    }
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleTestSound('high')}
                    disabled={!soundSettings.highEnabled || testingSound === 'high'}
                  >
                    <PlayIcon />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={soundSettings.mediumEnabled}
                        onChange={() => handleSeveritySoundToggle('medium')}
                        color="info"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>Medium Priority</span>
                        <Chip label="Standard" size="small" color="info" />
                      </Box>
                    }
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleTestSound('medium')}
                    disabled={!soundSettings.mediumEnabled || testingSound === 'medium'}
                  >
                    <PlayIcon />
                  </IconButton>
                </Box>
              </FormGroup>

              <Alert severity="info" sx={{ mt: 2 }}>
                Click the play button to test each sound. Sounds respect browser autoplay policies.
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Severity Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Notification Severity
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select which severity levels you want to receive
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.severityFilters.critical}
                  onChange={() => handleSeverityChange('critical')}
                  color="error"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Critical</span>
                  <Chip label="Urgent" size="small" color="error" />
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.severityFilters.high}
                  onChange={() => handleSeverityChange('high')}
                  color="warning"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>High Priority</span>
                  <Chip label="Important" size="small" color="warning" />
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.severityFilters.medium}
                  onChange={() => handleSeverityChange('medium')}
                  color="info"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Medium Priority</span>
                  <Chip label="Standard" size="small" color="info" />
                </Box>
              }
            />
          </FormGroup>
        </CardContent>
      </Card>

      {/* Do Not Disturb */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <DoNotDisturbIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Do Not Disturb</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set quiet hours when you don't want to receive notifications (except critical)
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.doNotDisturb.enabled}
                onChange={handleDoNotDisturbToggle}
              />
            }
            label="Enable Do Not Disturb"
            sx={{ mb: 2 }}
          />
          {settings.doNotDisturb.enabled && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Start Time"
                  type="time"
                  value={settings.doNotDisturb.startTime || '22:00'}
                  onChange={(e) => handleTimeChange('startTime', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="End Time"
                  type="time"
                  value={settings.doNotDisturb.endTime || '08:00'}
                  onChange={(e) => handleTimeChange('endTime', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            Critical notifications will always be delivered regardless of Do Not Disturb settings
          </Alert>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={loadSettings}
          disabled={saving}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
};

export default NotificationSettings;
