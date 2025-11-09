/**
 * Unified Reporting Utilities
 * Provides telemetry, error reporting, and helper functions for the reporting system
 */

export interface TelemetryEvent {
  event: string;
  payload: Record<string, any>;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

export interface ReportError {
  error: Error | string;
  context: Record<string, any>;
  timestamp: string;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Emit telemetry event for observability
 * Events are dispatched as CustomEvents and can be captured by telemetry listeners
 */
export function telemetryEmit(event: string, payload: Record<string, any> = {}): void {
  try {
    const telemetryEvent: TelemetryEvent = {
      event,
      payload,
      timestamp: new Date().toISOString(),
      userId: getCurrentUserId(),
      sessionId: getSessionId(),
    };

    // Dispatch as custom event for listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('telemetry', {
          detail: telemetryEvent,
        })
      );
    }

    // Console log in development
    if (import.meta.env.DEV) {
      console.log('[Telemetry]', event, payload);
    }
  } catch (err) {
    console.error('Failed to emit telemetry:', err);
  }
}

/**
 * Report error with context for monitoring
 */
export function reportError(
  error: Error | string,
  context: Record<string, any> = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): void {
  try {
    const reportError: ReportError = {
      error,
      context,
      timestamp: new Date().toISOString(),
      userId: getCurrentUserId(),
      severity,
    };

    // Log to console
    console.error('[Report Error]', {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      severity,
    });

    // Dispatch as custom event for error tracking services
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('reportError', {
          detail: reportError,
        })
      );
    }

    // Hook into global error handler if available
    if (typeof window !== 'undefined' && window.onerror) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      // Note: window.onerror signature is (message, source, lineno, colno, error)
      // We'll just log it, actual error tracking services will handle this
    }
  } catch (err) {
    console.error('Failed to report error:', err);
  }
}

/**
 * Get current user ID from session/auth
 */
function getCurrentUserId(): string | undefined {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user._id || user.id;
    }
  } catch {
    // Ignore
  }
  return undefined;
}

/**
 * Get or create session ID
 */
function getSessionId(): string {
  try {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  } catch {
    return `session-${Date.now()}`;
  }
}

/**
 * Show toast notification (success)
 */
export function toast(message: string): void {
  // Simple implementation - can be replaced with a toast library
  console.log(`[Toast] ${message}`);
  
  // Dispatch event for toast listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('toast', {
        detail: { message, type: 'success' },
      })
    );
  }
}

/**
 * C) Show error toast notification with console details
 */
export function toastError(message: string | Error, showConsoleHint: boolean = true): void {
  const errorMessage = message instanceof Error ? message.message : message;
  const displayMessage = showConsoleHint 
    ? `${errorMessage}\n\nDetails in console (F12)`
    : errorMessage;
  
  console.error(`[Toast Error] ${errorMessage}`);
  
  // Dispatch event for toast listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('toast', {
        detail: { 
          message: displayMessage, 
          type: 'error',
          duration: 6000 // Longer duration for error messages
        },
      })
    );
  }
}

/**
 * Expand macros in text (e.g., {{DATE}}, {{USER}})
 */
export function expandMacros(text: string): string {
  if (!text) return text;
  
  const now = new Date();
  const user = getCurrentUserId() || 'Unknown';
  
  return text
    .replace(/\{\{DATE\}\}/g, now.toLocaleDateString())
    .replace(/\{\{TIME\}\}/g, now.toLocaleTimeString())
    .replace(/\{\{DATETIME\}\}/g, now.toLocaleString())
    .replace(/\{\{USER\}\}/g, user);
}

/**
 * Ensure all findings have unique IDs
 */
