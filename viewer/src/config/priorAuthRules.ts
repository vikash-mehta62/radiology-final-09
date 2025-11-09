/**
 * Prior Authorization Rules Configuration
 * Defines which insurance plans and procedures require prior authorization
 */

export interface InsurancePlan {
  name: string
  requiresPriorAuth: boolean
  planTypes: {
    type: string
    requiresPriorAuth: boolean
    exemptProcedures?: string[] // CPT codes that don't need auth
  }[]
  autoApprovalCriteria?: {
    urgencyLevels?: string[] // Auto-approve for these urgency levels
    maxCost?: number
    specificProcedures?: string[] // CPT codes that auto-approve
  }
}

export interface ProcedureRule {
  cptCode: string
  description: string
  modality: string
  alwaysRequiresPriorAuth: boolean
  costEstimate: number
  typicalDiagnoses: string[] // ICD-10 codes
  urgencyExemptions?: string[] // Urgency levels that don't need auth
}

// Insurance Plans Configuration
export const INSURANCE_PLANS: InsurancePlan[] = [
  {
    name: 'Medicare',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'Medicare Part B',
        requiresPriorAuth: true,
        exemptProcedures: ['70450', '71010', '73000'] // Basic X-rays
      },
      {
        type: 'Medicare Advantage',
        requiresPriorAuth: true,
        exemptProcedures: []
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 500,
      specificProcedures: ['70450'] // CT Head
    }
  },
  {
    name: 'Blue Cross Blue Shield',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'PPO',
        requiresPriorAuth: true,
        exemptProcedures: ['70450', '71010', '73000', '73610']
      },
      {
        type: 'HMO',
        requiresPriorAuth: true,
        exemptProcedures: ['71010', '73000']
      },
      {
        type: 'EPO',
        requiresPriorAuth: true,
        exemptProcedures: ['71010']
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 1000
    }
  },
  {
    name: 'Aetna',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'PPO',
        requiresPriorAuth: true,
        exemptProcedures: ['70450', '71010', '73000']
      },
      {
        type: 'HMO',
        requiresPriorAuth: true,
        exemptProcedures: ['71010']
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 800
    }
  },
  {
    name: 'UnitedHealthcare',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'PPO',
        requiresPriorAuth: true,
        exemptProcedures: ['70450', '71010', '73000', '73610']
      },
      {
        type: 'HMO',
        requiresPriorAuth: true,
        exemptProcedures: ['71010', '73000']
      },
      {
        type: 'POS',
        requiresPriorAuth: true,
        exemptProcedures: ['71010']
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 1000
    }
  },
  {
    name: 'Cigna',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'PPO',
        requiresPriorAuth: true,
        exemptProcedures: ['70450', '71010', '73000']
      },
      {
        type: 'HMO',
        requiresPriorAuth: true,
        exemptProcedures: ['71010']
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 750
    }
  },
  {
    name: 'Humana',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'PPO',
        requiresPriorAuth: true,
        exemptProcedures: ['70450', '71010', '73000']
      },
      {
        type: 'HMO',
        requiresPriorAuth: true,
        exemptProcedures: ['71010']
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 800
    }
  },
  {
    name: 'Kaiser Permanente',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'HMO',
        requiresPriorAuth: true,
        exemptProcedures: ['71010', '73000']
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 600
    }
  },
  {
    name: 'Medicaid',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'Standard',
        requiresPriorAuth: true,
        exemptProcedures: ['71010', '73000']
      },
      {
        type: 'Managed Care',
        requiresPriorAuth: true,
        exemptProcedures: ['71010']
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 400
    }
  },
  {
    name: 'Tricare',
    requiresPriorAuth: true,
    planTypes: [
      {
        type: 'Prime',
        requiresPriorAuth: true,
        exemptProcedures: ['70450', '71010', '73000']
      },
      {
        type: 'Select',
        requiresPriorAuth: true,
        exemptProcedures: ['71010', '73000']
      }
    ],
    autoApprovalCriteria: {
      urgencyLevels: ['stat', 'emergency'],
      maxCost: 1000
    }
  }
]

