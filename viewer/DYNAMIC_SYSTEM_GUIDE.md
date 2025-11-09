# 🔄 Dynamic System Integration Guide

## ✅ **COMPLETE! Everything is Now Dynamic**

### 🎉 **What's Been Made Dynamic**

I've created a comprehensive system where **ALL information flows automatically** from settings and user context throughout the entire application.

---

## 🏗️ **System Architecture**

### **3 Core Components:**

1. **`useSettings` Hook** - Manages all app settings
2. **`useUserContext` Hook** - Manages user information
3. **`AppContext` Provider** - Combines both and provides helpers

---

## 📊 **What's Dynamic Now**

### **1. Dashboard** 📈

**Dynamic Elements:**
- ✅ **User Name** - From logged-in user
- ✅ **Institution Name** - From settings/user
- ✅ **Department Name** - From settings/user
- ✅ **User Role** - From user context
- ✅ **User Avatar/Initials** - Auto-generated
- ✅ **Welcome Message** - Personalized

**How to Use:**
```typescript
import { useApp } from '@/contexts/AppContext'

function Dashboard() {
  const { getDisplayName, getInstitutionName, getDepartmentName, user } = useApp()
  
  return (
    <div>
      <h1>Welcome, {getDisplayName()}!</h1>
      <p>{getInstitutionName()} - {getDepartmentName()}</p>
      <p>Role: {user?.role}</p>
    </div>
  )
}
```

---

### **2. Reports** 📋

**Dynamic Elements:**
- ✅ **Institution Name** - Auto-filled in header
- ✅ **Department Name** - Auto-filled in header
- ✅ **Radiologist Name** - Auto-filled from user/settings
- ✅ **Radiologist Signature** - Auto-loaded from user profile
- ✅ **Default Template** - From settings
- ✅ **Macro Settings** - Enabled/disabled from settings
- ✅ **Auto-save Interval** - From settings

**How to Use:**
```typescript
import { useApp } from '@/contexts/AppContext'

function ReportEditor() {
  const { 
    getInstitutionName, 
    getDepartmentName, 
    getRadiologistName,
    getRadiologistSignature,
    settings 
  } = useApp()
  
  const reportData = {
    institution: getInstitutionName(),
    department: getDepartmentName(),
    radiologist: getRadiologistName(),
    signature: getRadiologistSignature(),
    template: settings.defaultTemplate,
    enableMacros: settings.enableMacros
  }
}
```

---

### **3. Export (PDF/DOCX)** 📤

**Dynamic Elements:**
- ✅ **Institution Name** - In header
- ✅ **Department Name** - In header
- ✅ **Radiologist Name** - In signature section
- ✅ **Radiologist Signature** - Embedded image
- ✅ **Default Format** - From settings
- ✅ **Include Images** - From settings
- ✅ **Include Signature** - From settings
- ✅ **Watermark** - Enabled/disabled from settings

**How to Use:**
```typescript
import { useApp } from '@/contexts/AppContext'

function ExportReport() {
  const { 
    getInstitutionName, 
    getDepartmentName, 
    getRadiologistName,
    getRadiologistSignature,
    settings 
  } = useApp()
  
  const exportOptions = {
    format: settings.defaultExportFormat,
    includeImages: settings.includeImages,
    includeSignature: settings.includeSignature,
    watermark: settings.watermarkEnabled ? 'DRAFT' : null,
    headerInfo: {
      institutionName: getInstitutionName(),
      departmentName: getDepartmentName(),
      radiologist: getRadiologistName()
    },
    signature: getRadiologistSignature()
  }
}
```

---

### **4. Viewer** 👁️

**Dynamic Elements:**
- ✅ **Default Window/Level** - From settings
- ✅ **Measurement Units** - From settings
- ✅ **Annotation Color** - From settings
- ✅ **AI Overlay** - Show/hide from settings
- ✅ **GPU Acceleration** - From settings
- ✅ **Default Layout** - From settings

**How to Use:**
```typescript
import { useApp } from '@/contexts/AppContext'

function Viewer() {
  const { settings } = useApp()
  
  const viewerConfig = {
    windowLevel: settings.defaultWindowLevel,
    measurementUnit: settings.measurementUnit,
    annotationColor: settings.annotationColor,
    showAIOverlay: settings.showAIOverlay,
    enableGPU: settings.enableGPU,
    layout: settings.defaultLayout
  }
}
```

---

### **5. Notifications** 🔔

**Dynamic Elements:**
- ✅ **Email Address** - From user/settings
- ✅ **Critical Findings Alerts** - Enabled/disabled
- ✅ **Report Status Updates** - Enabled/disabled
- ✅ **Email Notifications** - Enabled/disabled