export function ensureUniqueFindingIds(findings: any[]): any[] {
  const seen = new Set<string>();
  
  return findings.map((finding, index) => {
    if (!finding.id || seen.has(finding.id)) {
      // Generate unique ID
      const newId = `finding-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
      seen.add(newId);
      return { ...finding, id: newId };
    }
    
    seen.add(finding.id);
    return finding;
  });
}

/**
 * Check if report has critical findings
 */
export function hasCriticalFindings(findings: any[]): boolean {
  if (!findings || !Array.isArray(findings)) return false;
  
  return findings.some(
    finding => 
      finding.severity === 'critical' || 
      finding.severity === 'high' ||
      finding.urgent === true
  );
}

/**
 * Map API error to user-friendly message
 */
export function mapApiError(error: any): string {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const message = error.response.data?.message || error.response.data?.error;
    
    if (status === 400) {
      return message || 'Invalid request. Please check your input.';
    } else if (status === 401) {
      return 'Authentication required. Please log in.';
    } else if (status === 403) {
      return 'You do not have permission to perform this action.';
    } else if (status === 404) {
      return 'Resource not found.';
    } else if (status === 409) {
      return message || 'Conflict detected. Please refresh and try again.';
    } else if (status === 422) {
      return message || 'Validation error. Please check your input.';
    } else if (status >= 500) {
      return 'Server error. Please try again later.';
    }
    
    return message || `Request failed with status ${status}`;
  } else if (error.request) {
    // Request made but no response
    return 'Network error. Please check your connection.';
  } else {
    // Something else happened
    return error.message || 'An unexpected error occurred.';
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Format report status for display
 */
export function formatReportStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'Draft',
    preliminary: 'Preliminary',
    final: 'Final',
    amended: 'Amended',
    corrected: 'Corrected',
  };
  return statusMap[status] || status;
}

/**
 * Check if report can be edited based on status
 */
export function canEditReport(status: string): boolean {
  return status === 'draft' || status === 'preliminary';
}

/**
 * Check if report can be finalized
 */
export function canFinalizeReport(status: string): boolean {
  return status === 'draft';
}

/**
 * Check if report can be signed
 */
export function canSignReport(status: string, userRole: string): boolean {
  return (
    status === 'preliminary' &&
    (userRole === 'radiologist' || userRole === 'admin' || userRole === 'superadmin')
  );
}

/**
 * Check if addendum can be added
 */
export function canAddAddendum(status: string): boolean {
  return status === 'final';
}

/**
 * Validate report content before finalization
 * ✅ COMPLIANCE UPDATE: Enhanced validation with QA rules
 */
export function validateReportContent(content: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!content) {
    errors.push('Report content is required');
    return { valid: false, errors };
  }

  // ✅ COMPLIANCE UPDATE: Required impression
  if (!content.impression || content.impression.trim() === '') {
    errors.push('Impression is required');
  }

  // ✅ COMPLIANCE UPDATE: Required findings
  const hasFindings = content.findingsText && content.findingsText.trim() !== '';
  const hasStructuredFindings = content.findings && Array.isArray(content.findings) && content.findings.length > 0;
  
  if (!hasFindings && !hasStructuredFindings) {
    errors.push('Findings are required');
  }

  // ✅ COMPLIANCE UPDATE: Contrast rule for CT
  if (content.modality === 'CT' && content.technique) {
    const techniqueText = content.technique.toLowerCase();
    const findingsText = (content.findingsText || '').toLowerCase();
    
    if (techniqueText.includes('contrast') && !findingsText.includes('contrast')) {
      errors.push('Contrast mentioned in technique but not documented in findings');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate SLA metrics for reporting
 */
export interface SLAMetrics {
  timeToFirstDraft: number; // minutes
  timeToFinalize: number; // minutes
  timeToSign: number; // minutes
  totalTurnaroundTime: number; // minutes
}

export function calculateSLAMetrics(report: any): SLAMetrics | null {
  try {
    const created = new Date(report.metadata?.createdAt);
    const finalized = report.metadata?.finalizedAt ? new Date(report.metadata.finalizedAt) : null;
    const signed = report.signature?.signedAt ? new Date(report.signature.signedAt) : null;

    const timeToFirstDraft = 0; // Assuming draft is created immediately
    const timeToFinalize = finalized
      ? (finalized.getTime() - created.getTime()) / (1000 * 60)
      : 0;
    const timeToSign = signed && finalized
      ? (signed.getTime() - finalized.getTime()) / (1000 * 60)
      : 0;
    const totalTurnaroundTime = signed
      ? (signed.getTime() - created.getTime()) / (1000 * 60)
      : 0;

    return {
      timeToFirstDraft,
      timeToFinalize,
      timeToSign,
      totalTurnaroundTime,
    };
  } catch (err) {
    reportError(err as Error, { reportId: report._id }, 'low');
    return null;
  }
}

// ✅ COMPLIANCE UPDATE (ADVANCED): Okabe-Ito color-blind safe palette
const COLOR_BLIND_SAFE_PALETTE = {
  '#FF0000': '#E69F00', // Red -> Orange
  '#00FF00': '#009E73', // Green -> Bluish green
  '#0000FF': '#0072B2', // Blue -> Blue
  '#FFFF00': '#F0E442', // Yellow -> Yellow
  '#FF00FF': '#CC79A7', // Magenta -> Reddish purple
  '#00FFFF': '#56B4E9', // Cyan -> Sky blue
  '#FFA500': '#D55E00', // Orange -> Vermillion
  '#800080': '#CC79A7'  // Purple -> Reddish purple
};

// ✅ COMPLIANCE UPDATE (ADVANCED): Map color to color-blind safe alternative
function mapToColorBlindSafe(color: string): string {
  const upperColor = color.toUpperCase();
  return COLOR_BLIND_SAFE_PALETTE[upperColor] || color;
}

// ✅ COMPLIANCE UPDATE (ADVANCED): Extract measurements from vector operations
export interface MeasurementRow {
  type: string;
  value: string;
  unit: string;
  location?: string;
  figureNo?: number;
}

export function extractMeasurementsFromVectorOps(vectorOps?: Array<{ type: string; [key: string]: any }>): MeasurementRow[] {
  if (!vectorOps || !Array.isArray(vectorOps)) return [];
  
  const measurements: MeasurementRow[] = [];
  let figureNo = 1;
  
  vectorOps.forEach(op => {
    if (op.type === 'measurement' || op.measurement) {
      measurements.push({
        type: op.measurementType || op.type || 'Length',
        value: op.value?.toFixed(2) || op.length?.toFixed(2) || '0',
        unit: op.unit || 'mm',
        location: op.location || op.label,
        figureNo: figureNo++
      });
    } else if (op.type === 'line' && op.length) {
      measurements.push({
        type: 'Length',
        value: op.length.toFixed(2),
        unit: 'px',
        figureNo: figureNo++
      });
    } else if (op.type === 'rect' && op.w && op.h) {
      const area = op.w * op.h;
      measurements.push({
        type: 'Area',
        value: area.toFixed(2),
        unit: 'px²',
        figureNo: figureNo++
      });
    } else if (op.type === 'circle' && op.radius) {
      const area = Math.PI * op.radius * op.radius;
      measurements.push({
        type: 'Area',
        value: area.toFixed(2),
        unit: 'px²',
        figureNo: figureNo++
      });
    }
  });
  
  return measurements;
}

// ✅ COMPLIANCE UPDATE (ADVANCED): Build legend from vector ops and AI detections
export interface LegendItem {
  figureNo: number;
  label: string;
  color?: string;
}

export function buildLegendFromOpsAndDetections(
  vectorOps?: Array<{ type: string; [key: string]: any }>,
  aiDetections?: Array<{ type: string; description?: string; [key: string]: any }>
): LegendItem[] {
  const legend: LegendItem[] = [];
  let figureNo = 1;
  
  // Add vector ops
  if (vectorOps && Array.isArray(vectorOps)) {
    vectorOps.forEach(op => {
      if (op.label || op.text) {
        legend.push({
          figureNo: figureNo++,
          label: op.label || op.text,
          color: op.color
        });
      }
    });
  }
  
  // Add AI detections
  if (aiDetections && Array.isArray(aiDetections)) {
    aiDetections.forEach(det => {
      legend.push({
        figureNo: figureNo++,
        label: det.description || det.type || 'AI Detection',
        color: '#E69F00' // Orange for AI
      });
    });
  }
  
  return legend;
}

// ✅ COMPLIANCE UPDATE (ADVANCED): Compose image with annotations (PNG/SVG/vector ops)
/**
 * Compose base image with overlay annotations into a single composited image
 * @param basePngDataUrl - Base image as PNG data URL
 * @param overlayPngDataUrl - Optional overlay PNG as data URL
 * @param overlaySvgText - Optional SVG markup as string
 * @param vectorOps - Optional array of vector drawing operations
 * @param opts - Optional rendering options (DPI, color-safe, scale bar, etc.)
 * @returns Promise<string> - Composited image as PNG data URL
 */
export async function composeImageWithAnnotations(
  basePngDataUrl: string,
  overlayPngDataUrl?: string,
  overlaySvgText?: string,
  vectorOps?: Array<{ type: string; [key: string]: any }>,
  opts?: {
    dpi?: number;
    imageType?: 'png' | 'jpeg';
    jpegQuality?: number;
    colorSafe?: boolean;
    showScaleBar?: boolean;
    showOrientation?: boolean;
    scaleInfo?: {
      pxPerMm?: number;
      orientation?: 'R' | 'L' | 'A' | 'P' | 'H' | 'F';
    };
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // ✅ COMPLIANCE UPDATE (ADVANCED): Apply DPI scaling
      const dpiScale = opts?.dpi || 1;
      const maxDimension = 3000; // Prevent OOM
      
      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Load base image
      const baseImg = new Image();
      baseImg.crossOrigin = 'anonymous';
      
      baseImg.onload = async () => {
        // ✅ COMPLIANCE UPDATE (ADVANCED): Calculate scaled dimensions with max limit
        let targetWidth = baseImg.width * dpiScale;
        let targetHeight = baseImg.height * dpiScale;
        
        // Apply downscale if exceeds max dimension
        if (targetWidth > maxDimension || targetHeight > maxDimension) {
          const scale = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
          targetWidth *= scale;
          targetHeight *= scale;
          console.warn(`⚠️ Image downscaled to prevent OOM: ${targetWidth}x${targetHeight}`);
        }
        
        // Set canvas size
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw base image scaled
        ctx.drawImage(baseImg, 0, 0, targetWidth, targetHeight);

        // ✅ COMPLIANCE UPDATE: Draw overlay PNG if present
        if (overlayPngDataUrl) {
          try {
            const overlayImg = new Image();
            overlayImg.crossOrigin = 'anonymous';
            await new Promise<void>((resolveOverlay, rejectOverlay) => {
              overlayImg.onload = () => {
                ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
                resolveOverlay();
              };
              overlayImg.onerror = () => rejectOverlay(new Error('Failed to load overlay PNG'));
              overlayImg.src = overlayPngDataUrl;
            });
          } catch (err) {
            console.warn('Failed to draw overlay PNG:', err);
          }
        }

        // ✅ COMPLIANCE UPDATE: Rasterize and draw SVG if present
        if (overlaySvgText) {
          try {
            const svgBlob = new Blob([overlaySvgText], { type: 'image/svg+xml' });
            const svgUrl = URL.createObjectURL(svgBlob);
            const svgImg = new Image();
            await new Promise<void>((resolveSvg, rejectSvg) => {
              svgImg.onload = () => {
                ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(svgUrl);
                resolveSvg();
              };
              svgImg.onerror = () => {
                URL.revokeObjectURL(svgUrl);
                rejectSvg(new Error('Failed to load SVG'));
              };
              svgImg.src = svgUrl;
            });
          } catch (err) {
            console.warn('Failed to draw SVG overlay:', err);
          }
        }

        // ✅ COMPLIANCE UPDATE (ADVANCED): Draw vector operations with color-blind safe palette
        if (vectorOps && Array.isArray(vectorOps)) {
          vectorOps.forEach(op => {
            try {
              // ✅ COMPLIANCE UPDATE (ADVANCED): Apply color-blind safe mapping
              const baseColor = op.color || '#FF0000';
              const finalColor = opts?.colorSafe ? mapToColorBlindSafe(baseColor) : baseColor;
              
              // Scale coordinates for DPI
              const scaleCoord = (val: number) => val * dpiScale;
              
              switch (op.type) {
                case 'line':
                  ctx.strokeStyle = finalColor;
                  ctx.lineWidth = (op.width || 2) * dpiScale;
                  ctx.beginPath();
                  ctx.moveTo(scaleCoord(op.x1), scaleCoord(op.y1));
                  ctx.lineTo(scaleCoord(op.x2), scaleCoord(op.y2));
                  ctx.stroke();
                  break;

                case 'rect':
                  ctx.strokeStyle = finalColor;
                  ctx.lineWidth = (op.width || 2) * dpiScale;
                  ctx.strokeRect(scaleCoord(op.x), scaleCoord(op.y), scaleCoord(op.w), scaleCoord(op.h));
                  if (op.fill) {
                    const fillColor = opts?.colorSafe ? mapToColorBlindSafe(op.fillColor || 'rgba(255, 0, 0, 0.2)') : (op.fillColor || 'rgba(255, 0, 0, 0.2)');
                    ctx.fillStyle = fillColor;
                    ctx.fillRect(scaleCoord(op.x), scaleCoord(op.y), scaleCoord(op.w), scaleCoord(op.h));
                  }
                  break;

                case 'circle':
                  ctx.strokeStyle = finalColor;
                  ctx.lineWidth = (op.width || 2) * dpiScale;
                  ctx.beginPath();
                  ctx.arc(scaleCoord(op.x), scaleCoord(op.y), scaleCoord(op.radius), 0, 2 * Math.PI);
                  ctx.stroke();
                  if (op.fill) {
                    const fillColor = opts?.colorSafe ? mapToColorBlindSafe(op.fillColor || 'rgba(255, 0, 0, 0.2)') : (op.fillColor || 'rgba(255, 0, 0, 0.2)');
                    ctx.fillStyle = fillColor;
                    ctx.fill();
                  }
                  break;

                case 'polyline':
                  if (op.points && op.points.length > 0) {
                    ctx.strokeStyle = finalColor;
                    ctx.lineWidth = (op.width || 2) * dpiScale;
                    ctx.beginPath();
                    ctx.moveTo(scaleCoord(op.points[0].x), scaleCoord(op.points[0].y));
                    for (let i = 1; i < op.points.length; i++) {
                      ctx.lineTo(scaleCoord(op.points[i].x), scaleCoord(op.points[i].y));
                    }
                    ctx.stroke();
                  }
                  break;

                case 'text':
                  ctx.fillStyle = finalColor;
                  ctx.font = op.font || `${16 * dpiScale}px Arial`;
                  ctx.fillText(op.text, scaleCoord(op.x), scaleCoord(op.y));
                  break;

                case 'arrow':
                  ctx.strokeStyle = finalColor;
                  ctx.lineWidth = (op.width || 2) * dpiScale;
                  ctx.beginPath();
                  ctx.moveTo(scaleCoord(op.x1), scaleCoord(op.y1));
                  ctx.lineTo(scaleCoord(op.x2), scaleCoord(op.y2));
                  ctx.stroke();
                  // Draw arrowhead
                  const angle = Math.atan2(op.y2 - op.y1, op.x2 - op.x1);
                  const headLen = 15 * dpiScale;
                  ctx.beginPath();
                  ctx.moveTo(scaleCoord(op.x2), scaleCoord(op.y2));
                  ctx.lineTo(
                    scaleCoord(op.x2) - headLen * Math.cos(angle - Math.PI / 6),
                    scaleCoord(op.y2) - headLen * Math.sin(angle - Math.PI / 6)
                  );
                  ctx.moveTo(scaleCoord(op.x2), scaleCoord(op.y2));
                  ctx.lineTo(
                    scaleCoord(op.x2) - headLen * Math.cos(angle + Math.PI / 6),
                    scaleCoord(op.y2) - headLen * Math.sin(angle + Math.PI / 6)
                  );
                  ctx.stroke();
                  break;

                default:
                  console.warn('Unknown vector op type:', op.type);
              }
            } catch (err) {
              console.warn('Failed to draw vector op:', op.type, err);
            }
          });
        }

        // ✅ COMPLIANCE UPDATE (ADVANCED): Draw scale bar if requested
        if (opts?.showScaleBar && opts?.scaleInfo?.pxPerMm) {
          const barLengthMm = 10; // 10mm scale bar
          const barLengthPx = barLengthMm * opts.scaleInfo.pxPerMm * dpiScale;
          const barX = targetWidth - barLengthPx - 20 * dpiScale;
          const barY = targetHeight - 30 * dpiScale;
          
          ctx.strokeStyle = '#FFFFFF';
          ctx.fillStyle = '#000000';
          ctx.lineWidth = 3 * dpiScale;
          
          // Draw bar background
          ctx.fillRect(barX - 5 * dpiScale, barY - 15 * dpiScale, barLengthPx + 10 * dpiScale, 25 * dpiScale);
          
          // Draw bar
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2 * dpiScale;
          ctx.beginPath();
          ctx.moveTo(barX, barY);
          ctx.lineTo(barX + barLengthPx, barY);
          ctx.stroke();
          
          // Draw ticks
          ctx.beginPath();
          ctx.moveTo(barX, barY - 5 * dpiScale);
          ctx.lineTo(barX, barY + 5 * dpiScale);
          ctx.moveTo(barX + barLengthPx, barY - 5 * dpiScale);
          ctx.lineTo(barX + barLengthPx, barY + 5 * dpiScale);
          ctx.stroke();
          
          // Draw label
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `${12 * dpiScale}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(`${barLengthMm} mm`, barX + barLengthPx / 2, barY - 8 * dpiScale);
        }

        // ✅ COMPLIANCE UPDATE (ADVANCED): Draw orientation tags if requested
        if (opts?.showOrientation && opts?.scaleInfo?.orientation) {
          const orientation = opts.scaleInfo.orientation;
          const fontSize = 16 * dpiScale;
          const padding = 10 * dpiScale;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Map orientation to positions
          const orientationMap: Record<string, { x: number; y: number; label: string }> = {
            'R': { x: targetWidth - padding - fontSize, y: targetHeight / 2, label: 'R' },
            'L': { x: padding + fontSize, y: targetHeight / 2, label: 'L' },
            'A': { x: targetWidth / 2, y: padding + fontSize, label: 'A' },
            'P': { x: targetWidth / 2, y: targetHeight - padding - fontSize, label: 'P' },
            'H': { x: targetWidth / 2, y: padding + fontSize, label: 'H' },
            'F': { x: targetWidth / 2, y: targetHeight - padding - fontSize, label: 'F' }
          };
          
          const pos = orientationMap[orientation];
          if (pos) {
            // Draw background circle
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, fontSize, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw letter
            ctx.fillStyle = '#000000';
            ctx.fillText(pos.label, pos.x, pos.y);
          }
        }

        // ✅ COMPLIANCE UPDATE (ADVANCED): Return as PNG or JPEG based on options
        const imageType = opts?.imageType || 'png';
        const quality = opts?.jpegQuality || 0.9;
        
        if (imageType === 'jpeg') {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(canvas.toDataURL('image/png'));
        }
      };

      baseImg.onerror = () => {
        reject(new Error('Failed to load base image'));
      };

      baseImg.src = basePngDataUrl;
    } catch (error) {
      reject(error);
    }
  });
}