// Procedure Rules Configuration
export const PROCEDURE_RULES: ProcedureRule[] = [
  // CT Scans
  {
    cptCode: '70450',
    description: 'CT Head/Brain without contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: false, // Common procedure
    costEstimate: 800,
    typicalDiagnoses: ['G43.909', 'R51.9', 'S06.0X0A'],
    urgencyExemptions: ['stat', 'emergency']
  },
  {
    cptCode: '70460',
    description: 'CT Head/Brain with contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1200,
    typicalDiagnoses: ['C71.9', 'G93.89', 'I63.9']
  },
  {
    cptCode: '70470',
    description: 'CT Head/Brain without and with contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1500,
    typicalDiagnoses: ['C71.9', 'G93.89']
  },
  {
    cptCode: '71250',
    description: 'CT Chest without contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 900,
    typicalDiagnoses: ['J18.9', 'R05', 'C34.90'],
    urgencyExemptions: ['stat', 'emergency']
  },
  {
    cptCode: '71260',
    description: 'CT Chest with contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1300,
    typicalDiagnoses: ['C34.90', 'I26.99', 'J18.9']
  },
  {
    cptCode: '71270',
    description: 'CT Chest without and with contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1600,
    typicalDiagnoses: ['C34.90', 'D38.1']
  },
  {
    cptCode: '72125',
    description: 'CT Cervical Spine without contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 850,
    typicalDiagnoses: ['M54.2', 'S13.4XXA'],
    urgencyExemptions: ['stat', 'emergency']
  },
  {
    cptCode: '72192',
    description: 'CT Pelvis without contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 900,
    typicalDiagnoses: ['R10.9', 'N13.30']
  },
  {
    cptCode: '74150',
    description: 'CT Abdomen without contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 900,
    typicalDiagnoses: ['R10.9', 'K80.20'],
    urgencyExemptions: ['stat', 'emergency']
  },
  {
    cptCode: '74160',
    description: 'CT Abdomen with contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1300,
    typicalDiagnoses: ['C18.9', 'K80.20']
  },
  {
    cptCode: '74170',
    description: 'CT Abdomen without and with contrast',
    modality: 'CT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1600,
    typicalDiagnoses: ['C18.9', 'C25.9']
  },
  // MRI Scans
  {
    cptCode: '70551',
    description: 'MRI Brain without contrast',
    modality: 'MR',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1500,
    typicalDiagnoses: ['G43.909', 'G40.909', 'C71.9']
  },
  {
    cptCode: '70552',
    description: 'MRI Brain with contrast',
    modality: 'MR',
    alwaysRequiresPriorAuth: true,
    costEstimate: 2000,
    typicalDiagnoses: ['C71.9', 'G93.89']
  },
  {
    cptCode: '70553',
    description: 'MRI Brain without and with contrast',
    modality: 'MR',
    alwaysRequiresPriorAuth: true,
    costEstimate: 2500,
    typicalDiagnoses: ['C71.9', 'G93.89']
  },
  {
    cptCode: '72141',
    description: 'MRI Cervical Spine without contrast',
    modality: 'MR',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1600,
    typicalDiagnoses: ['M54.2', 'M50.20']
  },
  {
    cptCode: '72148',
    description: 'MRI Lumbar Spine without contrast',
    modality: 'MR',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1600,
    typicalDiagnoses: ['M54.5', 'M51.26']
  },
  {
    cptCode: '73221',
    description: 'MRI Joint of upper extremity without contrast',
    modality: 'MR',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1400,
    typicalDiagnoses: ['M25.561', 'S43.006A']
  },
  {
    cptCode: '73721',
    description: 'MRI Joint of lower extremity without contrast',
    modality: 'MR',
    alwaysRequiresPriorAuth: true,
    costEstimate: 1400,
    typicalDiagnoses: ['M25.561', 'S83.206A']
  },
  // X-Rays (Usually don't require prior auth)
  {
    cptCode: '71010',
    description: 'Chest X-ray, single view',
    modality: 'XR',
    alwaysRequiresPriorAuth: false,
    costEstimate: 100,
    typicalDiagnoses: ['J18.9', 'R05', 'R06.02']
  },
  {
    cptCode: '71020',
    description: 'Chest X-ray, 2 views',
    modality: 'XR',
    alwaysRequiresPriorAuth: false,
    costEstimate: 150,
    typicalDiagnoses: ['J18.9', 'R05', 'R06.02']
  },
  {
    cptCode: '73000',
    description: 'Clavicle X-ray',
    modality: 'XR',
    alwaysRequiresPriorAuth: false,
    costEstimate: 120,
    typicalDiagnoses: ['S42.009A', 'M25.511']
  },
  {
    cptCode: '73610',
    description: 'Ankle X-ray',
    modality: 'XR',
    alwaysRequiresPriorAuth: false,
    costEstimate: 120,
    typicalDiagnoses: ['S93.409A', 'M25.571']
  },
  // PET Scans
  {
    cptCode: '78811',
    description: 'PET imaging whole body',
    modality: 'PT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 3000,
    typicalDiagnoses: ['C80.1', 'C34.90']
  },
  {
    cptCode: '78812',
    description: 'PET imaging skull base to mid-thigh',
    modality: 'PT',
    alwaysRequiresPriorAuth: true,
    costEstimate: 2800,
    typicalDiagnoses: ['C80.1', 'C34.90']
  },
  // Nuclear Medicine
  {
    cptCode: '78306',
    description: 'Bone scan whole body',
    modality: 'NM',
    alwaysRequiresPriorAuth: true,
    costEstimate: 800,
    typicalDiagnoses: ['C79.51', 'M25.50']
  },
  // Ultrasound (Usually don't require prior auth)
  {
    cptCode: '76700',
    description: 'Ultrasound Abdomen complete',
    modality: 'US',
    alwaysRequiresPriorAuth: false,
    costEstimate: 300,
    typicalDiagnoses: ['R10.9', 'K80.20']
  },
  {
    cptCode: '76770',
    description: 'Ultrasound Retroperitoneal complete',
    modality: 'US',
    alwaysRequiresPriorAuth: false,
    costEstimate: 350,
    typicalDiagnoses: ['N13.30', 'N20.0']
  }
]

