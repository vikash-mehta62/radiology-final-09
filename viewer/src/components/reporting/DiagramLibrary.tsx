/**
 * Professional Medical Diagram Library
 * Provides easy access to anatomical diagrams with annotation support
 */

import React, { useState } from 'react';

export interface DiagramInfo {
  id: string;
  name: string;
  category: string;
  path: string;
  description: string;
}

export const DIAGRAM_LIBRARY: DiagramInfo[] = [
  // Full Body
  {
    id: 'fullbody-neutral',
    name: 'Full Body (Neutral)',
    category: 'Full Body',
    path: '/diagrams/fullbody-neutral_frontal.svg',
    description: 'Neutral full body frontal view'
  },
  {
    id: 'fullbody-female',
    name: 'Full Body (Female)',
    category: 'Full Body',
    path: '/diagrams/fullbody-female_frontal.svg',
    description: 'Female full body frontal view'
  },
  
  // Head & Brain
  {
    id: 'brain-axial',
    name: 'Brain - Axial',
    category: 'Head & Brain',
    path: '/diagrams/headbrain-axial.svg',
    description: 'Brain cross-section (axial view)'
  },
  {
    id: 'brain-sagittal',
    name: 'Brain - Sagittal',
    category: 'Head & Brain',
    path: '/diagrams/headbrain-sagittal.svg',
    description: 'Brain side view (sagittal)'
  },
  {
    id: 'brain-coronal',
    name: 'Brain - Coronal',
    category: 'Head & Brain',
    path: '/diagrams/headbrain-coronal.svg',
    description: 'Brain front view (coronal)'
  },
  
  // Chest
  {
    id: 'chest-frontal',
    name: 'Chest - Frontal',
    category: 'Chest',
    path: '/diagrams/chest-frontal.svg',
    description: 'Chest and rib cage frontal view'
  },
  {
    id: 'chest-lateral',
    name: 'Chest - Lateral',
    category: 'Chest',
    path: '/diagrams/chest-lateral.svg',
    description: 'Chest side view'
  },
  {
    id: 'chest-axial',
    name: 'Chest - Axial',
    category: 'Chest',
    path: '/diagrams/chest-axial.svg',
    description: 'Thoracic cross-section'
  },
  
  // Abdomen
  {
    id: 'abdomen-frontal',
    name: 'Abdomen - Frontal',
    category: 'Abdomen',
    path: '/diagrams/abdomen-frontal.svg',
    description: 'Abdominal region frontal view'
  },
  {
    id: 'abdomen-quadrants',
    name: 'Abdominal Quadrants',
    category: 'Abdomen',
    path: '/diagrams/abdomen-quadrants.svg',
    description: 'Four abdominal quadrants'
  },
  
  // Spine
  {
    id: 'spine-lateral',
    name: 'Spine - Lateral',
    category: 'Spine',
    path: '/diagrams/spine-lateral.svg',
    description: 'Spinal column side view'
  },
  {
    id: 'spine-frontal',
    name: 'Spine - Frontal',
    category: 'Spine',
    path: '/diagrams/spine-frontal.svg',
    description: 'Spinal column front view'
  },
  
  // Pelvis
  {
    id: 'pelvis-frontal',
    name: 'Pelvis - Frontal',
    category: 'Pelvis',
    path: '/diagrams/pelvis-frontal.svg',
    description: 'Pelvic region frontal view'
  },
  
  // Extremities
  {
    id: 'shoulder',
    name: 'Shoulder Joint',
    category: 'Extremities',
    path: '/diagrams/extremities-shoulder.svg',
    description: 'Shoulder joint anatomy'
  },
  {
    id: 'hand',
    name: 'Hand Bones',
    category: 'Extremities',
    path: '/diagrams/extremities-hand.svg',
    description: 'Hand skeletal structure'
  },
  {
    id: 'knee',
    name: 'Knee Joint',
    category: 'Extremities',
    path: '/diagrams/extremities-knee.svg',
    description: 'Knee joint anatomy'
  }
];

export const DIAGRAM_CATEGORIES = [
  'All',
  'Full Body',
  'Head & Brain',
  'Chest',
  'Abdomen',
  'Spine',
  'Pelvis',
  'Extremities'
];

interface DiagramLibraryProps {
  onSelectDiagram?: (diagram: DiagramInfo) => void;
  selectedDiagramId?: string;
}

export const DiagramLibrary: React.FC<DiagramLibraryProps> = ({
  onSelectDiagram,
  selectedDiagramId
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDiagrams = DIAGRAM_LIBRARY.filter(diagram => {
    const matchesCategory = selectedCategory === 'All' || diagram.category === selectedCategory;
    const matchesSearch = diagram.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         diagram.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="diagram-library">
      {/* Search and Filter */}
      <div className="mb-4 space-y-3">
        <input
          type="text"
          placeholder="Search diagrams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        <div className="flex flex-wrap gap-2">
          {DIAGRAM_CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Diagram Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredDiagrams.map(diagram => (
          <div
            key={diagram.id}
            onClick={() => onSelectDiagram?.(diagram)}
            className={`cursor-pointer border-2 rounded-lg p-3 transition-all hover:shadow-lg ${
              selectedDiagramId === diagram.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="aspect-square bg-white rounded-md mb-2 flex items-center justify-center overflow-hidden">
              <img
                src={diagram.path}
                alt={diagram.name}
                className="max-w-full max-h-full object-contain p-2"
                onError={(e) => {
                  // Fallback if image fails to load
                  e.currentTarget.src = 'data:image/svg+xml,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f4f6"/><text x="50" y="50" text-anchor="middle" font-size="12" fill="#9ca3af">No Image</text></svg>'
                  );
                }}
              />
            </div>
            <h4 className="font-medium text-sm text-gray-900 mb-1">{diagram.name}</h4>
            <p className="text-xs text-gray-500">{diagram.description}</p>
          </div>
        ))}
      </div>

      {filteredDiagrams.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No diagrams found matching your criteria</p>
        </div>
      )}
    </div>
  );
};

// Helper function to get diagram by ID
export const getDiagramById = (id: string): DiagramInfo | undefined => {
  return DIAGRAM_LIBRARY.find(d => d.id === id);
};

// Helper function to get diagrams by category
export const getDiagramsByCategory = (category: string): DiagramInfo[] => {
  if (category === 'All') return DIAGRAM_LIBRARY;
  return DIAGRAM_LIBRARY.filter(d => d.category === category);
};

export default DiagramLibrary;
