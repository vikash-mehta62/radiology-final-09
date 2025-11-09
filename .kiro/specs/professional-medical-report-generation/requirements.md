# Professional Medical Report Generation - Requirements

## Introduction

This specification defines a comprehensive AI-powered medical report generation system that creates professional, detailed radiology reports using actual analysis data from MedSigLIP (classification) and MedGemma (report generation) AI models. The system ensures only frames with real AI processing are included, with complete data extraction and professional formatting.

## Glossary

- **MedSigLIP**: Medical image classification AI model that provides diagnostic labels and confidence scores
- **MedGemma**: Medical report generation AI model that produces structured radiology reports with findings, impressions, and recommendations
- **Frame**: A single slice or image from a medical imaging study (CT, MRI, X-ray)
- **AI Analysis**: Processing of a medical image through both MedSigLIP and MedGemma models
- **Consolidated Report**: A comprehensive report combining analysis results from multiple frames
- **Key Findings**: Important diagnostic observations identified by the AI
- **Critical Findings**: Urgent or significant findings requiring immediate attention
- **Detection Summary**: Aggregated information about abnormalities detected across frames
- **Fallback Analysis**: Placeholder or dummy data used when AI services are unavailable (must be excluded)

## Requirements

### Requirement 1: Frame Filtering and Validation

**User Story:** As a radiologist, I want to see only frames that were actually processed by MedSigLIP and MedGemma, so that I can trust the analysis results are from real AI models and not placeholder data.

#### Acceptance Criteria

1. THE Report Generator SHALL filter frames to include only those processed by MedSigLIP or MedGemma
2. THE Report Generator SHALL exclude frames where aiStatus.status equals "unavailable"
3. THE Report Generator SHALL exclude frames where aiStatus.servicesUsed array is empty
4. THE Report Generator SHALL exclude frames where classification is null and report is null
5. THE Report Generator SHALL validate that each included frame has at least one of: classification data OR report data

### Requirement 2: Data Extraction Per Frame

**User Story:** As a radiologist, I want to see complete analysis data for each frame including findings, impressions, recommendations, and quality metrics, so that I can make informed diagnostic decisions.

#### Acceptance Criteria

1. THE Report Generator SHALL extract findings from results.report.findings for each frame
2. THE Report Generator SHALL extract impression from results.report.impression for each frame
3. THE Report Generator SHALL extract recommendations array from results.report.recommendations for each frame
4. THE Report Generator SHALL extract keyFindings array from results.report.keyFindings when available
5. THE Report Generator SHALL extract criticalFindings array from results.report.criticalFindings when available
6. THE Report Generator SHALL extract detectionSummary from results.detections when available
7. THE Report Generator SHALL extract classification label from results.classification.label when available
8. THE Report Generator SHALL extract confidence score from results.classification.confidence when available
9. THE Report Generator SHALL extract overallConfidence from results.combined.overallConfidence when available
10. THE Report Generator SHALL extract imageQuality metrics when available
11. THE Report Generator SHALL extract reliability score when available
12. THE Report Generator SHALL extract completeness percentage when available
13. THE Report Generator SHALL handle missing data by displaying "Data unavailable" instead of using placeholder defaults

### Requirement 3: Image Snapshot Embedding

**User Story:** As a radiologist, I want to see actual image snapshots embedded inline in the report, so that I can visually correlate findings with the images.

#### Acceptance Criteria

1. THE Report Generator SHALL embed image snapshots inline using base64 data from imageSnapshot.data
2. THE Report Generator SHALL NOT use file paths or external references for images
3. THE Report Generator SHALL include captions with frame number and timestamp for each embedded image
4. THE Report Generator SHALL format captions as "Frame X, captured at <timestamp>"
5. THE Report Generator SHALL handle missing image data by displaying "Image not available"

### Requirement 4: Summary Metrics Calculation

**User Story:** As a radiologist, I want to see aggregated statistics across all analyzed frames, so that I can quickly understand the overall study findings.

#### Acceptance Criteria