// ✅ TEMPLATE FIX: Normalize template sections to default values
export function normalizeTemplateSections(schema: any): Record<string, any> {
  if (!schema || !schema.sections) return {};
  
  const normalized: Record<string, any> = {};
  
  schema.sections.forEach((section: any) => {
    const sectionId = section.id;
    const fieldType = section.type || 'textarea';
    
    // Set default value based on field type
    switch (fieldType) {
      case 'textarea':
      case 'text':
        normalized[sectionId] = section.defaultValue || '';
        break;
      case 'list':
      case 'multiselect':
        normalized[sectionId] = section.defaultValue || [];
        break;
      case 'checkbox':
        normalized[sectionId] = section.defaultValue || false;
        break;
      case 'select':
        normalized[sectionId] = section.defaultValue || '';
        break;
      case 'structured':
        // For structured fields, create nested object with field defaults
        if (section.fields && Array.isArray(section.fields)) {
          const structuredDefaults: Record<string, any> = {};
          section.fields.forEach((field: any) => {
            structuredDefaults[field.id] = field.defaultValue || '';
          });
          normalized[sectionId] = structuredDefaults;
        } else {
          normalized[sectionId] = {};
        }
        break;
      default:
        normalized[sectionId] = section.defaultValue || '';
    }
  });
  
  return normalized;
}

