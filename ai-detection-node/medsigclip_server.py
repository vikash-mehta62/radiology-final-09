#!/usr/bin/env python3
"""
MedSigLIP Server - Medical Image Classification
Runs on http://localhost:5001
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import io
import torch
from transformers import CLIPProcessor, CLIPModel
import numpy as np

app = Flask(__name__)
CORS(app)

# Global model variables
model = None
processor = None

# Medical conditions to detect
MEDICAL_CONDITIONS = [
    'pneumonia',
    'pleural effusion',
    'cardiomegaly',
    'lung nodule',
    'atelectasis',
    'consolidation',
    'pulmonary edema',
    'mass',
    'fracture',
    'normal anatomy'
]

def load_model():
    """Load MedSigLIP model"""
    global model, processor
    
    print("🔄 Loading MedSigLIP model...")
    model_name = "flaviagiammarino/pubmed-clip-vit-base-patch32"
    
    try:
        processor = CLIPProcessor.from_pretrained(model_name)
        model = CLIPModel.from_pretrained(model_name)
        model.eval()
        print("✅ MedSigLIP model loaded successfully!")
        return True
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return False

def classify_image(image_bytes):
    """Classify medical image"""
    try:
        # Load image
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # Prepare inputs
        inputs = processor(
            text=MEDICAL_CONDITIONS,
            images=image,
            return_tensors="pt",
            padding=True
        )
        
        # Get predictions
        with torch.no_grad():
            outputs = model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1)[0]
        
        # Create results
        results = []
        for i, condition in enumerate(MEDICAL_CONDITIONS):
            results.append({
                'label': condition,
                'score': float(probs[i]),
                'confidence': 'high' if probs[i] > 0.7 else 'medium' if probs[i] > 0.4 else 'low'
            })
        
        # Sort by score
        results.sort(key=lambda x: x['score'], reverse=True)
        
        return results
        
    except Exception as e:
        raise Exception(f"Classification error: {str(e)}")

def detect_regions(image_bytes, grid_size=3):
    """Detect abnormalities in grid regions"""
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        width, height = image.size
        
        region_width = width // grid_size
        region_height = height // grid_size
        
        detections = []
        
        for row in range(grid_size):
            for col in range(grid_size):
                # Extract region
                x = col * region_width
                y = row * region_height
                region = image.crop((x, y, x + region_width, y + region_height))
                
                # Convert to bytes
                buffer = io.BytesIO()
                region.save(buffer, format='JPEG')
                region_bytes = buffer.getvalue()
                
                # Classify region
                results = classify_image(region_bytes)
                
                # Check for abnormalities (not normal)
                top_result = results[0]
                if top_result['label'] != 'normal anatomy' and top_result['score'] > 0.3:
                    detections.append({
                        'x': x,
                        'y': y,
                        'width': region_width,
                        'height': region_height,
                        'label': top_result['label'],
                        'confidence': top_result['score'],
                        'location': f"region ({row}, {col})",
                        'description': f"{top_result['label']} detected in grid position ({row}, {col})"
                    })
        
        return detections
        
    except Exception as e:
        raise Exception(f"Detection error: {str(e)}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'MedSigLIP',
        'model_loaded': model is not None,
        'version': '1.0.0'
    })

@app.route('/classify', methods=['POST'])
def classify():
    """Classify medical image"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        image_bytes = image_file.read()
        
        results = classify_image(image_bytes)
        
        return jsonify({
            'success': True,
            'results': results,
            'model': 'MedSigLIP'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/detect', methods=['POST'])
def detect():
    """Detect abnormalities in medical image"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        image_bytes = image_file.read()
        
        grid_size = int(request.form.get('grid_size', 3))
        
        detections = detect_regions(image_bytes, grid_size)
        
        return jsonify({
            'success': True,
            'detections': detections,
            'metadata': {
                'grid_size': grid_size,
                'regions_processed': grid_size * grid_size,
                'model': 'MedSigLIP'
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/test', methods=['GET'])
def test():
    """Test endpoint"""
    return jsonify({
        'success': True,
        'message': 'MedSigLIP service is running',
        'model_loaded': model is not None
    })

if __name__ == '__main__':
    print("🚀 Starting MedSigLIP Server...")
    print("📍 Port: 5001")
    
    # Load model
    if load_model():
        print("✅ Server ready!")
        app.run(host='0.0.0.0', port=5001, debug=False)
    else:
        print("❌ Failed to start server - model loading failed")
