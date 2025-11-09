/**
 * Creates simple fallback SVG diagrams for missing anatomical diagrams
 * These are basic but professional-looking placeholders
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const diagramsDir = path.join(__dirname, '../public/diagrams');
if (!fs.existsSync(diagramsDir)) fs.mkdirSync(diagramsDir, { recursive: true });

// Simple SVG templates for missing diagrams
const fallbackDiagrams = {
  'headbrain-axial.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="80" fill="none" stroke="#4A5568" stroke-width="2"/>
  <ellipse cx="100" cy="100" rx="70" ry="60" fill="none" stroke="#4A5568" stroke-width="1.5"/>
  <path d="M 40 100 Q 100 80 160 100" fill="none" stroke="#4A5568" stroke-width="1"/>
  <path d="M 40 100 Q 100 120 160 100" fill="none" stroke="#4A5568" stroke-width="1"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Brain - Axial View</text>
</svg>`,

  'headbrain-sagittal.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M 50 100 Q 80 40 120 50 Q 150 60 150 100 Q 150 140 120 150 Q 80 160 50 100 Z" 
        fill="none" stroke="#4A5568" stroke-width="2"/>
  <path d="M 70 80 Q 90 70 110 75 Q 120 80 120 100" fill="none" stroke="#4A5568" stroke-width="1"/>
  <circle cx="85" cy="100" r="15" fill="none" stroke="#4A5568" stroke-width="1"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Brain - Sagittal View</text>
</svg>`,

  'headbrain-coronal.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <ellipse cx="100" cy="90" rx="70" ry="60" fill="none" stroke="#4A5568" stroke-width="2"/>
  <path d="M 50 90 Q 100 70 150 90" fill="none" stroke="#4A5568" stroke-width="1.5"/>
  <path d="M 60 100 L 60 120 Q 100 140 140 120 L 140 100" fill="none" stroke="#4A5568" stroke-width="1.5"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Brain - Coronal View</text>
</svg>`,

  'abdomen-frontal.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="60" y="40" width="80" height="100" rx="10" fill="none" stroke="#4A5568" stroke-width="2"/>
  <line x1="60" y1="90" x2="140" y2="90" stroke="#4A5568" stroke-width="1" stroke-dasharray="3,3"/>
  <circle cx="80" cy="65" r="8" fill="none" stroke="#4A5568" stroke-width="1"/>
  <circle cx="120" cy="65" r="8" fill="none" stroke="#4A5568" stroke-width="1"/>
  <ellipse cx="100" cy="110" rx="25" ry="15" fill="none" stroke="#4A5568" stroke-width="1"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Abdomen - Frontal</text>
</svg>`,

  'abdomen-quadrants.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="50" y="40" width="100" height="100" rx="10" fill="none" stroke="#4A5568" stroke-width="2"/>
  <line x1="100" y1="40" x2="100" y2="140" stroke="#4A5568" stroke-width="1.5"/>
  <line x1="50" y1="90" x2="150" y2="90" stroke="#4A5568" stroke-width="1.5"/>
  <text x="75" y="65" text-anchor="middle" font-size="10" fill="#718096">RUQ</text>
  <text x="125" y="65" text-anchor="middle" font-size="10" fill="#718096">LUQ</text>
  <text x="75" y="115" text-anchor="middle" font-size="10" fill="#718096">RLQ</text>
  <text x="125" y="115" text-anchor="middle" font-size="10" fill="#718096">LLQ</text>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Abdominal Quadrants</text>
</svg>`,

  'spine-lateral.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M 100 30 Q 90 50 95 70 Q 105 90 95 110 Q 90 130 100 150" 
        fill="none" stroke="#4A5568" stroke-width="3"/>
  <circle cx="100" cy="40" r="5" fill="#4A5568"/>
  <circle cx="93" cy="60" r="5" fill="#4A5568"/>
  <circle cx="98" cy="80" r="5" fill="#4A5568"/>
  <circle cx="93" cy="100" r="5" fill="#4A5568"/>
  <circle cx="95" cy="120" r="5" fill="#4A5568"/>
  <circle cx="100" cy="140" r="5" fill="#4A5568"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Spine - Lateral</text>
</svg>`,

  'spine-frontal.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <line x1="100" y1="30" x2="100" y2="150" stroke="#4A5568" stroke-width="3"/>
  <circle cx="100" cy="40" r="6" fill="none" stroke="#4A5568" stroke-width="2"/>
  <circle cx="100" cy="60" r="6" fill="none" stroke="#4A5568" stroke-width="2"/>
  <circle cx="100" cy="80" r="6" fill="none" stroke="#4A5568" stroke-width="2"/>
  <circle cx="100" cy="100" r="6" fill="none" stroke="#4A5568" stroke-width="2"/>
  <circle cx="100" cy="120" r="6" fill="none" stroke="#4A5568" stroke-width="2"/>
  <circle cx="100" cy="140" r="6" fill="none" stroke="#4A5568" stroke-width="2"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Spine - Frontal</text>
</svg>`,

  'pelvis-frontal.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M 50 80 L 70 60 L 130 60 L 150 80 L 140 120 L 120 140 L 80 140 L 60 120 Z" 
        fill="none" stroke="#4A5568" stroke-width="2"/>
  <circle cx="75" cy="100" r="15" fill="none" stroke="#4A5568" stroke-width="2"/>
  <circle cx="125" cy="100" r="15" fill="none" stroke="#4A5568" stroke-width="2"/>
  <line x1="100" y1="60" x2="100" y2="140" stroke="#4A5568" stroke-width="1" stroke-dasharray="3,3"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Pelvis - Frontal</text>
</svg>`,

  'extremities-hand.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="70" y="100" width="60" height="40" rx="5" fill="none" stroke="#4A5568" stroke-width="2"/>
  <rect x="85" y="60" width="8" height="45" rx="3" fill="none" stroke="#4A5568" stroke-width="1.5"/>
  <rect x="95" y="50" width="8" height="55" rx="3" fill="none" stroke="#4A5568" stroke-width="1.5"/>
  <rect x="105" y="55" width="8" height="50" rx="3" fill="none" stroke="#4A5568" stroke-width="1.5"/>
  <rect x="115" y="65" width="8" height="40" rx="3" fill="none" stroke="#4A5568" stroke-width="1.5"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Hand Bones</text>
</svg>`,

  'extremities-knee.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="80" y="40" width="40" height="50" fill="none" stroke="#4A5568" stroke-width="2"/>
  <circle cx="100" cy="95" r="15" fill="none" stroke="#4A5568" stroke-width="2"/>
  <rect x="80" y="110" width="40" height="50" fill="none" stroke="#4A5568" stroke-width="2"/>
  <line x1="70" y1="95" x2="130" y2="95" stroke="#4A5568" stroke-width="1.5"/>
  <text x="100" y="190" text-anchor="middle" font-size="12" fill="#718096">Knee Joint</text>
</svg>`
};

console.log('🎨 Creating fallback anatomical diagrams...\n');

let created = 0;
let skipped = 0;

for (const [filename, svgContent] of Object.entries(fallbackDiagrams)) {
  const filepath = path.join(diagramsDir, filename);
  
  if (fs.existsSync(filepath)) {
    console.log(`  ⏭️  ${filename} - Already exists`);
    skipped++;
  } else {
    fs.writeFileSync(filepath, svgContent);
    console.log(`  ✅ ${filename} - Created`);
    created++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`  ✅ Created: ${created}`);
console.log(`  ⏭️  Skipped: ${skipped}`);
console.log(`\n✨ Fallback diagrams saved to: ${diagramsDir}`);