// ✅ TEMPLATE FIX: Map AI detections to template sections
export function mapAIDetectionsToTemplate(
  aiDetections: any[],
  templateSchema: any
): {
  reportSectionsPatch: Record<string, any>;
  suggestions: string[];
} {
  const reportSectionsPatch: Record<string, any> = {};
  const suggestions: string[] = [];
  
  if (!aiDetections || !templateSchema || !templateSchema.sections) {
    return { reportSectionsPatch, suggestions };
  }
  
  // Build a map of section IDs to section configs
  const sectionMap = new Map();
  templateSchema.sections.forEach((section: any) => {
    sectionMap.set(section.id, section);
  });
  
  // Process each AI detection
  aiDetections.forEach((detection: any) => {
    const confidence = detection.confidence || 0;
    const detectionType = (detection.type || '').toLowerCase();
    const description = detection.description || '';
    
    // Route detection to appropriate section based on type
    let targetSectionId: string | null = null;
    let targetFieldId: string | null = null;
    
    // Example routing logic (customize based on your template structure)
    if (detectionType.includes('lung') || detectionType.includes('chest')) {
      targetSectionId = 'lungs';
    } else if (detectionType.includes('heart') || detectionType.includes('cardiac')) {
      targetSectionId = 'heart';
    } else if (detectionType.includes('brain') || detectionType.includes('head')) {
      targetSectionId = 'brain';
    } else {
      // Default to findings section
      targetSectionId = 'findings';
    }
    
    const section = sectionMap.get(targetSectionId);
    
    if (!section) {
      // Section not found, add to suggestions
      suggestions.push(`AI detected: ${description} (confidence: ${(confidence * 100).toFixed(1)}%)`);
      return;
    }
    
    // Auto-fill if confidence >= 0.8, otherwise suggest
    if (confidence >= 0.8) {
      const fieldType = section.type || 'textarea';
      
      switch (fieldType) {
        case 'textarea':
        case 'text':
          // Append to existing text
          const existingText = reportSectionsPatch[targetSectionId] || '';
          reportSectionsPatch[targetSectionId] = existingText 
            ? `${existingText}\n${description}`
            : description;
          break;
          
        case 'multiselect':
        case 'list':
          // Add to array
          const existingArray = reportSectionsPatch[targetSectionId] || [];
          if (!existingArray.includes(detectionType)) {
            reportSectionsPatch[targetSectionId] = [...existingArray, detectionType];
          }
          break;
          
        case 'select':
          // Set single value
          reportSectionsPatch[targetSectionId] = detectionType;
          break;
          
        case 'checkbox':
          // Set to true if detection present
          reportSectionsPatch[targetSectionId] = true;
          break;
          
        default:
          // Add to suggestions if unknown type
          suggestions.push(`AI detected: ${description} (confidence: ${(confidence * 100).toFixed(1)}%)`);
      }
    } else {
      // Low confidence, add to suggestions
      suggestions.push(`AI detected: ${description} (confidence: ${(confidence * 100).toFixed(1)}%)`);
    }
  });
  
  return { reportSectionsPatch, suggestions };
}

/**
 * Export utilities
 */
export const ReportingUtils = {
  telemetryEmit,
  reportError,
  toast,
  toastError,
  expandMacros,
  ensureUniqueFindingIds,
  hasCriticalFindings,
  mapApiError,
  debounce,
  throttle,
  formatReportStatus,
  canEditReport,
  canFinalizeReport,
  canSignReport,
  canAddAddendum,
  validateReportContent,
  calculateSLAMetrics,
  composeImageWithAnnotations, // ✅ COMPLIANCE UPDATE: Export new function
  normalizeTemplateSections, // ✅ TEMPLATE FIX: Export new function
  mapAIDetectionsToTemplate, // ✅ TEMPLATE FIX: Export new function
};

export default ReportingUtils;