**How to Use:**
```typescript
import { useApp } from '@/contexts/AppContext'

function NotificationSystem() {
  const { getUserEmail, settings } = useApp()
  
  if (settings.criticalFindingsAlert) {
    sendAlert({
      to: getUserEmail(),
      type: 'critical',
      enabled: settings.emailNotifications
    })
  }
}
```

---

### **6. User Profile** 👤

**Dynamic Elements:**
- ✅ **Name** - Editable, syncs everywhere
- ✅ **Email** - Editable, syncs everywhere
- ✅ **Role** - Displayed
- ✅ **Department** - Editable, syncs everywhere
- ✅ **Institution** - Editable, syncs everywhere
- ✅ **Signature** - Upload, syncs to reports
- ✅ **Avatar** - Upload or auto-generated initials

---

### **7. System Settings** 🔧

**Dynamic Elements:**
- ✅ **Backend URL** - Used in all API calls
- ✅ **PACS URL** - Used in PACS integration
- ✅ **Cache Size** - Applied to caching system
- ✅ **Debug Logging** - Enabled/disabled

---

## 🎯 **Priority System**

### **Data Priority (Highest to Lowest):**

1. **User Profile Data** (most specific)
2. **Settings Data** (user preferences)
3. **Default Values** (fallback)

### **Example:**

**Institution Name:**
```typescript
getInstitutionName() {
  return user?.institution          // 1st priority
      || settings.institutionName   // 2nd priority
      || 'Medical Imaging Center'   // 3rd priority (default)
}
```

---

## 📝 **Complete Integration Examples**

### **Example 1: Dynamic Dashboard**

```typescript
import { useApp } from '@/contexts/AppContext'

function Dashboard() {
  const { 
    user, 
    getDisplayName, 
    getInitials,
    getInstitutionName, 
    getDepartmentName,
    getUserRole 
  } = useApp()
  
  return (
    <Box>
      {/* User Avatar */}
      <Avatar>{getInitials()}</Avatar>
      
      {/* Welcome Message */}
      <Typography variant="h4">
        Welcome back, {getDisplayName()}!
      </Typography>
      
      {/* Institution Info */}
      <Typography variant="subtitle1">
        {getInstitutionName()}
      </Typography>
      <Typography variant="body2">
        {getDepartmentName()} • {getUserRole()}
      </Typography>
      
      {/* User-specific content */}
      {user?.credentials && (
        <Chip label={user.credentials} />
      )}
    </Box>
  )
}
```

---

### **Example 2: Dynamic Report**

```typescript
import { useApp } from '@/contexts/AppContext'

function StructuredReporting() {
  const { 
    getInstitutionName, 
    getDepartmentName, 
    getRadiologistName,
    getRadiologistSignature,
    settings 
  } = useApp()
  
  // Auto-fill report header
  const reportHeader = {
    institution: getInstitutionName(),
    department: getDepartmentName(),
    date: new Date().toLocaleDateString()
  }
  
  // Auto-fill radiologist info
  const radiologistInfo = {
    name: getRadiologistName(),
    signature: getRadiologistSignature()
  }
  
  // Use settings for behavior
  const reportSettings = {
    template: settings.defaultTemplate,
    enableMacros: settings.enableMacros,
    autoSave: settings.autoSave,
    autoSaveInterval: settings.autoSaveInterval
  }
  
  return (
    <ReportEditor
      header={reportHeader}
      radiologist={radiologistInfo}
      settings={reportSettings}
    />
  )
}
```

---

### **Example 3: Dynamic Export**

```typescript
import { useApp } from '@/contexts/AppContext'
import { exportToPDF } from '@/services/ReportExportService'

function ExportButton() {
  const { 
    getInstitutionName, 
    getDepartmentName, 
    getRadiologistName,
    getRadiologistSignature,
    settings 
  } = useApp()
  
  const handleExport = () => {
    const reportData = {
      // ... report content
    }
    
    const exportOptions = {
      format: settings.defaultExportFormat,
      includeImages: settings.includeImages,
      includeSignature: settings.includeSignature,
      watermark: settings.watermarkEnabled ? 
        (reportData.status === 'final' ? 'FINAL' : 'DRAFT') : null,
      headerInfo: {
        institutionName: getInstitutionName(),
        departmentName: getDepartmentName(),
        radiologist: getRadiologistName()
      }
    }
    
    // Signature is automatically included if available
    reportData.radiologistSignature = getRadiologistSignature()
    
    exportToPDF(reportData, exportOptions)
  }
  
  return <Button onClick={handleExport}>Export</Button>
}
```

---

## 🔄 **Data Flow Diagram**

