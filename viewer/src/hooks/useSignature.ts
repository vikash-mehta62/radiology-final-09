import { useState, useCallback } from 'react'
import axios from 'axios'

export interface DigitalSignature {
  id: string
  reportId: string
  signerId: string
  signerName: string
  signerRole: string
  signatureHash: string
  algorithm: 'RSA-SHA256'
  keySize: 2048
  timestamp: string
  meaning: 'author' | 'reviewer' | 'approver'
  status: 'valid' | 'invalid' | 'revoked'
  revocationReason?: string
  revokedBy?: string
  revokedAt?: string
  metadata: {
    ipAddress: string
    userAgent: string
    location?: string
  }
  auditTrail: SignatureAuditEvent[]
}

export interface SignatureAuditEvent {
  action: 'created' | 'verified' | 'revoked' | 'validation_failed'
  userId: string
  userName?: string
  timestamp: string
  ipAddress: string
  result: 'success' | 'failure'
  details: string
}

export interface SignatureVerificationResult {
  valid: boolean
  signature: DigitalSignature
  reportHash: string
  verifiedAt: string
  errors?: string[]
}

export interface UseSignatureReturn {
  signature: DigitalSignature | null
  verificationResult: SignatureVerificationResult | null
  loading: boolean
  error: string | null
  signReport: (reportId: string, meaning: 'author' | 'reviewer' | 'approver', password: string) => Promise<DigitalSignature>
  verifySignature: (signatureId: string) => Promise<SignatureVerificationResult>
  revokeSignature: (signatureId: string, reason: string, password: string) => Promise<void>
  getAuditTrail: (reportId: string, signatureId?: string) => Promise<SignatureAuditEvent[]>
  clearError: () => void
}

export const useSignature = (): UseSignatureReturn => {
  const [signature, setSignature] = useState<DigitalSignature | null>(null)
  const [verificationResult, setVerificationResult] = useState<SignatureVerificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signReport = useCallback(async (
    reportId: string,
    meaning: 'author' | 'reviewer' | 'approver',
    password: string
  ): Promise<DigitalSignature> => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.post('/api/signatures/sign', {
        reportId,
        meaning,
        password
      })

      const newSignature = response.data.data || response.data
      setSignature(newSignature)
      return newSignature
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to sign report'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const verifySignature = useCallback(async (
    signatureId: string
  ): Promise<SignatureVerificationResult> => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(`/api/signatures/verify/${signatureId}`)

      const result = response.data.data || response.data
      setVerificationResult(result)
      return result
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to verify signature'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const revokeSignature = useCallback(async (
    signatureId: string,
    reason: string,
    password: string
  ): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      await axios.post(`/api/signatures/revoke/${signatureId}`, {
        reason,
        password
      })

      // Update local signature state if it matches
      if (signature && signature.id === signatureId) {
        setSignature({
          ...signature,
          status: 'revoked',
          revocationReason: reason,
          revokedAt: new Date().toISOString()
        })
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to revoke signature'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [signature])

  const getAuditTrail = useCallback(async (
    reportId: string,
    signatureId?: string
  ): Promise<SignatureAuditEvent[]> => {
    setLoading(true)
    setError(null)

    try {
      const url = signatureId
        ? `/api/signatures/audit-trail/${reportId}?signatureId=${signatureId}`
        : `/api/signatures/audit-trail/${reportId}`

      const response = await axios.get(url)

      return response.data.data || response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch audit trail'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    signature,
    verificationResult,
    loading,
    error,
    signReport,
    verifySignature,
    revokeSignature,
    getAuditTrail,
    clearError
  }
}
