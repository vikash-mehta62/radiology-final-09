# Advanced Reporting Features - Design Document

## Overview

This design document outlines the technical architecture for implementing advanced features in the Unified Report Editor. The design focuses on modularity, performance, and seamless integration with existing systems while maintaining backward compatibility.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified Report Editor                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Voice      │  │   Template   │  │   Report     │     │
│  │  Dictation   │  │    System    │  │  Comparison  │     │
│  │   Module     │  │    Module    │  │    Module    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │     AI       │  │  Autocomplete│  │   Quality    │     │
│  │ Suggestions  │  │    Module    │  │  Validation  │     │
│  │   Module     │  │              │  │    Module    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                    Core Services Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Report     │  │   Template   │  │   AI         │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                    Backend API Layer                         │
│  /api/reports  /api/templates  /api/ai-suggestions          │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

```
viewer/src/
├── components/
│   └── reports/
│       ├── UnifiedReportEditor.tsx (existing)
│       ├── modules/
│       │   ├── VoiceDictationModule.tsx
│       │   ├── TemplateSelector.tsx
│       │   ├── TemplateBuilder.tsx
│       │   ├── ReportComparison.tsx
│       │   ├── AISuggestions.tsx
│       │   ├── MedicalAutocomplete.tsx
│       │   └── QualityValidator.tsx
│       └── hooks/
│           ├── useVoiceDictation.ts
│           ├── useTemplates.ts
│           ├── useReportComparison.ts
│           └── useAISuggestions.ts
├── services/
│   ├── voiceDictationService.ts
│   ├── templateService.ts
│   ├── reportComparisonService.ts
│   └── aiSuggestionService.ts
└── utils/
    ├── medicalTerms.ts
    └── validationRules.ts
```



## Module Designs

### 1. Voice Dictation Module

#### Technology Stack
- **Web Speech API**: Browser-native speech recognition
- **SpeechRecognition interface**: Continuous recognition mode
- **React hooks**: Custom `useVoiceDictation` hook

#### Component Design

```typescript
interface VoiceDictationProps {
  targetField: string;
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

// Hook for voice dictation
function useVoiceDictation() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const startListening = () => { /* ... */ };
  const stopListening = () => { /* ... */ };
  
  return { isListening, transcript, error, startListening, stopListening };
}
```

#### Features
- Real-time transcription with interim results
- Punctuation command support ("period", "comma", "new line")
- Medical vocabulary optimization
- Error handling for browser compatibility
- Visual feedback (pulsing microphone icon)

#### Integration Points
- Attach to existing text fields in UnifiedReportEditor
- Add microphone button next to each major field
- Append transcribed text to field value
- Maintain cursor position



### 2. Template System

#### Data Model

```typescript
interface ReportTemplate {
  id: string;
  name: string;
  modality: string[];  // ['CT', 'MRI', 'XR']
  bodyRegion: string;  // 'Head', 'Chest', 'Abdomen'
  category: string;
  isCustom: boolean;
  isShared: boolean;
  createdBy: string;
  sections: TemplateSection[];
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateSection {
  id: string;
  title: string;
  order: number;
  fields: TemplateField[];
  required: boolean;
}

interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'dropdown' | 'checkbox' | 'radio' | 'number' | 'date';
  options?: string[];  // For dropdown/radio
  defaultValue?: any;
  required: boolean;
  placeholder?: string;
  validation?: ValidationRule;
}

interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'range';
  value: any;
  message: string;
}
```

#### Built-in Templates

**CT Head Template**
- Sections: Clinical History, Technique, Findings (Brain, Skull, Soft Tissues), Impression
- Fields: Contrast (yes/no), Slice thickness, Reconstruction

**MRI Spine Template**
- Sections: Clinical History, Technique, Findings (Alignment, Vertebral Bodies, Discs, Cord), Impression
- Fields: Sequences (T1, T2, STIR), Contrast, Levels examined

**Chest X-ray Template**
- Sections: Clinical History, Technique, Findings (Heart, Lungs, Bones), Impression
- Fields: View (PA, AP, Lateral), Comparison

#### Template Builder UI

```
┌─────────────────────────────────────────────────────────┐
│  Create Custom Template                                  │
├─────────────────────────────────────────────────────────┤
│  Template Name: [_____________________]                  │
│  Modality: [CT ▼] [MRI ▼] [XR ▼]                       │
│  Body Region: [Head ▼]                                   │
│                                                           │
│  Sections:                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. Clinical History                    [↑][↓][×]│   │
│  │    └─ Field: History text (required)            │   │
│  │                                                   │   │
│  │ 2. Findings                            [↑][↓][×]│   │
│  │    └─ Field: Findings text (required)           │   │
│  │    └─ Field: Severity (dropdown)                │   │
│  │                                                   │   │
│  │ [+ Add Section]                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  [Preview] [Save Template] [Cancel]                      │
└─────────────────────────────────────────────────────────┘
```