/**
 * Check if a procedure requires prior authorization
 */
export const checkPriorAuthRequired = (
  insurancePlan: string,
  planType: string,
  cptCode: string,
  urgency: string
): {
  required: boolean
  reason: string
  autoApprovalEligible: boolean
  estimatedCost?: number
} => {
  // Find insurance plan
  const insurance = INSURANCE_PLANS.find(p => 
    p.name.toLowerCase() === insurancePlan.toLowerCase()
  )
  
  // Find procedure
  const procedure = PROCEDURE_RULES.find(p => p.cptCode === cptCode)
  
  // Default response
  if (!insurance || !procedure) {
    return {
      required: true,
      reason: 'Insurance plan or procedure not found in database',
      autoApprovalEligible: false
    }
  }
  
  // Check if procedure always requires auth
  if (procedure.alwaysRequiresPriorAuth) {
    // Check urgency exemptions
    if (procedure.urgencyExemptions?.includes(urgency)) {
      return {
        required: false,
        reason: `${urgency.toUpperCase()} procedures are exempt from prior authorization`,
        autoApprovalEligible: true,
        estimatedCost: procedure.costEstimate
      }
    }
    
    // Check auto-approval criteria
    const autoApproval = insurance.autoApprovalCriteria
    if (autoApproval) {
      if (autoApproval.urgencyLevels?.includes(urgency)) {
        return {
          required: true,
          reason: 'Prior authorization required but eligible for auto-approval',
          autoApprovalEligible: true,
          estimatedCost: procedure.costEstimate
        }
      }
      
      if (autoApproval.maxCost && procedure.costEstimate <= autoApproval.maxCost) {
        return {
          required: true,
          reason: 'Prior authorization required but eligible for auto-approval (cost threshold)',
          autoApprovalEligible: true,
          estimatedCost: procedure.costEstimate
        }
      }
      
      if (autoApproval.specificProcedures?.includes(cptCode)) {
        return {
          required: true,
          reason: 'Prior authorization required but eligible for auto-approval (specific procedure)',
          autoApprovalEligible: true,
          estimatedCost: procedure.costEstimate
        }
      }
    }
    
    return {
      required: true,
      reason: `${procedure.description} requires prior authorization for ${insurance.name}`,
      autoApprovalEligible: false,
      estimatedCost: procedure.costEstimate
    }
  }
  
  // Check plan-specific exemptions
  const plan = insurance.planTypes.find(pt => 
    pt.type.toLowerCase() === planType.toLowerCase()
  )
  
  if (plan && plan.exemptProcedures?.includes(cptCode)) {
    return {
      required: false,
      reason: `${procedure.description} is exempt from prior authorization for ${insurance.name} ${plan.type}`,
      autoApprovalEligible: true,
      estimatedCost: procedure.costEstimate
    }
  }
  
  // Default: check if insurance requires prior auth
  if (insurance.requiresPriorAuth) {
    return {
      required: true,
      reason: `${insurance.name} requires prior authorization for this procedure`,
      autoApprovalEligible: false,
      estimatedCost: procedure.costEstimate
    }
  }
  
  return {
    required: false,
    reason: 'Prior authorization not required',
    autoApprovalEligible: true,
    estimatedCost: procedure.costEstimate
  }
}

/**
 * Get all insurance plans
 */
export const getInsurancePlans = (): string[] => {
  return INSURANCE_PLANS.map(p => p.name)
}

/**
 * Get plan types for an insurance
 */
export const getPlanTypes = (insuranceName: string): string[] => {
  const insurance = INSURANCE_PLANS.find(p => 
    p.name.toLowerCase() === insuranceName.toLowerCase()
  )
  return insurance ? insurance.planTypes.map(pt => pt.type) : []
}

/**
 * Get procedure info by CPT code
 */
export const getProcedureInfo = (cptCode: string): ProcedureRule | undefined => {
  return PROCEDURE_RULES.find(p => p.cptCode === cptCode)
}

/**
 * Search procedures by modality
 */
export const getProceduresByModality = (modality: string): ProcedureRule[] => {
  return PROCEDURE_RULES.filter(p => p.modality === modality)
}
