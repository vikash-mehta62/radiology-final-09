/**
 * Embedded Anatomical Diagram Library
 * Professional medical diagrams embedded directly in code
 */

export const ANATOMICAL_DIAGRAMS: Record<string, Record<string, string>> = {
  // HEAD/BRAIN DIAGRAMS
  'headbrain': {
    'axial': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.brain{fill:#f5e6d3;stroke:#333;stroke-width:2}.ventricle{fill:#b3d9ff;stroke:#666;stroke-width:1}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <ellipse cx="200" cy="250" rx="150" ry="140" class="brain"/>
      <path d="M 200 250 Q 180 230 160 250 Q 180 270 200 250 Z" class="ventricle"/>
      <path d="M 200 250 Q 220 230 240 250 Q 220 270 200 250 Z" class="ventricle"/>
      <text x="200" y="150" class="label" text-anchor="middle">Frontal Lobe</text>
      <text x="200" y="350" class="label" text-anchor="middle">Occipital Lobe</text>
      <text x="100" y="250" class="label" text-anchor="middle">Left</text>
      <text x="300" y="250" class="label" text-anchor="middle">Right</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Brain - Axial Section</text>
    </svg>`,
    
    'sagittal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.brain{fill:#f5e6d3;stroke:#333;stroke-width:2}.structure{fill:#e6d3c1;stroke:#666;stroke-width:1}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <path d="M 100 150 Q 150 100 250 120 Q 320 140 330 200 Q 335 280 300 350 Q 250 400 180 390 Q 120 380 100 320 Q 85 250 100 150 Z" class="brain"/>
      <ellipse cx="200" cy="280" rx="30" ry="25" class="structure"/>
      <path d="M 180 200 Q 200 180 220 200 L 220 350 Q 200 370 180 350 Z" class="structure"/>
      <text x="200" y="150" class="label" text-anchor="middle">Frontal</text>
      <text x="280" y="350" class="label" text-anchor="middle">Cerebellum</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Brain - Sagittal Section</text>
    </svg>`,
    
    'coronal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.brain{fill:#f5e6d3;stroke:#333;stroke-width:2}.ventricle{fill:#b3d9ff;stroke:#666;stroke-width:1}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <path d="M 80 200 Q 80 120 150 100 Q 200 95 250 100 Q 320 120 320 200 L 320 320 Q 300 380 200 390 Q 100 380 80 320 Z" class="brain"/>
      <rect x="160" y="220" width="80" height="100" class="ventricle" rx="10"/>
      <text x="200" y="150" class="label" text-anchor="middle">Cortex</text>
      <text x="200" y="270" class="label" text-anchor="middle">Ventricle</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Brain - Coronal Section</text>
    </svg>`
  },
  
  // CHEST DIAGRAMS
  'chest': {
    'frontal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.bone{fill:#e8e8e8;stroke:#999;stroke-width:1.5}.organ{fill:#f0f0f0;stroke:#666;stroke-width:1.5}.heart{fill:#ffcccc;stroke:#cc6666;stroke-width:1.5}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <ellipse cx="200" cy="220" rx="130" ry="160" class="bone"/>
      <ellipse cx="140" cy="200" rx="65" ry="110" class="organ"/>
      <ellipse cx="260" cy="200" rx="65" ry="110" class="organ"/>
      <path d="M 170 240 Q 200 220 230 240 Q 240 260 200 290 Q 160 260 170 240" class="heart"/>
      <rect x="195" y="80" width="10" height="100" class="organ"/>
      <path d="M 110 140 Q 90 170 100 200" class="bone" fill="none"/>
      <path d="M 290 140 Q 310 170 300 200" class="bone" fill="none"/>
      <text x="140" y="180" class="label" text-anchor="middle">Right Lung</text>
      <text x="260" y="180" class="label" text-anchor="middle">Left Lung</text>
      <text x="200" y="260" class="label" text-anchor="middle">Heart</text>
      <text x="200" y="70" class="label" text-anchor="middle">Trachea</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Chest - Frontal (PA) View</text>
    </svg>`,
    
    'lateral': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.bone{fill:#e8e8e8;stroke:#999;stroke-width:1.5}.organ{fill:#f0f0f0;stroke:#666;stroke-width:1.5}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <path d="M 120 120 Q 100 200 120 300 L 280 300 Q 300 200 280 120 Z" class="bone"/>
      <ellipse cx="200" cy="210" rx="80" ry="90" class="organ"/>
      <path d="M 150 150 Q 140 200 150 250" class="bone" fill="none"/>
      <path d="M 180 150 Q 170 200 180 250" class="bone" fill="none"/>
      <text x="200" y="210" class="label" text-anchor="middle">Lung</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Chest - Lateral View</text>
      <text x="100" y="250" class="label">Anterior</text>
      <text x="300" y="250" class="label">Posterior</text>
    </svg>`,
    
    'axial': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.bone{fill:#e8e8e8;stroke:#999;stroke-width:1.5}.organ{fill:#f0f0f0;stroke:#666;stroke-width:1.5}.spine{fill:#d0d0d0;stroke:#666;stroke-width:1.5}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <ellipse cx="200" cy="250" rx="150" ry="120" class="bone"/>
      <ellipse cx="150" cy="240" rx="50" ry="60" class="organ"/>
      <ellipse cx="250" cy="240" rx="50" ry="60" class="organ"/>
      <circle cx="200" cy="320" r="25" class="spine"/>
      <text x="150" y="240" class="label" text-anchor="middle">R Lung</text>
      <text x="250" y="240" class="label" text-anchor="middle">L Lung</text>
      <text x="200" y="325" class="label" text-anchor="middle" font-size="9">Spine</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Chest - Axial Section</text>
    </svg>`
  },
  
  // ABDOMEN DIAGRAMS
  'abdomen': {
    'frontal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.outline{fill:#f5f5f5;stroke:#666;stroke-width:2}.organ{fill:#e6d3c1;stroke:#999;stroke-width:1}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <path d="M 120 100 L 280 100 L 300 400 L 100 400 Z" class="outline"/>
      <ellipse cx="180" cy="180" rx="40" ry="50" class="organ"/>
      <ellipse cx="220" cy="200" rx="35" ry="45" class="organ"/>
      <path d="M 140 280 Q 200 260 260 280 Q 240 340 200 350 Q 160 340 140 280" class="organ"/>
      <text x="180" y="185" class="label" text-anchor="middle">Liver</text>
      <text x="220" y="205" class="label" text-anchor="middle">Stomach</text>
      <text x="200" y="310" class="label" text-anchor="middle">Intestines</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Abdomen - Frontal View</text>
    </svg>`,
    
    'quadrants': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.outline{fill:none;stroke:#666;stroke-width:2}.divider{stroke:#999;stroke-width:1;stroke-dasharray:5,5}.label{font-family:Arial;font-size:12px;fill:#333;font-weight:bold}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <rect x="100" y="150" width="200" height="200" class="outline"/>
      <line x1="200" y1="150" x2="200" y2="350" class="divider"/>
      <line x1="100" y1="250" x2="300" y2="250" class="divider"/>
      <text x="150" y="210" class="label" text-anchor="middle">RUQ</text>
      <text x="250" y="210" class="label" text-anchor="middle">LUQ</text>
      <text x="150" y="310" class="label" text-anchor="middle">RLQ</text>
      <text x="250" y="310" class="label" text-anchor="middle">LLQ</text>
      <text x="150" y="230" class="label" text-anchor="middle" font-size="9">Right Upper</text>
      <text x="250" y="230" class="label" text-anchor="middle" font-size="9">Left Upper</text>
      <text x="150" y="330" class="label" text-anchor="middle" font-size="9">Right Lower</text>
      <text x="250" y="330" class="label" text-anchor="middle" font-size="9">Left Lower</text>
      <text x="200" y="30" class="label" text-anchor="middle">Abdominal Quadrants</text>
    </svg>`
  },
  
  // SPINE DIAGRAMS
  'spine': {
    'frontal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.vertebra{fill:#e8e8e8;stroke:#666;stroke-width:1.5}.label{font-family:Arial;font-size:10px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <g transform="translate(200, 80)">
        ${Array.from({length: 24}, (_, i) => {
          const y = i * 16;
          const width = 30 + Math.sin(i * 0.3) * 5;
          return `<rect x="${-width/2}" y="${y}" width="${width}" height="14" class="vertebra" rx="2"/>`;
        }).join('')}
      </g>
      <text x="150" y="120" class="label">Cervical</text>
      <text x="150" y="220" class="label">Thoracic</text>
      <text x="150" y="340" class="label">Lumbar</text>
      <text x="150" y="420" class="label">Sacral</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Spine - Frontal (AP) View</text>
    </svg>`,
    
    'lateral': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.vertebra{fill:#e8e8e8;stroke:#666;stroke-width:1.5}.label{font-family:Arial;font-size:10px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <path d="M 200 80 Q 180 150 190 220 Q 200 290 210 360 Q 220 420 200 460" fill="none" stroke="#999" stroke-width="3"/>
      ${Array.from({length: 24}, (_, i) => {
        const y = 80 + i * 16;
        const x = 200 + Math.sin(i * 0.3) * 15;
        return `<ellipse cx="${x}" cy="${y}" rx="12" ry="7" class="vertebra"/>`;
      }).join('')}
      <text x="250" y="120" class="label">Cervical</text>
      <text x="250" y="220" class="label">Thoracic</text>
      <text x="250" y="340" class="label">Lumbar</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Spine - Lateral View</text>
    </svg>`
  },
  
  // PELVIS DIAGRAM
  'pelvis': {
    'frontal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.bone{fill:#e8e8e8;stroke:#666;stroke-width:2}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <path d="M 120 200 Q 100 250 120 300 L 180 350 L 180 300 L 200 280 L 220 300 L 220 350 L 280 300 Q 300 250 280 200 L 200 180 Z" class="bone"/>
      <circle cx="150" cy="270" r="30" class="bone"/>
      <circle cx="250" cy="270" r="30" class="bone"/>
      <text x="200" y="220" class="label" text-anchor="middle">Sacrum</text>
      <text x="150" y="275" class="label" text-anchor="middle" font-size="9">Hip</text>
      <text x="250" y="275" class="label" text-anchor="middle" font-size="9">Hip</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Pelvis - Frontal (AP) View</text>
    </svg>`
  },
  
  // FULL BODY DIAGRAMS
  'fullbody': {
    'neutral_frontal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.body{fill:#f5f5f5;stroke:#666;stroke-width:2}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <circle cx="200" cy="80" r="30" class="body"/>
      <rect x="170" y="110" width="60" height="100" class="body" rx="10"/>
      <rect x="130" y="120" width="40" height="80" class="body" rx="5"/>
      <rect x="230" y="120" width="40" height="80" class="body" rx="5"/>
      <rect x="180" y="210" width="15" height="120" class="body" rx="5"/>
      <rect x="205" y="210" width="15" height="120" class="body" rx="5"/>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Full Body - Frontal View</text>
    </svg>`
  },
  
  // EXTREMITIES DIAGRAMS
  'extremities': {
    'hand': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.bone{fill:#e8e8e8;stroke:#666;stroke-width:1.5}.label{font-family:Arial;font-size:10px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <rect x="180" y="300" width="40" height="120" class="bone" rx="5"/>
      ${[0,1,2,3,4].map(i => {
        const x = 120 + i * 35;
        return `<rect x="${x}" y="200" width="15" height="100" class="bone" rx="3"/>
                <rect x="${x}" y="150" width="15" height="45" class="bone" rx="3"/>
                <rect x="${x}" y="110" width="15" height="35" class="bone" rx="3"/>`;
      }).join('')}
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Hand - AP View</text>
    </svg>`,
    
    'shoulder': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.bone{fill:#e8e8e8;stroke:#666;stroke-width:2}.joint{fill:#d0d0d0;stroke:#999;stroke-width:1.5}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <circle cx="200" cy="200" r="50" class="joint"/>
      <rect x="180" y="250" width="40" height="150" class="bone" rx="10"/>
      <path d="M 150 180 L 120 150 L 140 120 L 170 150 Z" class="bone"/>
      <text x="200" y="205" class="label" text-anchor="middle">Joint</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Shoulder - AP View</text>
    </svg>`,
    
    'knee': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs><style>.bone{fill:#e8e8e8;stroke:#666;stroke-width:2}.joint{fill:#d0d0d0;stroke:#999;stroke-width:1.5}.label{font-family:Arial;font-size:11px;fill:#333}</style></defs>
      <rect width="400" height="500" fill="#fafafa"/>
      <rect x="170" y="100" width="60" height="150" class="bone" rx="10"/>
      <ellipse cx="200" cy="250" rx="70" ry="40" class="joint"/>
      <rect x="175" y="290" width="50" height="150" class="bone" rx="10"/>
      <text x="200" y="255" class="label" text-anchor="middle">Knee Joint</text>
      <text x="200" y="30" class="label" text-anchor="middle" font-weight="bold">Knee - AP View</text>
    </svg>`
  }
};

// Helper function to get diagram SVG
export function getDiagramSVG(bodyPart: string, view: string): string | null {
  const bodyPartKey = bodyPart.toLowerCase().replace(/\//g, '').replace(/\s+/g, '');
  return ANATOMICAL_DIAGRAMS[bodyPartKey]?.[view] || null;
}