1. THE Report Generator SHALL calculate total frames analyzed by MedSigLIP and MedGemma
2. THE Report Generator SHALL identify the most common finding across all frames
3. THE Report Generator SHALL compute average confidence from overallConfidence of each processed frame
4. THE Report Generator SHALL generate classification distribution showing count per diagnostic class
5. THE Report Generator SHALL calculate percentage of frames with critical findings
6. THE Report Generator SHALL compute average image quality score across frames
7. THE Report Generator SHALL identify frames with highest and lowest confidence scores

### Requirement 5: Report Header Formatting

**User Story:** As a radiologist, I want a professional report header with all essential metadata, so that the report is properly identified and contextualized.

#### Acceptance Criteria

1. THE Report Generator SHALL include report title "AI Medical Analysis Report"
2. THE Report Generator SHALL include subtitle "Powered by MedSigLIP & MedGemma"
3. THE Report Generator SHALL include unique report ID in format "AI-REPORT-{timestamp}-{random}"
4. THE Report Generator SHALL include generation date and time in ISO format
5. THE Report Generator SHALL include report status (Complete, Partial, or In Progress)
6. THE Report Generator SHALL include AI service versions when available

### Requirement 6: Study Information Section

**User Story:** As a radiologist, I want complete study metadata in the report, so that I can identify the patient and study context.

#### Acceptance Criteria

1. THE Report Generator SHALL include patient ID when available
2. THE Report Generator SHALL include patient name when available (or "Anonymous" if protected)
3. THE Report Generator SHALL include study instance UID
4. THE Report Generator SHALL include series instance UID when available
5. THE Report Generator SHALL include modality (CT, MRI, XR, etc.)
6. THE Report Generator SHALL include total frame count in study
7. THE Report Generator SHALL include number of frames analyzed by AI
8. THE Report Generator SHALL include study date and time when available

### Requirement 7: Per-Frame Analysis Sections

**User Story:** As a radiologist, I want detailed analysis for each frame organized in clear sections, so that I can review findings systematically.

#### Acceptance Criteria

1. THE Report Generator SHALL create a section for each analyzed frame
2. THE Report Generator SHALL include frame number and slice index
3. THE Report Generator SHALL include FINDINGS section with complete text from AI analysis
4. THE Report Generator SHALL include IMPRESSION section with diagnostic summary
5. THE Report Generator SHALL include RECOMMENDATIONS section with actionable items
6. THE Report Generator SHALL include Key Findings table when keyFindings array exists
7. THE Report Generator SHALL include Critical Findings table when criticalFindings array exists
8. THE Report Generator SHALL include Detection Summary table when detections exist
9. THE Report Generator SHALL include classification label and confidence score
10. THE Report Generator SHALL include quality metrics (confidence, image quality, reliability)
11. THE Report Generator SHALL include inline image with caption
12. THE Report Generator SHALL separate frames with clear visual dividers

### Requirement 8: Summary Section Formatting

**User Story:** As a radiologist, I want a comprehensive summary section with calculated metrics, so that I can quickly assess the overall study.

#### Acceptance Criteria

1. THE Report Generator SHALL include "Analysis Summary" section header
2. THE Report Generator SHALL display total slices analyzed with percentage of total
3. THE Report Generator SHALL display most common finding with occurrence count
4. THE Report Generator SHALL display average confidence score as percentage
5. THE Report Generator SHALL display classification distribution as table or chart
6. THE Report Generator SHALL display critical findings count and percentage
7. THE Report Generator SHALL display average image quality score
8. THE Report Generator SHALL display frames with highest confidence (top 3)
9. THE Report Generator SHALL display frames with lowest confidence (bottom 3)
10. THE Report Generator SHALL display overall reliability assessment

### Requirement 9: Footer and Disclaimer

**User Story:** As a radiologist, I want appropriate disclaimers and legal notices, so that the AI-generated nature of the report is clear.

#### Acceptance Criteria

1. THE Report Generator SHALL include footer section at end of report
2. THE Report Generator SHALL include disclaimer: "This report was generated by AI (MedSigLIP & MedGemma) and should be reviewed by a qualified radiologist."
3. THE Report Generator SHALL include generation timestamp in footer
4. THE Report Generator SHALL include AI model versions in footer
5. THE Report Generator SHALL include report ID in footer for reference

### Requirement 10: Error Handling and Data Availability