### 3. Report Comparison Module

#### Data Flow

```
User clicks "Compare with Prior"
    ↓
Fetch prior reports for patient
    ↓
Display report selector
    ↓
User selects prior report
    ↓
Load both reports
    ↓
Perform diff analysis
    ↓
Display side-by-side with highlights
```

#### Comparison Algorithm

```typescript
interface ComparisonResult {
  newFindings: Finding[];
  resolvedFindings: Finding[];
  changedFindings: ChangedFinding[];
  stableFindings: Finding[];
  measurementChanges: MeasurementChange[];
  summary: ComparisonSummary;
}

interface ChangedFinding {
  id: string;
  location: string;
  priorDescription: string;
  currentDescription: string;
  changeType: 'improved' | 'worsened' | 'modified';
}

interface MeasurementChange {
  type: string;
  location: string;
  priorValue: number;
  currentValue: number;
  change: number;
  percentChange: number;
  unit: string;
}

interface ComparisonSummary {
  totalChanges: number;
  significantChanges: number;
  overallTrend: 'improved' | 'stable' | 'worsened';
  timeInterval: number;  // days
}
```

#### UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Report Comparison                                            │
├──────────────────────────────────────────────────────────────┤
│  Current Study: 2024-01-15  │  Prior Study: 2023-12-01       │
│  ────────────────────────────┼────────────────────────────── │
│  FINDINGS:                   │  FINDINGS:                     │
│  • Lesion in right lobe      │  • Lesion in right lobe        │
│    Size: 2.5 cm ↑            │    Size: 2.0 cm                │
│    [NEW] Irregular margins   │    Smooth margins              │
│                               │                                 │
│  [NEW] Small effusion        │  [RESOLVED] Mild edema         │
│  ────────────────────────────┼────────────────────────────── │
│  MEASUREMENTS:                                                 │
│  • Lesion diameter: 2.5 cm (was 2.0 cm) +25% ↑               │
│  ────────────────────────────────────────────────────────────│
│  SUMMARY:                                                      │
│  • 1 new finding                                              │
│  • 1 resolved finding                                         │
│  • 1 measurement increased                                    │
│  • Overall trend: WORSENED                                    │
│  ────────────────────────────────────────────────────────────│
│  [Copy to Current Report] [Close]                             │
└──────────────────────────────────────────────────────────────┘
```



### 4. AI Suggestions Module

#### Architecture

```typescript
interface AISuggestion {
  id: string;
  type: 'finding' | 'measurement' | 'diagnosis' | 'recommendation';
  content: string;
  confidence: number;  // 0-1
  source: 'MedSigLIP' | 'MedGemma';
  reasoning: string;
  accepted: boolean | null;
  timestamp: Date;
}

interface SuggestionContext {
  currentFindings: string;
  currentImpression: string;
  aiAnalysisResults: any;
  priorReports?: any[];
}
```

#### Suggestion Generation

```typescript
class AISuggestionService {
  async generateSuggestions(context: SuggestionContext): Promise<AISuggestion[]> {
    const suggestions: AISuggestion[] = [];
    
    // Extract from AI analysis
    if (context.aiAnalysisResults) {
      suggestions.push(...this.extractFromAI(context.aiAnalysisResults));
    }
    
    // Compare with prior
    if (context.priorReports) {
      suggestions.push(...this.compareWithPrior(context));
    }
    
    // Validate completeness
    suggestions.push(...this.validateCompleteness(context));
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}
```

#### UI Integration

```
┌─────────────────────────────────────────────────────────┐
│  AI Suggestions                                    [×]   │
├─────────────────────────────────────────────────────────┤
│  🤖 3 suggestions available                              │
│                                                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ⚠️ High Priority (95% confidence)                 │ │
│  │ Consider mentioning the 2.5cm lesion in the      │ │
│  │ impression section.                               │ │
│  │ [Accept] [Dismiss] [Why?]                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 💡 Suggestion (78% confidence)                    │ │
│  │ Add measurement for the right lobe lesion.        │ │
│  │ [Accept] [Dismiss] [Why?]                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                           │
│  [Show All] [Hide Suggestions]                           │
└─────────────────────────────────────────────────────────┘
```



### 5. Medical Autocomplete Module

#### Dictionary Structure

```typescript
interface MedicalTerm {
  term: string;
  category: 'anatomy' | 'pathology' | 'measurement' | 'procedure';
  synonyms: string[];
  abbreviation?: string;
  definition: string;
  frequency: number;  // Usage frequency for ranking
}

// Example terms
const medicalDictionary: MedicalTerm[] = [
  {
    term: "hepatomegaly",
    category: "pathology",
    synonyms: ["enlarged liver"],
    abbreviation: "HM",
    definition: "Abnormal enlargement of the liver",
    frequency: 150
  },
  {
    term: "right upper quadrant",
    category: "anatomy",
    synonyms: ["RUQ"],
    abbreviation: "RUQ",
    definition: "Upper right section of the abdomen",
    frequency: 300
  }
];
```

#### Autocomplete Algorithm

```typescript
class AutocompleteService {
  private dictionary: MedicalTerm[];
  private userHistory: Map<string, number>;
  
