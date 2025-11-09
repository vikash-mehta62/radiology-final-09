# OHIF Viewer with Full 3D/4D Features

This is a pre-built OHIF viewer with all advanced features enabled:
- ✅ 3D MPR (Multi-Planar Reconstruction)
- ✅ 3D Volume Rendering
- ✅ MIP (Maximum Intensity Projection)
- ✅ Segmentation Tools
- ✅ Measurement Tools
- ✅ 4D Imaging Support
- ✅ PET/CT Fusion
- ✅ RT (Radiation Therapy) Support

## Quick Start

1. Start the viewer:
```bash
cd ohif-docker
docker-compose up -d
```

2. Open in browser:
```
http://localhost:3000
```

3. Stop the viewer:
```bash
docker-compose down
```

## Configuration

Edit `app-config.js` to change:
- Orthanc server URL
- Data source settings
- Viewer preferences

After editing, restart:
```bash
docker-compose restart
```

## Connected to AWS Orthanc
- Server: 54.160.225.145:8043
- No authentication required