**User Story:** As a radiologist, I want clear indication when data is missing or unavailable, so that I don't mistake missing data for negative findings.

#### Acceptance Criteria

1. THE Report Generator SHALL display "Data unavailable" for missing findings instead of empty sections
2. THE Report Generator SHALL display "Data unavailable" for missing impressions instead of placeholder text
3. THE Report Generator SHALL display "Data unavailable" for missing recommendations instead of generic advice
4. THE Report Generator SHALL skip frames entirely if not processed by MedSigLIP or MedGemma
5. THE Report Generator SHALL indicate partial analysis when only one AI service processed a frame
6. THE Report Generator SHALL log warnings when expected data fields are missing
7. THE Report Generator SHALL NOT use fallback or dummy data to fill missing fields

### Requirement 11: PDF Generation and Formatting

**User Story:** As a radiologist, I want a professionally formatted PDF report with proper styling and layout, so that it's suitable for clinical use and archival.

#### Acceptance Criteria

1. THE Report Generator SHALL generate PDF format output
2. THE Report Generator SHALL use professional medical report styling
3. THE Report Generator SHALL include page numbers on each page
4. THE Report Generator SHALL include report header on each page
5. THE Report Generator SHALL use appropriate fonts (readable, professional)
6. THE Report Generator SHALL use proper spacing and margins
7. THE Report Generator SHALL include page breaks between major sections
8. THE Report Generator SHALL embed images at appropriate resolution
9. THE Report Generator SHALL include table of contents for multi-page reports
10. THE Report Generator SHALL support A4 and Letter page sizes

### Requirement 12: Consolidated Report Aggregation

**User Story:** As a radiologist, I want a single consolidated report combining all frame analyses, so that I can review the entire study in one document.

#### Acceptance Criteria

1. THE Report Generator SHALL combine all frame analyses into single report
2. THE Report Generator SHALL maintain chronological order by frame index
3. THE Report Generator SHALL calculate aggregate statistics across all frames
4. THE Report Generator SHALL identify patterns and trends across frames
5. THE Report Generator SHALL highlight frames with critical findings
6. THE Report Generator SHALL provide navigation links between frames in PDF
7. THE Report Generator SHALL include executive summary at beginning
8. THE Report Generator SHALL include detailed per-frame analysis in body
9. THE Report Generator SHALL include comprehensive summary at end

### Requirement 13: Quality Assurance and Validation

**User Story:** As a system administrator, I want validation checks to ensure report quality and completeness, so that only valid reports are generated.

#### Acceptance Criteria

1. THE Report Generator SHALL validate that at least one frame was processed by AI
2. THE Report Generator SHALL validate that all included frames have required data fields
3. THE Report Generator SHALL validate that confidence scores are between 0 and 1
4. THE Report Generator SHALL validate that timestamps are in valid format
5. THE Report Generator SHALL validate that image data is valid base64 when present
6. THE Report Generator SHALL log validation errors without failing report generation
7. THE Report Generator SHALL include validation summary in report metadata

## Technical Requirements

### Data Flow

1. Fetch analysis records from database by analysisIds
2. Filter records to include only AI-processed frames
3. Extract and validate data from each frame
4. Calculate aggregate statistics
5. Generate PDF with all sections
6. Save PDF to storage
7. Return download URL

### Performance Requirements

1. Report generation SHALL complete within 30 seconds for up to 100 frames
2. PDF file size SHALL NOT exceed 50MB for typical studies
3. Image embedding SHALL use optimized compression
4. Database queries SHALL use indexes for efficient retrieval

### Security Requirements

1. Patient data SHALL be handled according to HIPAA guidelines
2. Reports SHALL include only authorized patient information
3. Generated PDFs SHALL be stored securely
4. Access to reports SHALL require authentication

## Success Criteria

1. All frames processed by MedSigLIP or MedGemma are included in report
2. No frames with fallback/dummy data are included
3. All available data fields are extracted and displayed
4. Images are embedded inline with proper captions
5. Summary metrics are accurately calculated
6. Report is professionally formatted and readable
7. Disclaimers and legal notices are present
8. Missing data is clearly indicated
9. PDF is generated successfully
10. Report is suitable for clinical review and archival
