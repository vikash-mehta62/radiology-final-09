# OHIF Integration Guide

## Overview

This guide shows how to integrate OHIF viewer with your existing React application.

## Integration Options

### Option 1: Open in New Tab (Simplest)

Add a button to your study viewer that opens OHIF in a new tab:

```tsx
// In viewer/src/pages/studies/StudyViewer.tsx
const openInOHIF = (studyUID: string) => {
  const ohifUrl = `http://localhost:3001/viewer?StudyInstanceUIDs=${studyUID}`;
  window.open(ohifUrl, '_blank');
};

// Add button in your UI
<button 
  onClick={() => openInOHIF(study.studyInstanceUID)}
  className="btn btn-primary"
>
  Open in Advanced Viewer (OHIF)
</button>
```

### Option 2: Embed as iFrame

Embed OHIF directly in your application:

```tsx
// Create a new component: viewer/src/components/OHIFViewer.tsx
import React from 'react';

interface OHIFViewerProps {
  studyInstanceUID: string;
  height?: string;
}

export const OHIFViewer: React.FC<OHIFViewerProps> = ({ 
  studyInstanceUID, 
  height = '800px' 
}) => {
  const ohifUrl = `http://localhost:3001/viewer?StudyInstanceUIDs=${studyInstanceUID}`;
  
  return (
    <iframe
      src={ohifUrl}
      width="100%"
      height={height}
      style={{ border: 'none' }}
      title="OHIF Viewer"
    />
  );
};
```

Usage:
```tsx
<OHIFViewer studyInstanceUID={study.studyInstanceUID} />
```

### Option 3: Modal Popup

Show OHIF in a modal dialog:

```tsx
// viewer/src/components/OHIFModal.tsx
import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';

interface OHIFModalProps {
  studyInstanceUID: string;
}

export const OHIFModal: React.FC<OHIFModalProps> = ({ studyInstanceUID }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ohifUrl = `http://localhost:3001/viewer?StudyInstanceUIDs=${studyInstanceUID}`;

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Open Advanced Viewer
      </button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <div style={{ width: '95vw', height: '90vh' }}>
          <iframe
            src={ohifUrl}
            width="100%"
            height="100%"
            style={{ border: 'none' }}
            title="OHIF Viewer"
          />
        </div>
      </Dialog>
    </>
  );
};
```

## URL Parameters

OHIF supports various URL parameters:

```
# Single study
http://localhost:3001/viewer?StudyInstanceUIDs=1.2.3.4.5

# Multiple studies
http://localhost:3001/viewer?StudyInstanceUIDs=1.2.3.4.5,1.2.3.4.6

# Specific series
http://localhost:3001/viewer?StudyInstanceUIDs=1.2.3.4.5&SeriesInstanceUIDs=1.2.3.4.5.1
```

## Advanced Integration

### Communicate Between Apps

Use postMessage API to communicate between your app and OHIF:

```tsx
// Send message to OHIF
const iframe = document.querySelector('iframe');
iframe?.contentWindow?.postMessage({
  type: 'LOAD_STUDY',
  studyUID: '1.2.3.4.5'
}, 'http://localhost:3001');

// Listen for messages from OHIF
window.addEventListener('message', (event) => {
  if (event.origin !== 'http://localhost:3001') return;
  
  if (event.data.type === 'MEASUREMENT_ADDED') {
    console.log('Measurement added:', event.data.measurement);
  }
});
```

## Production Deployment

### 1. Update Configuration for Production

Edit `public/config/default.js`:

```javascript
window.config = {
  servers: {
    dicomWeb: [{
      name: 'Orthanc',
      wadoUriRoot: 'https://your-domain.com/wado',
      qidoRoot: 'https://your-domain.com/dicom-web',
      wadoRoot: 'https://your-domain.com/dicom-web',
      // ... rest of config
    }]
  }
};
```

### 2. Update Docker Compose for Production

```yaml
version: '3.8'

services:
  ohif-viewer:
    image: ohif/viewer:latest
    container_name: ohif-viewer
    ports:
      - "3001:80"
    volumes:
      - ./public/config:/usr/share/nginx/html/config:ro
    environment:
      - NODE_ENV=production
    restart: always
    networks:
      - dicom-network

networks:
  dicom-network:
    external: true
```

### 3. Nginx Reverse Proxy

Add to your nginx configuration:

```nginx
# OHIF Viewer
location /ohif/ {
    proxy_pass http://localhost:3001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Then access OHIF at: `https://your-domain.com/ohif/`

## Security Considerations

### 1. Enable Authentication

If your Orthanc has authentication, update the config:

```javascript
servers: {
  dicomWeb: [{
    // ...
    requestOptions: {
      auth: 'username:password',
      // Or use token
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN'
      }
    }
  }]
}
```

### 2. CORS Configuration

Ensure Orthanc allows OHIF origin. In Orthanc config:

```json
{
  "RemoteAccessAllowed": true,
  "HttpsCACertificates": "/etc/ssl/certs/ca-certificates.crt",
  "SslEnabled": false,
  "SslCertificate": "",
  "HttpHeaders": {
    "Access-Control-Allow-Origin": "http://localhost:3001",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  }
}
```

## Troubleshooting

### OHIF can't load studies

1. Check Orthanc is accessible: `http://localhost:8042`
2. Verify DICOMweb plugin is enabled
3. Check browser console for CORS errors
4. Test DICOMweb endpoint: `http://localhost:8042/dicom-web/studies`

### Images not rendering

1. Check WADO-RS endpoint: `http://localhost:8042/dicom-web/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/1`
2. Verify image transfer syntax is supported
3. Check browser console for errors

### Performance issues

1. Enable lazy loading in config
2. Use thumbnail rendering for study list
3. Consider using WADO-URI for better caching
4. Optimize Orthanc database

## Next Steps

1. Test OHIF with your DICOM studies
2. Choose integration method (new tab, iframe, or modal)
3. Customize OHIF configuration for your needs
4. Set up production deployment
5. Configure authentication and security
6. Train users on OHIF features

## Resources

- OHIF Documentation: https://docs.ohif.org/
- Configuration Guide: https://docs.ohif.org/configuration/
- Extension Development: https://docs.ohif.org/development/
- Deployment Guide: https://docs.ohif.org/deployment/
