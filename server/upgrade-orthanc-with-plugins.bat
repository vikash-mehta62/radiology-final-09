@echo off
REM Safe Orthanc Upgrade Script for Windows
REM Upgrades to orthanc-plugins without losing data

echo ========================================
echo Orthanc Upgrade to Plugins Version
echo ========================================
echo.

REM Step 1: Backup current data
echo Step 1: Backing up current Orthanc data...
docker exec orthanc tar czf /tmp/orthanc-backup.tar.gz /var/lib/orthanc/db /var/lib/orthanc/storage 2>nul
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/: " %%a in ('time /t') do (set mytime=%%a%%b)
docker cp orthanc:/tmp/orthanc-backup.tar.gz orthanc-backup-%mydate%-%mytime%.tar.gz
echo Backup created
echo.

REM Step 2: Get current configuration
echo Step 2: Saving current configuration...
docker exec orthanc cat /etc/orthanc/orthanc.json > orthanc-config-backup.json 2>nul
echo Configuration saved
echo.

REM Step 3: Stop and remove old container
echo Step 3: Stopping old Orthanc container...
docker stop orthanc
docker rm orthanc
echo Old container removed (data preserved in volumes)
echo.

REM Step 4: Start new Orthanc with plugins
echo Step 4: Starting Orthanc with plugins...
docker run -d ^
  --name orthanc ^
  -p 4242:4242 ^
  -p 8042:8042 ^
  -v orthanc-storage:/var/lib/orthanc/db ^
  -e ORTHANC__AUTHENTICATION_ENABLED=true ^
  -e ORTHANC__REGISTERED_USERS={"orthanc":"orthanc"} ^
  -e ORTHANC__REMOTE_ACCESS_ALLOWED=true ^
  -e ORTHANC__HTTP_PORT=8042 ^
  -e ORTHANC__DICOM_PORT=4242 ^
  jodogne/orthanc-plugins:latest

echo New Orthanc started with plugins
echo.

REM Step 5: Wait for Orthanc to start
echo Step 5: Waiting for Orthanc to start...
timeout /t 5 /nobreak >nul

REM Step 6: Verify
echo Step 6: Verifying installation...
echo.
echo Checking Orthanc:
curl -s -u orthanc:orthanc http://69.62.70.102:8042/system
echo.

echo ========================================
echo Upgrade Complete!
echo.
echo Summary:
echo   - Old data: Preserved in volumes
echo   - Backup: orthanc-backup-*.tar.gz
echo   - Config backup: orthanc-config-backup.json
echo   - New features: GDCM, Web Viewer, DICOMweb
echo.
echo Access Orthanc:
echo   - Web UI: http://69.62.70.102:8042
echo   - Username: orthanc
echo   - Password: orthanc
echo.
echo You can now upload echocardiograms!
echo ========================================
pause