  getSuggestions(input: string, limit: number = 5): MedicalTerm[] {
    const normalized = input.toLowerCase().trim();
    
    // Match by term start
    const startMatches = this.dictionary.filter(term =>
      term.term.toLowerCase().startsWith(normalized)
    );
    
    // Match by word start
    const wordMatches = this.dictionary.filter(term =>
      term.term.toLowerCase().includes(' ' + normalized)
    );
    
    // Match by abbreviation
    const abbrevMatches = this.dictionary.filter(term =>
      term.abbreviation?.toLowerCase() === normalized
    );
    
    // Combine and rank
    const allMatches = [...abbrevMatches, ...startMatches, ...wordMatches];
    
    return this.rankSuggestions(allMatches, normalized).slice(0, limit);
  }
  
  private rankSuggestions(terms: MedicalTerm[], input: string): MedicalTerm[] {
    return terms.sort((a, b) => {
      // Prioritize user history
      const aHistory = this.userHistory.get(a.term) || 0;
      const bHistory = this.userHistory.get(b.term) || 0;
      if (aHistory !== bHistory) return bHistory - aHistory;
      
      // Then by frequency
      if (a.frequency !== b.frequency) return b.frequency - a.frequency;
      
      // Then by length (shorter = more specific)
      return a.term.length - b.term.length;
    });
  }
}
```

#### UI Component

```typescript
<Autocomplete
  options={suggestions}
  getOptionLabel={(option) => option.term}
  renderOption={(props, option) => (
    <Box {...props}>
      <Typography variant="body1">{option.term}</Typography>
      {option.abbreviation && (
        <Chip label={option.abbreviation} size="small" sx={{ ml: 1 }} />
      )}
      <Typography variant="caption" color="text.secondary">
        {option.definition}
      </Typography>
    </Box>
  )}
  onInputChange={(event, value) => handleInputChange(value)}
  freeSolo
/>
```



### 6. Quality Validation Module

#### Validation Rules

```typescript
interface ValidationRule {
  id: string;
  name: string;
  severity: 'error' | 'warning' | 'info';
  check: (report: Report) => ValidationResult;
}

interface ValidationResult {
  passed: boolean;
  message: string;
  field?: string;
  suggestion?: string;
}

const validationRules: ValidationRule[] = [
  {
    id: 'required-fields',
    name: 'Required Fields',
    severity: 'error',
    check: (report) => {
      const missing = [];
      if (!report.findings) missing.push('Findings');
      if (!report.impression) missing.push('Impression');
      
      return {
        passed: missing.length === 0,
        message: missing.length > 0 
          ? `Missing required fields: ${missing.join(', ')}`
          : 'All required fields present'
      };
    }
  },
  {
    id: 'critical-in-impression',
    name: 'Critical Findings in Impression',
    severity: 'warning',
    check: (report) => {
      const criticalFindings = report.structuredFindings
        ?.filter(f => f.severity === 'severe') || [];
      
      const mentionedInImpression = criticalFindings.every(finding =>
        report.impression?.toLowerCase().includes(finding.location.toLowerCase())
      );
      
      return {
        passed: mentionedInImpression,
        message: mentionedInImpression
          ? 'Critical findings mentioned in impression'
          : 'Some critical findings not mentioned in impression',
        suggestion: 'Ensure all critical findings are summarized in impression'
      };
    }
  },
  {
    id: 'measurement-units',
    name: 'Measurement Units',
    severity: 'error',
    check: (report) => {
      const missingUnits = report.measurements
        ?.filter(m => !m.unit) || [];
      
      return {
        passed: missingUnits.length === 0,
        message: missingUnits.length > 0
          ? `${missingUnits.length} measurements missing units`
          : 'All measurements have units'
      };
    }
  }
];
```

#### Validation UI

```
┌─────────────────────────────────────────────────────────┐
│  Report Quality Check                                    │
├─────────────────────────────────────────────────────────┤
│  ✅ 8 checks passed                                      │
│  ⚠️  2 warnings                                          │
│  ❌ 1 error                                              │
│                                                           │
│  ❌ ERROR: Missing required fields                       │
│     Impression section is empty                          │
│     [Go to Field]                                        │
│                                                           │
│  ⚠️  WARNING: Critical findings not in impression        │
│     Severe finding in "right lobe" not mentioned         │
│     [Go to Field] [Ignore]                               │
│                                                           │
│  ⚠️  WARNING: Report length unusual                      │
│     Findings section is shorter than typical             │
│     [Review] [Ignore]                                    │
│                                                           │
│  [Fix Issues] [Sign Anyway] [Cancel]                     │
└─────────────────────────────────────────────────────────┘
```



## Data Models

### Extended Report Model

```typescript
interface ExtendedReport extends Report {
  // Existing fields
  _id: string;
  studyInstanceUID: string;
  patientInfo: PatientInfo;
  findings: string;
  impression: string;
  recommendations: string;
  clinicalHistory: string;
  technique: string;
  structuredFindings: Finding[];
  measurements: Measurement[];
  status: 'draft' | 'signed';
  
