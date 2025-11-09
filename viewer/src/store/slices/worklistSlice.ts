import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { worklistService } from '../../services/worklistService'
import type { Study, WorklistFilters, SortOptions } from '../../types/worklist'

export interface WorklistState {
  studies: Study[]
  filteredStudies: Study[]
  selectedStudy: Study | null
  filters: WorklistFilters
  sortOptions: SortOptions
  searchQuery: string
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    pageSize: number
    total: number
  }
  lastUpdated: number | null
}

const initialState: WorklistState = {
  studies: [],
  filteredStudies: [],
  selectedStudy: null,
  filters: {
    modalities: [],
    dateRange: {
      start: null,
      end: null,
    },
    priorities: [],
    statuses: [],
    aiStatus: [],
  },
  sortOptions: {
    field: 'studyDate',
    direction: 'desc',
  },
  searchQuery: '',
  isLoading: false,
  error: null,
  pagination: {
    page: 0,
    pageSize: 25,
    total: 0,
  },
  lastUpdated: null,
}

// Async thunks
export const fetchWorklist = createAsyncThunk(
  'worklist/fetchWorklist',
  async (params: {
    page?: number
    pageSize?: number
    filters?: Partial<WorklistFilters>
    sort?: Partial<SortOptions>
    search?: string
  } = {}, { rejectWithValue }) => {
    try {
      const response = await worklistService.getWorklist(params)
      return response
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch worklist')
    }
  }
)

export const fetchStudyDetails = createAsyncThunk(
  'worklist/fetchStudyDetails',
  async (studyInstanceUID: string, { rejectWithValue }) => {
    try {
      const study = await worklistService.getStudyDetails(studyInstanceUID)
      return study
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch study details')
    }
  }
)

export const updateStudyPriority = createAsyncThunk(
  'worklist/updateStudyPriority',
  async ({ studyInstanceUID, priority }: { studyInstanceUID: string; priority: string }, { rejectWithValue }) => {
    try {
      const updatedStudy = await worklistService.updateStudyPriority(studyInstanceUID, priority)
      return updatedStudy
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update study priority')
    }
  }
)

export const assignStudy = createAsyncThunk(
  'worklist/assignStudy',
  async ({ studyInstanceUID, userId }: { studyInstanceUID: string; userId: string }, { rejectWithValue }) => {
    try {
      const updatedStudy = await worklistService.assignStudy(studyInstanceUID, userId)
      return updatedStudy
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to assign study')
    }
  }
)

// Worklist slice
const worklistSlice = createSlice({
  name: 'worklist',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<WorklistFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 0 // Reset to first page when filters change
    },
    clearFilters: (state) => {
      state.filters = initialState.filters
      state.pagination.page = 0
    },
    setSortOptions: (state, action: PayloadAction<SortOptions>) => {
      state.sortOptions = action.payload
      state.pagination.page = 0 // Reset to first page when sort changes
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
      state.pagination.page = 0 // Reset to first page when search changes
    },
    setSelectedStudy: (state, action: PayloadAction<Study | null>) => {
      state.selectedStudy = action.payload
    },
    setPagination: (state, action: PayloadAction<Partial<WorklistState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    updateStudyInList: (state, action: PayloadAction<Study>) => {
      const index = state.studies.findIndex(s => s.studyInstanceUID === action.payload.studyInstanceUID)
      if (index !== -1) {
        state.studies[index] = action.payload
      }
      
      const filteredIndex = state.filteredStudies.findIndex(s => s.studyInstanceUID === action.payload.studyInstanceUID)
      if (filteredIndex !== -1) {
        state.filteredStudies[filteredIndex] = action.payload
      }
      
      if (state.selectedStudy?.studyInstanceUID === action.payload.studyInstanceUID) {
        state.selectedStudy = action.payload
      }
    },
    clearError: (state) => {
      state.error = null
    },
    refreshWorklist: (state) => {
      state.lastUpdated = Date.now()
    },
  },
  extraReducers: (builder) => {
    // Fetch worklist
    builder
      .addCase(fetchWorklist.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchWorklist.fulfilled, (state, action) => {
        state.isLoading = false
        state.studies = action.payload.studies
        state.filteredStudies = action.payload.studies
        state.pagination.total = action.payload.total
        state.lastUpdated = Date.now()
        state.error = null
      })
      .addCase(fetchWorklist.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Fetch study details
    builder
      .addCase(fetchStudyDetails.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchStudyDetails.fulfilled, (state, action) => {
        state.isLoading = false
        state.selectedStudy = action.payload
        state.error = null
      })
      .addCase(fetchStudyDetails.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Update study priority
    builder
      .addCase(updateStudyPriority.fulfilled, (state, action) => {
        const index = state.studies.findIndex(s => s.studyInstanceUID === action.payload.studyInstanceUID)
        if (index !== -1) {
          state.studies[index] = { ...state.studies[index], ...action.payload }
        }
        
        const filteredIndex = state.filteredStudies.findIndex(s => s.studyInstanceUID === action.payload.studyInstanceUID)
        if (filteredIndex !== -1) {
          state.filteredStudies[filteredIndex] = { ...state.filteredStudies[filteredIndex], ...action.payload }
        }
        
        if (state.selectedStudy?.studyInstanceUID === action.payload.studyInstanceUID) {
          state.selectedStudy = { ...state.selectedStudy, ...action.payload }
        }
      })

    // Assign study
    builder
      .addCase(assignStudy.fulfilled, (state, action) => {
        const index = state.studies.findIndex(s => s.studyInstanceUID === action.payload.studyInstanceUID)
        if (index !== -1) {
          state.studies[index] = { ...state.studies[index], ...action.payload }
        }
        
        const filteredIndex = state.filteredStudies.findIndex(s => s.studyInstanceUID === action.payload.studyInstanceUID)
        if (filteredIndex !== -1) {
          state.filteredStudies[filteredIndex] = { ...state.filteredStudies[filteredIndex], ...action.payload }
        }
        
        if (state.selectedStudy?.studyInstanceUID === action.payload.studyInstanceUID) {
          state.selectedStudy = { ...state.selectedStudy, ...action.payload }
        }
      })
  },
})

export const {
  setFilters,
  clearFilters,
  setSortOptions,
  setSearchQuery,
  setSelectedStudy,
  setPagination,
  updateStudyInList,
  clearError,
  refreshWorklist,
} = worklistSlice.actions

export default worklistSlice.reducer

// Selectors
export const selectWorklist = (state: { worklist: WorklistState }) => state.worklist
export const selectStudies = (state: { worklist: WorklistState }) => state.worklist.studies
export const selectFilteredStudies = (state: { worklist: WorklistState }) => state.worklist.filteredStudies
export const selectSelectedStudy = (state: { worklist: WorklistState }) => state.worklist.selectedStudy
export const selectWorklistFilters = (state: { worklist: WorklistState }) => state.worklist.filters
export const selectWorklistSort = (state: { worklist: WorklistState }) => state.worklist.sortOptions
export const selectWorklistSearch = (state: { worklist: WorklistState }) => state.worklist.searchQuery
export const selectWorklistLoading = (state: { worklist: WorklistState }) => state.worklist.isLoading
export const selectWorklistError = (state: { worklist: WorklistState }) => state.worklist.error
export const selectWorklistPagination = (state: { worklist: WorklistState }) => state.worklist.pagination