import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface WorkflowState {
  currentPatient?: {
    id: string;
    name: string;
    mrn: string;
  };
  currentStudy?: {
    studyInstanceUID: string;
    patientName: string;
    modality: string;
    studyDate: string;
  };
  currentReport?: {
    id: string;
    studyId: string;
    status: 'draft' | 'finalized';
  };
  currentFollowUp?: {
    id: string;
    patientId: string;
    status: string;
  };
  workflowHistory: string[];
}

interface WorkflowContextType {
  state: WorkflowState;
  setCurrentPatient: (patient: WorkflowState['currentPatient']) => void;
  setCurrentStudy: (study: WorkflowState['currentStudy']) => void;
  setCurrentReport: (report: WorkflowState['currentReport']) => void;
  setCurrentFollowUp: (followUp: WorkflowState['currentFollowUp']) => void;
  clearWorkflow: () => void;
  addToHistory: (page: string) => void;
  getLastPage: () => string | undefined;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export const WorkflowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WorkflowState>({
    workflowHistory: [],
  });

  const setCurrentPatient = useCallback((patient: WorkflowState['currentPatient']) => {
    setState(prev => ({ ...prev, currentPatient: patient }));
  }, []);

  const setCurrentStudy = useCallback((study: WorkflowState['currentStudy']) => {
    setState(prev => ({ ...prev, currentStudy: study }));
  }, []);

  const setCurrentReport = useCallback((report: WorkflowState['currentReport']) => {
    setState(prev => ({ ...prev, currentReport: report }));
  }, []);

  const setCurrentFollowUp = useCallback((followUp: WorkflowState['currentFollowUp']) => {
    setState(prev => ({ ...prev, currentFollowUp: followUp }));
  }, []);

  const clearWorkflow = useCallback(() => {
    setState({ workflowHistory: [] });
  }, []);

  const addToHistory = useCallback((page: string) => {
    setState(prev => ({
      ...prev,
      workflowHistory: [...prev.workflowHistory.slice(-9), page], // Keep last 10
    }));
  }, []);

  const getLastPage = useCallback(() => {
    return state.workflowHistory[state.workflowHistory.length - 2];
  }, [state.workflowHistory]);

  return (
    <WorkflowContext.Provider
      value={{
        state,
        setCurrentPatient,
        setCurrentStudy,
        setCurrentReport,
        setCurrentFollowUp,
        clearWorkflow,
        addToHistory,
        getLastPage,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
};