  // New fields for Phase 3
  templateId?: string;
  templateData?: TemplateData;
  aiSuggestions?: AISuggestion[];
  comparisonData?: ComparisonResult;
  validationResults?: ValidationResult[];
  voiceTranscripts?: VoiceTranscript[];
  qualityScore?: number;
  completionPercentage?: number;
}

interface TemplateData {
  templateId: string;
  templateName: string;
  fieldValues: Record<string, any>;
  completedSections: string[];
}

interface VoiceTranscript {
  id: string;
  field: string;
  transcript: string;
  confidence: number;
  timestamp: Date;
  edited: boolean;
}
```

### Database Schema Updates

```javascript
// MongoDB schema for templates
const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  modality: [{ type: String, required: true }],
  bodyRegion: { type: String, required: true },
  category: { type: String, required: true },
  isCustom: { type: Boolean, default: false },
  isShared: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sections: [{
    title: String,
    order: Number,
    fields: [{
      label: String,
      type: String,
      options: [String],
      defaultValue: mongoose.Schema.Types.Mixed,
      required: Boolean,
      placeholder: String,
      validation: {
        type: String,
        value: mongoose.Schema.Types.Mixed,
        message: String
      }
    }],
    required: Boolean
  }],
  usageCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes
templateSchema.index({ modality: 1, bodyRegion: 1 });
templateSchema.index({ createdBy: 1, isCustom: 1 });
templateSchema.index({ isShared: 1 });
```



## API Endpoints

### Template Endpoints

```
GET    /api/templates
       Query: ?modality=CT&bodyRegion=Head
       Response: Template[]

GET    /api/templates/:id
       Response: Template

POST   /api/templates
       Body: Template
       Response: Template

PUT    /api/templates/:id
       Body: Partial<Template>
       Response: Template

DELETE /api/templates/:id
       Response: { success: boolean }

GET    /api/templates/shared
       Response: Template[]

POST   /api/templates/:id/share
       Response: { success: boolean }
```

### Comparison Endpoints

```
GET    /api/reports/compare/:currentId/:priorId
       Response: ComparisonResult

GET    /api/reports/patient/:patientId/history
       Query: ?limit=10
       Response: Report[]
```

### AI Suggestion Endpoints

```
POST   /api/ai/suggestions
       Body: { reportId: string, context: SuggestionContext }
       Response: AISuggestion[]

POST   /api/ai/suggestions/:id/accept
       Response: { success: boolean }

POST   /api/ai/suggestions/:id/reject
       Response: { success: boolean }
```

### Validation Endpoints

```
POST   /api/reports/:id/validate
       Response: ValidationResult[]

GET    /api/validation/rules
       Response: ValidationRule[]
```



## Implementation Strategy

### Phase 3.1: Voice Dictation (Week 1-2)
**Priority: HIGH - Immediate productivity gain**

1. Create `useVoiceDictation` hook
2. Implement Web Speech API integration
3. Add microphone buttons to UnifiedReportEditor
4. Handle browser compatibility
5. Add visual feedback (recording indicator)
6. Test with medical terminology
7. Add punctuation command support

**Deliverables:**
- VoiceDictationModule.tsx
- useVoiceDictation.ts hook
- voiceDictationService.ts
- Updated UnifiedReportEditor with voice buttons

### Phase 3.2: Template System (Week 3-4)
**Priority: HIGH - Standardization and efficiency**

1. Design template data model
2. Create built-in templates (CT, MRI, X-ray)
3. Implement TemplateSelector component
4. Implement TemplateBuilder component
5. Create template service and API
6. Add template selection to report creation flow
7. Integrate with UnifiedReportEditor

**Deliverables:**
- TemplateSelector.tsx
- TemplateBuilder.tsx
- templateService.ts
- Backend template API
- 5+ built-in templates

### Phase 3.3: Report Comparison (Week 5-6)
**Priority: MEDIUM - Clinical value for follow-ups**

1. Design comparison algorithm
2. Implement diff logic for findings
3. Implement measurement change calculation
4. Create ReportComparison component
5. Add "Compare with Prior" button
6. Create comparison API endpoints
7. Test with real report data

**Deliverables:**
- ReportComparison.tsx
- reportComparisonService.ts
- Comparison API endpoints
- Side-by-side comparison UI

### Phase 3.4: AI Enhancements (Week 7-8)
**Priority: MEDIUM - Leverage existing AI**

1. Design suggestion generation logic
2. Implement AISuggestions component
3. Create suggestion service
4. Integrate with existing AI analysis
5. Add confidence indicators
6. Implement accept/reject workflow
7. Track suggestion acceptance rates

**Deliverables:**
- AISuggestions.tsx
- aiSuggestionService.ts
- Suggestion API endpoints
- Analytics for suggestion quality

### Phase 3.5: Autocomplete & Validation (Week 9-10)
**Priority: LOW - Nice to have**

1. Build medical terms dictionary
2. Implement autocomplete service
3. Create MedicalAutocomplete component
4. Define validation rules
5. Implement QualityValidator component
6. Add pre-sign validation check
7. Create validation API

**Deliverables:**
- MedicalAutocomplete.tsx
- QualityValidator.tsx
- medicalTerms.ts dictionary
- validationRules.ts
- Validation API endpoints



## Testing Strategy

### Unit Tests

```typescript
// Voice Dictation
describe('useVoiceDictation', () => {
  it('should start listening when startListening is called', () => {});
  it('should stop listening when stopListening is called', () => {});
  it('should update transcript when speech is recognized', () => {});
  it('should handle errors gracefully', () => {});
});

// Template Service
describe('TemplateService', () => {
  it('should fetch templates by modality', () => {});
  it('should create custom template', () => {});
  it('should validate template structure', () => {});
});

// Comparison Service
describe('ReportComparisonService', () => {
  it('should identify new findings', () => {});
  it('should calculate measurement changes', () => {});
  it('should generate comparison summary', () => {});
});
```

### Integration Tests

```typescript
describe('UnifiedReportEditor with Voice', () => {
  it('should transcribe voice to findings field', async () => {
    render(<UnifiedReportEditor {...props} />);
    const micButton = screen.getByLabelText('Voice dictation');
    fireEvent.click(micButton);
    // Simulate speech recognition
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Findings' }))
        .toHaveValue('transcribed text');
    });
  });
});

