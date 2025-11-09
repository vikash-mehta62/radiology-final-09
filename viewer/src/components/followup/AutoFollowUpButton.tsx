import React, { useState } from 'react';
import { Sparkles, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import ApiService from '../../services/ApiService';

interface AutoFollowUpButtonProps {
  reportId: string;
  onFollowUpCreated?: (followUp: any) => void;
}

const AutoFollowUpButton: React.FC<AutoFollowUpButtonProps> = ({
  reportId,
  onFollowUpCreated
}) => {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ApiService.getFollowUpRecommendations(reportId);
      setRecommendations(response.data);
      
      if (response.data.length > 0) {
        setShowRecommendations(true);
      } else {
        setError('No follow-up recommendations found for this report');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze report');
    } finally {
      setLoading(false);
    }
  };

  const generateFollowUp = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ApiService.generateFollowUpFromReport(reportId);
      
      if (response.data) {
        setSuccess(true);
        setShowRecommendations(false);
        
        if (onFollowUpCreated) {
          onFollowUpCreated(response.data);
        }
        
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError('No follow-up was generated');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate follow-up');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'text-red-600';
    if (priority >= 4) return 'text-orange-600';
    if (priority >= 3) return 'text-yellow-600';
    return 'text-blue-600';
  };

  if (success) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg">
        <CheckCircle className="w-5 h-5" />
        <span>Follow-up created successfully!</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={analyzeReport}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <Loader className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
        <span>{loading ? 'Analyzing...' : 'AI Follow-up Analysis'}</span>
      </button>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {showRecommendations && recommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">AI Recommendations</h4>
            <span className="text-sm text-gray-500">
              {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} found
            </span>
          </div>

          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${getPriorityColor(rec.priority)}`}>
                      Priority {rec.priority}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({rec.type})
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {Math.round(rec.confidence * 100)}% confidence
                  </span>
                </div>
                
                <p className="text-gray-700 mb-2">{rec.reason}</p>
                
                <div className="text-sm text-gray-600">
                  Recommended date: {new Date(rec.recommendedDate).toLocaleDateString()}
                </div>
                
                {rec.triggerFindings && rec.triggerFindings.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Trigger findings:</p>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {rec.triggerFindings.map((finding: string, i: number) => (
                        <li key={i}>{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={generateFollowUp}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Follow-up'}
            </button>
            <button
              onClick={() => setShowRecommendations(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoFollowUpButton;
