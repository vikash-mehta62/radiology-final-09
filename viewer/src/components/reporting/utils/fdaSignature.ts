/**
 * FDA 21 CFR Part 11 Compliant Digital Signatures
 * 
 * Requirements:
 * - Unique to one individual
 * - Cannot be reused or reassigned
 * - Linked to timestamp
 * - Audit trail
 * - Signature manifestation (printed name, date, meaning)
 */

interface FDASignature {
  signatureId: string
  userId: string
  userName: string
  userRole: string
  signatureDataUrl: string // Visual signature
  timestamp: Date
  meaning: 'authored' | 'reviewed' | 'approved' | 'verified'
  reportId: string
  reportVersion: number
  ipAddress: string
  deviceInfo: string
  biometricHash?: string // Optional: for enhanced security
  certificateId?: string // Optional: for PKI
}

interface SignatureAuditLog {
  signatureId: string
  action: 'created' | 'verified' | 'invalidated'
  timestamp: Date
  userId: string
  reason?: string
  ipAddress: string
}

/**
 * Create FDA-compliant signature
 * ✅ COMPLIANCE UPDATE: Enhanced with reason parameter for addenda
 */
export async function createFDASignature(
  signatureDataUrl: string,
  userId: string,
  userName: string,
  userRole: string,
  reportId: string,
  reportVersion: number,
  meaning: 'authored' | 'reviewed' | 'approved' | 'verified',
  reason?: string
): Promise<FDASignature> {
  // Get device and network info
  const deviceInfo = getDeviceInfo()
  const ipAddress = await getIPAddress()

  // Generate unique signature ID
  const signatureId = generateSignatureId(userId, reportId, Date.now())

  // Create signature object
  const signature: FDASignature = {
    signatureId,
    userId,
    userName,
    userRole,
    signatureDataUrl,
    timestamp: new Date(),
    meaning,
    reportId,
    reportVersion,
    ipAddress,
    deviceInfo
  }

  // Optional: Generate biometric hash (for enhanced security)
  if (signatureDataUrl) {
    signature.biometricHash = await generateBiometricHash(signatureDataUrl)
  }

  // Log signature creation
  await logSignatureAction(signature, 'created', reason)

  // Store signature in backend
  await storeSignature(signature)

  return signature
}

/**
 * Verify signature authenticity
 */
export async function verifySignature(
  signatureId: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const response = await fetch(`/api/signatures/verify/${signatureId}`)
    const data = await response.json()

    if (!data.signature) {
      return { valid: false, reason: 'Signature not found' }
    }

    const signature: FDASignature = data.signature

    // Verify signature hasn't been tampered with
    if (signature.biometricHash) {
      const currentHash = await generateBiometricHash(signature.signatureDataUrl)
      if (currentHash !== signature.biometricHash) {
        return { valid: false, reason: 'Signature has been modified' }
      }
    }

    // Verify timestamp is reasonable
    const signatureAge = Date.now() - new Date(signature.timestamp).getTime()
    if (signatureAge < 0) {
      return { valid: false, reason: 'Invalid timestamp (future date)' }
    }

    // Verify user still has signing authority
    const userValid = await verifyUserAuthority(signature.userId, signature.userRole)
    if (!userValid) {
      return { valid: false, reason: 'User no longer has signing authority' }
    }

    await logSignatureAction(signature, 'verified')

    return { valid: true }
  } catch (error) {
    return { valid: false, reason: 'Verification failed' }
  }
}

/**
 * Generate signature manifestation (for printed reports)
 */
export function generateSignatureManifestation(signature: FDASignature): string {
  const meaningText = {
    authored: 'Authored by',
    reviewed: 'Reviewed by',
    approved: 'Approved by',
    verified: 'Verified by'
  }

  return `
    ${meaningText[signature.meaning]}: ${signature.userName}, ${signature.userRole}
    Date/Time: ${signature.timestamp.toLocaleString()}
    Signature ID: ${signature.signatureId}
    
    This report has been electronically signed in accordance with 
    FDA 21 CFR Part 11 requirements for electronic signatures.
  `
}

/**
 * Invalidate signature (if report is modified)
 */
export async function invalidateSignature(
  signatureId: string,
  reason: string,
  userId: string
): Promise<void> {
  const response = await fetch(`/api/signatures/${signatureId}`, {
    method: 'GET'
  })
  const data = await response.json()
  const signature: FDASignature = data.signature

  await logSignatureAction(signature, 'invalidated', reason)

  await fetch(`/api/signatures/${signatureId}/invalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, userId })
  })
}

/**
 * Generate unique signature ID
 */
function generateSignatureId(userId: string, reportId: string, timestamp: number): string {
  const hash = btoa(`${userId}-${reportId}-${timestamp}`)
  return `SIG-${hash.substr(0, 16)}-${timestamp}`
}

/**
 * Generate biometric hash from signature image
 */
async function generateBiometricHash(signatureDataUrl: string): Promise<string> {
  // Simple hash for now - in production use proper cryptographic hash
  const encoder = new TextEncoder()
  const data = encoder.encode(signatureDataUrl)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get device information
 */
function getDeviceInfo(): string {
  return `${navigator.userAgent} | ${navigator.platform} | ${screen.width}x${screen.height}`
}

/**
 * Get IP address
 */
async function getIPAddress(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch {
    return 'Unknown'
  }
}

/**
 * Log signature action
 */
async function logSignatureAction(
  signature: FDASignature,
  action: 'created' | 'verified' | 'invalidated',
  reason?: string
): Promise<void> {
  const log: SignatureAuditLog = {
    signatureId: signature.signatureId,
    action,
    timestamp: new Date(),
    userId: signature.userId,
    reason,
    ipAddress: signature.ipAddress
  }

  await fetch('/api/signatures/audit-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log)
  })
}

/**
 * Store signature in backend
 */
async function storeSignature(signature: FDASignature): Promise<void> {
  await fetch('/api/signatures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signature)
  })
}

/**
 * Verify user has signing authority
 */
async function verifyUserAuthority(userId: string, role: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/users/${userId}/authority`)
    const data = await response.json()
    return data.hasAuthority && data.role === role
  } catch {
    return false
  }
}

// ✅ COMPLIANCE UPDATE: Helper to get frozen fields for export hash consistency
/**
 * Get frozen fields from payload for hash-like export
 * Returns only the fields used for signing hash to ensure consistency
 */
export function getFrozenFieldsForHashLikeExport(frozenPayload: any): any {
  if (!frozenPayload) return {};
  
  return {
    technique: frozenPayload.technique,
    findingsText: frozenPayload.findingsText,
    impression: frozenPayload.impression,
    sections: frozenPayload.sections,
    measurements: frozenPayload.measurements,
    findings: frozenPayload.findings,
    templateId: frozenPayload.templateId,
    templateVersion: frozenPayload.templateVersion
  };
}

// ✅ COMPLIANCE UPDATE (ADVANCED): Helper to select hash fields for display in exports
/**
 * Select hash fields for display in export JSON
 * Shows which fields are included in the content hash for signature verification
 */
export function selectHashFieldsForDisplay(frozen: any): any {
  if (!frozen) return {};
  
  return {
    _hashScope: 'These fields are included in the signature content hash',
    technique: frozen.technique || '',
    findingsText: frozen.findingsText || '',
    impression: frozen.impression || '',
    sections: frozen.sections || {},
    measurements: frozen.measurements || [],
    findings: frozen.findings || [],
    templateId: frozen.templateId || '',
    templateVersion: frozen.templateVersion || '1.0'
  };
}