describe('Template Selection Flow', () => {
  it('should load template and populate fields', async () => {
    render(<UnifiedReportEditor {...props} />);
    // Select template
    // Verify fields are populated
  });
});
```

### E2E Tests

```typescript
describe('Complete Reporting Workflow', () => {
  it('should create report with voice dictation and template', async () => {
    // 1. Open report editor
    // 2. Select template
    // 3. Use voice dictation
    // 4. Add structured findings
    // 5. Compare with prior
    // 6. Accept AI suggestions
    // 7. Validate quality
    // 8. Sign report
  });
});
```



## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**
   - Load voice dictation module only when first used
   - Load template builder only when accessed
   - Load comparison module on demand

2. **Caching**
   - Cache templates in localStorage
   - Cache medical terms dictionary
   - Cache prior reports for quick comparison

3. **Debouncing**
   - Debounce autocomplete queries (300ms)
   - Debounce validation checks (500ms)
   - Debounce auto-save (2000ms)

4. **Code Splitting**
   ```typescript
   const VoiceDictationModule = lazy(() => 
     import('./modules/VoiceDictationModule')
   );
   const TemplateBuilder = lazy(() => 
     import('./modules/TemplateBuilder')
   );
   ```

5. **Memoization**
   ```typescript
   const memoizedSuggestions = useMemo(() => 
     generateSuggestions(context), 
     [context.findings, context.impression]
   );
   ```

### Performance Targets

- Voice transcription latency: < 1s
- Template loading: < 500ms
- Autocomplete response: < 100ms
- Comparison generation: < 3s
- Validation check: < 500ms
- Bundle size increase: < 200KB