```
┌─────────────────────────────────────────────────────────┐
│                    USER LOGS IN                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              USER DATA LOADED                            │
│  • Name: Dr. John Smith                                 │
│  • Email: john.smith@hospital.com                       │
│  • Role: Radiologist                                    │
│  • Institution: City Hospital                           │
│  • Department: Radiology                                │
│  • Signature: [image data]                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            SETTINGS LOADED                               │
│  • Institution: Medical Imaging Center (fallback)       │
│  • Department: Radiology Department (fallback)          │
│  • Default Template: chest-xray                         │
│  • Export Format: PDF                                   │
│  • Include Images: true                                 │
│  • Watermark: true                                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              APP CONTEXT COMBINES                        │
│  getInstitutionName() → "City Hospital" (from user)     │
│  getDepartmentName() → "Radiology" (from user)          │
│  getRadiologistName() → "Dr. John Smith" (from user)    │
│  getRadiologistSignature() → [image] (from user)        │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬────────────┐
        │            │            │            │
        ▼            ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Dashboard │  │ Reports  │  │ Exports  │  │  Viewer  │
│          │  │          │  │          │  │          │
│ Welcome, │  │ City     │  │ PDF with │  │ Default  │
│ Dr. John │  │ Hospital │  │ City     │  │ settings │
│ Smith!   │  │          │  │ Hospital │  │ applied  │
│          │  │ Radiology│  │ header   │  │          │
│ City     │  │          │  │          │  │          │
│ Hospital │  │ Dr. John │  │ Signature│  │          │
│          │  │ Smith    │  │ embedded │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## 🎨 **Visual Changes**

### **Before:**
- ❌ Hardcoded "Medical Imaging Center"
- ❌ Hardcoded "Dr. Medical Professional"
- ❌ Generic "User" everywhere
- ❌ No signature in reports
- ❌ Manual entry required

### **After:**
- ✅ Dynamic institution name from user/settings
- ✅ Dynamic radiologist name from user/settings
- ✅ Personalized "Welcome, Dr. John Smith!"
- ✅ Automatic signature embedding
- ✅ Everything auto-filled

---

## 📋 **Complete List of Dynamic Fields**

### **User-Related (27 fields):**
1. User Name
2. User Email
3. User Role
4. User Department
5. User Institution
6. User Signature
7. User Credentials
8. User License Number
9. User Phone
10. User Avatar
11. User Initials
12. Display Name
13. User ID

### **Settings-Related (27 fields):**
14. Theme
15. Language
16. Default Layout
17. Auto-save
18. Auto-save Interval
19. Window/Level Preset
20. Measurement Unit
21. Annotation Color
22. AI Overlay
23. GPU Acceleration
24. Institution Name (fallback)
25. Department Name (fallback)
26. Radiologist Name (fallback)
27. Default Template
28. Enable Macros
29. Export Format
30. Include Images
31. Include Signature
32. Watermark Enabled
33. Backend URL
34. PACS URL
35. Cache Size
36. Debug Logging
37. Email Notifications
38. Critical Findings Alert
39. Report Status Updates
40. Notification Email

**Total: 40 Dynamic Fields!**

---

## 🚀 **How to Use in Your Components**

### **Step 1: Import the Hook**
```typescript
import { useApp } from '@/contexts/AppContext'
```

### **Step 2: Use in Component**
```typescript
function MyComponent() {
  const { 
    user,                    // Full user object
    settings,                // Full settings object
    getDisplayName,          // Helper: Get user display name
    getInstitutionName,      // Helper: Get institution
    getDepartmentName,       // Helper: Get department
    getRadiologistName,      // Helper: Get radiologist
    getRadiologistSignature, // Helper: Get signature
    getUserEmail,            // Helper: Get email
    getUserRole,             // Helper: Get role
    hasPermission            // Helper: Check permissions
  } = useApp()
  
  // Use anywhere!
}
```

### **Step 3: Update When Needed**
```typescript
const { updateUser, saveSettings } = useApp()

// Update user info
updateUser({ name: 'Dr. New Name' })

// Update settings
saveSettings({ institutionName: 'New Hospital' })

// Changes propagate everywhere automatically!
```

---

## ✅ **Summary**

**Everything is now dynamic:**

- ✅ Dashboard shows logged-in user name
- ✅ Dashboard shows institution from settings/user
- ✅ Reports auto-fill institution info
- ✅ Reports auto-fill radiologist name
- ✅ Reports auto-load signature
- ✅ Exports use settings for defaults
- ✅ Exports include dynamic headers
- ✅ Viewer uses settings for defaults
- ✅ Notifications use user email
- ✅ All 40 fields are dynamic!

**No more hardcoded values!** 🎉

**Everything flows automatically from:**
1. User profile (highest priority)
2. Settings (fallback)
3. Defaults (last resort)

**Your system is now fully dynamic and professional!** 🚀
