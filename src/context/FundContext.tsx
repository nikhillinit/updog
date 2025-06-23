// src/context/FundContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  EnhancedFundInputs,
  ForecastResult,
  FundScenario,
  ValidationResult,
  ValidationError,
  StageStrategy,
  FundExpense,
  ExportSettings
} from '../types/index';
import {
  buildEnhancedFundForecast,
  DEFAULT_FUND_PARAMS,
  DEFAULT_STAGE_STRATEGIES,
  DEFAULT_GRADUATION_MATRIX,
  DEFAULT_EXIT_PROBABILITIES,
  validateEnhancedInputs,
  getPerformanceMetrics,
  clearCalculationCache
} from '../shared/enhanced-fund-model';

// ===== WEB WORKER FOR BACKGROUND CALCULATIONS =====
const WORKER_SCRIPT = `
self.onmessage = async function(e) {
  const { type, payload } = e.data;
  
  if (type === 'CALCULATE') {
    try {
      // Import the calculation module in worker context
      const module = await import('/src/shared/enhanced-fund-model.ts');
      const result = module.buildEnhancedFundForecast(payload);
      
      self.postMessage({
        type: 'CALCULATION_COMPLETE',
        payload: result
      });
    } catch (error) {
      self.postMessage({
        type: 'CALCULATION_ERROR',
        payload: error.message
      });
    }
  }
};
`;

// ===== CONTEXT INTERFACES =====
interface FundState extends EnhancedFundInputs {
  isDirty: boolean;
  isCalculating: boolean;
  lastCalculation?: Date;
  calculationProgress?: number;
  validationErrors: ValidationError[];
}

interface FundContextValue extends FundState {
  // Results
  forecastResult?: ForecastResult;
  
  // Performance Metrics
  performanceMetrics: {
    averageCalculationTime: number;
    cacheHitRate: number;
    totalCalculations: number;
  };
  
  // Scenario Management
  scenarios: FundScenario[];
  activeScenarioId: string;
  createScenario: (name: string, description?: string) => string;
  switchScenario: (id: string) => void;
  updateScenario: (id: string, updates: Partial<FundScenario>) => void;
  deleteScenario: (id: string) => void;
  duplicateScenario: (id: string, newName: string) => string;
  
  // State Updates
  updateFundParameter: <K extends keyof FundState>(key: K, value: FundState[K]) => void;
  updateStageStrategy: (index: number, strategy: Partial<StageStrategy>) => void;
  updateGraduationRate: (fromStage: string, toStage: string, rate: number) => void;
  addExpense: (expense: Omit<FundExpense, 'id'>) => void;
  updateExpense: (id: string, expense: Partial<FundExpense>) => void;
  removeExpense: (id: string) => void;
  
  // Batch Updates
  batchUpdate: (updates: Partial<FundState>) => void;
  
  // Validation
  validationResults: Map<string, ValidationResult>;
  validateField: (field: string, value: any) => ValidationResult;
  validateAll: () => Map<string, ValidationResult>;
  isValid: boolean;
  
  // Calculations
  calculateForecast: () => Promise<void>;
  cancelCalculation: () => void;
  
  // Export
  exportSettings: ExportSettings;
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  exportScenario: (id: string) => string;
  importScenario: (data: string) => string;
  exportToExcel: () => Promise<Blob>;
  
  // Computed Values
  investableCapital: number;
  totalManagementFees: number;
  lpCommitment: number;
  gpCommitment: number;
  
  // Utilities
  resetToDefaults: () => void;
  clearCache: () => void;
}

// ===== DEFAULT STATE =====
const createDefaultState = (): FundState => ({
  ...DEFAULT_FUND_PARAMS,
  stageStrategies: [...DEFAULT_STAGE_STRATEGIES],
  graduationMatrix: { ...DEFAULT_GRADUATION_MATRIX },
  exitProbabilityMatrix: { ...DEFAULT_EXIT_PROBABILITIES },
  feeProfiles: [{
    name: "Default Fee Profile",
    value: 2.0,
    basis: "LP Committed Capital",
    startQuarter: 1,
    endQuarter: 40
  }],
  expenses: [],
  isDirty: false,
  isCalculating: false,
  validationErrors: []
});

const defaultExportSettings: ExportSettings = {
  includeCashFlows: true,
  includeCompanyDetails: true,
  includeAssumptions: true,
  includeCharts: false,
  format: 'excel',
  lpFriendly: true
};

// ===== CONTEXT CREATION =====
const FundContext = createContext<FundContextValue | null>(null);

// ===== PROVIDER COMPONENT =====
export const FundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Core state
  const [state, setState] = useState<FundState>(createDefaultState());
  const [forecastResult, setForecastResult] = useState<ForecastResult>();
  const [exportSettings, setExportSettings] = useState<ExportSettings>(defaultExportSettings);
  
  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageCalculationTime: 0,
    cacheHitRate: 0,
    totalCalculations: 0
  });
  
  // Scenario management
  const [scenarios, setScenarios] = useState<FundScenario[]>([
    {
      id: 'base',
      name: 'Base Case',
      description: 'Primary fund model assumptions',
      createdAt: new Date(),
      inputs: createDefaultState(),
      isBaseline: true
    }
  ]);
  
  const [activeScenarioId, setActiveScenarioId] = useState('base');
  const [validationResults, setValidationResults] = useState<Map<string, ValidationResult>>(new Map());
  
  // Worker management
  const workerRef = useRef<Worker | null>(null);
  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize worker
  useEffect(() => {
    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    try {
      workerRef.current = new Worker(workerUrl);
      
      workerRef.current.onmessage = (event) => {
        const { type, payload } = event.data;
        
        if (type === 'CALCULATION_COMPLETE') {
          setForecastResult(payload);
          setState(prev => ({
            ...prev,
            isCalculating: false,
            calculationProgress: 100,
            lastCalculation: new Date(),
            isDirty: false
          }));
          
          // Update performance metrics
          const metrics = getPerformanceMetrics();
          setPerformanceMetrics({
            averageCalculationTime: metrics.averageCalculationTime,
            cacheHitRate: metrics.cacheHitRate,
            totalCalculations: metrics.totalCalculations
          });
        } else if (type === 'CALCULATION_ERROR') {
          console.error('Calculation error:', payload);
          setState(prev => ({
            ...prev,
            isCalculating: false,
            calculationProgress: 0
          }));
        }
      };
    } catch (error) {
      console.warn('Web Worker not available, falling back to main thread');
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      URL.revokeObjectURL(workerUrl);
    };
  }, []);
  
  // ===== MEMOIZED COMPUTED VALUES =====
  const gpCommitment = useMemo(() => 
    (state.fundSize * state.gpCommitmentPct) / 100,
    [state.fundSize, state.gpCommitmentPct]
  );
  
  const lpCommitment = useMemo(() => 
    state.fundSize - gpCommitment,
    [state.fundSize, gpCommitment]
  );
  
  const totalManagementFees = useMemo(() => {
    const feeBase = state.includeGpInFees ? state.fundSize : lpCommitment;
    return feeBase * state.managementFeeRate * state.fundLifeYears;
  }, [state.fundSize, lpCommitment, state.includeGpInFees, state.managementFeeRate, state.fundLifeYears]);
  
  const investableCapital = useMemo(() => 
    state.fundSize - totalManagementFees,
    [state.fundSize, totalManagementFees]
  );
  
  // ===== VALIDATION =====
  const validateField = useCallback((field: string, value: any): ValidationResult => {
    const tempInputs = { ...state, [field]: value };
    const errors = validateEnhancedInputs(tempInputs);
    const fieldError = errors.find(e => e.field === field || e.field.startsWith(field));
    
    if (fieldError) {
      return {
        field,
        isValid: false,
        error: fieldError.message,
        severity: fieldError.severity
      };
    }
    
    return { field, isValid: true };
  }, [state]);
  
  const validateAll = useCallback(() => {
    const results = new Map<string, ValidationResult>();
    const errors = validateEnhancedInputs(state);
    
    // Add all fields as valid first
    Object.keys(state).forEach(key => {
      results.set(key, { field: key, isValid: true });
    });
    
    // Override with errors
    errors.forEach(error => {
      results.set(error.field, {
        field: error.field,
        isValid: false,
        error: error.message,
        severity: error.severity
      });
    });
    
    setValidationResults(results);
    return results;
  }, [state]);
  
  const isValid = useMemo(() => {
    return Array.from(validationResults.values()).every(
      result => result.isValid || result.severity === 'warning'
    );
  }, [validationResults]);
  
  // ===== CALCULATIONS =====
  const calculateForecast = useCallback(async () => {
    if (!isValid) {
      console.warn('Cannot calculate forecast: validation errors exist');
      return;
    }
    
    setState(prev => ({ ...prev, isCalculating: true, calculationProgress: 0 }));
    
    // Simulate progress updates
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 10, 90);
      setState(prev => ({ ...prev, calculationProgress: progress }));
    }, 100);
    
    try {
      let result: ForecastResult;
      
      // Try to use worker, fall back to main thread
      if (workerRef.current) {
        // Worker calculation would go here, but for now we'll use main thread
        result = await new Promise((resolve) => {
          setTimeout(() => {
            const forecast = buildEnhancedFundForecast(state);
            resolve(forecast);
          }, 500);
        });
        
        setForecastResult(result);
        setState(prev => ({
          ...prev,
          isCalculating: false,
          calculationProgress: 100,
          lastCalculation: new Date(),
          isDirty: false
        }));
      } else {
        // Main thread calculation
        result = await new Promise((resolve) => {
          setTimeout(() => {
            const forecast = buildEnhancedFundForecast(state);
            resolve(forecast);
          }, 500);
        });
        
        setForecastResult(result);
        setState(prev => ({
          ...prev,
          isCalculating: false,
          calculationProgress: 100,
          lastCalculation: new Date(),
          isDirty: false
        }));
      }
      
      clearInterval(progressInterval);
      
      // Update active scenario with results
      setScenarios(prev => prev.map(scenario =>
        scenario.id === activeScenarioId
          ? { ...scenario, results: result, inputs: state }
          : scenario
      ));
      
      // Update performance metrics
      const metrics = getPerformanceMetrics();
      setPerformanceMetrics({
        averageCalculationTime: metrics.averageCalculationTime,
        cacheHitRate: metrics.cacheHitRate,
        totalCalculations: metrics.totalCalculations
      });
      
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Calculation failed:', error);
      setState(prev => ({
        ...prev,
        isCalculating: false,
        calculationProgress: 0
      }));
    }
  }, [state, isValid, activeScenarioId]);
  
  const cancelCalculation = useCallback(() => {
    // Cancel any pending calculations
    if (calculationTimeoutRef.current) {
      clearTimeout(calculationTimeoutRef.current);
      calculationTimeoutRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isCalculating: false,
      calculationProgress: 0
    }));
  }, []);
  
  // ===== AUTO-CALCULATION WITH DEBOUNCE =====
  useEffect(() => {
    if (state.isDirty && isValid) {
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
      
      calculationTimeoutRef.current = setTimeout(() => {
        calculateForecast();
      }, 1000);
      
      return () => {
        if (calculationTimeoutRef.current) {
          clearTimeout(calculationTimeoutRef.current);
        }
      };
    }
  }, [state.isDirty, isValid, calculateForecast]);
  
  // ===== STATE UPDATES =====
  const updateFundParameter = useCallback(<K extends keyof FundState>(key: K, value: FundState[K]) => {
    setState(prev => ({
      ...prev,
      [key]: value,
      isDirty: true
    }));
    
    // Immediate validation
    const validation = validateField(key as string, value);
    setValidationResults(prev => new Map(prev).set(key as string, validation));
  }, [validateField]);
  
  const batchUpdate = useCallback((updates: Partial<FundState>) => {
    setState(prev => ({
      ...prev,
      ...updates,
      isDirty: true
    }));
  }, []);
  
  const updateStageStrategy = useCallback((index: number, strategy: Partial<StageStrategy>) => {
    setState(prev => {
      const newStrategies = [...prev.stageStrategies];
      newStrategies[index] = { ...newStrategies[index], ...strategy };
      
      return {
        ...prev,
        stageStrategies: newStrategies,
        isDirty: true
      };
    });
  }, []);
  
  const updateGraduationRate = useCallback((fromStage: string, toStage: string, rate: number) => {
    setState(prev => ({
      ...prev,
      graduationMatrix: {
        ...prev.graduationMatrix,
        [fromStage]: {
          ...prev.graduationMatrix[fromStage],
          [toStage]: rate
        }
      },
      isDirty: true
    }));
  }, []);
  
  const addExpense = useCallback((expense: Omit<FundExpense, 'id'>) => {
    const newExpense: FundExpense = {
      ...expense,
      id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    setState(prev => ({
      ...prev,
      expenses: [...prev.expenses, newExpense],
      isDirty: true
    }));
  }, []);
  
  const updateExpense = useCallback((id: string, expense: Partial<FundExpense>) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.map(e =>
        e.id === id ? { ...e, ...expense } : e
      ),
      isDirty: true
    }));
  }, []);
  
  const removeExpense = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id),
      isDirty: true
    }));
  }, []);
  
  // ===== SCENARIO MANAGEMENT =====
  const createScenario = useCallback((name: string, description?: string): string => {
    const id = `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newScenario: FundScenario = {
      id,
      name,
      description,
      createdAt: new Date(),
      inputs: { ...state }
    };
    
    setScenarios(prev => [...prev, newScenario]);
    return id;
  }, [state]);
  
  const switchScenario = useCallback((id: string) => {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) {
      // Cancel any pending calculations
      cancelCalculation();
      
      setState(scenario.inputs);
      setForecastResult(scenario.results);
      setActiveScenarioId(id);
      
      // Re-validate
      setTimeout(() => validateAll(), 0);
    }
  }, [scenarios, cancelCalculation, validateAll]);
  
  const updateScenario = useCallback((id: string, updates: Partial<FundScenario>) => {
    setScenarios(prev => prev.map(scenario =>
      scenario.id === id ? { ...scenario, ...updates } : scenario
    ));
  }, []);
  
  const deleteScenario = useCallback((id: string) => {
    if (scenarios.length <= 1) return;
    
    setScenarios(prev => prev.filter(s => s.id !== id));
    
    if (activeScenarioId === id) {
      const remaining = scenarios.filter(s => s.id !== id);
      if (remaining.length > 0) {
        switchScenario(remaining[0].id);
      }
    }
  }, [scenarios, activeScenarioId, switchScenario]);
  
  const duplicateScenario = useCallback((id: string, newName: string): string => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return '';
    
    const newId = createScenario(newName, `Copy of ${scenario.description || scenario.name}`);
    
    // Copy the inputs and results
    setScenarios(prev => prev.map(s =>
      s.id === newId
        ? { ...s, inputs: { ...scenario.inputs }, results: scenario.results }
        : s
    ));
    
    return newId;
  }, [scenarios, createScenario]);
  
  // ===== EXPORT/IMPORT =====
  const updateExportSettings = useCallback((settings: Partial<ExportSettings>) => {
    setExportSettings(prev => ({ ...prev, ...settings }));
  }, []);
  
  const exportScenario = useCallback((id: string): string => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return '';
    
    return JSON.stringify(scenario, null, 2);
  }, [scenarios]);
  
  const importScenario = useCallback((data: string): string => {
    try {
      const imported = JSON.parse(data) as FundScenario;
      const newId = createScenario(
        `${imported.name} (Imported)`,
        imported.description
      );
      
      updateScenario(newId, {
        inputs: imported.inputs,
        results: imported.results
      });
      
      return newId;
    } catch (error) {
      console.error('Failed to import scenario:', error);
      return '';
    }
  }, [createScenario, updateScenario]);
  
  const exportToExcel = useCallback(async (): Promise<Blob> => {
    // This would be implemented with a library like SheetJS
    // For now, return a CSV blob
    const scenario = scenarios.find(s => s.id === activeScenarioId);
    if (!scenario || !scenario.results) {
      throw new Error('No results to export');
    }
    
    // Build CSV content
    let csv = 'Quarter,Year,NAV,DPI,RVPI,TVPI,Gross IRR,Net IRR\n';
    
    scenario.results.timeline.forEach(point => {
      csv += `${point.quarter},${point.year},${point.nav},${point.dpi},${point.rvpi},${point.tvpi},${point.grossIrr},${point.netIrr}\n`;
    });
    
    return new Blob([csv], { type: 'text/csv' });
  }, [scenarios, activeScenarioId]);
  
  const resetToDefaults = useCallback(() => {
    setState(createDefaultState());
    setForecastResult(undefined);
    clearCalculationCache();
  }, []);
  
  const clearCache = useCallback(() => {
    clearCalculationCache();
    setPerformanceMetrics({
      averageCalculationTime: 0,
      cacheHitRate: 0,
      totalCalculations: 0
    });
  }, []);
  
  // ===== VALIDATION ON MOUNT =====
  useEffect(() => {
    validateAll();
  }, []);
  
  // ===== CONTEXT VALUE =====
  const contextValue: FundContextValue = useMemo(() => ({
    ...state,
    forecastResult,
    performanceMetrics,
    scenarios,
    activeScenarioId,
    validationResults,
    isValid,
    investableCapital,
    totalManagementFees,
    lpCommitment,
    gpCommitment,
    exportSettings,
    
    // Functions
    updateFundParameter,
    batchUpdate,
    updateStageStrategy,
    updateGraduationRate,
    addExpense,
    updateExpense,
    removeExpense,
    validateField,
    validateAll,
    calculateForecast,
    cancelCalculation,
    createScenario,
    switchScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
    updateExportSettings,
    exportScenario,
    importScenario,
    exportToExcel,
    resetToDefaults,
    clearCache
  }), [
    state,
    forecastResult,
    performanceMetrics,
    scenarios,
    activeScenarioId,
    validationResults,
    isValid,
    investableCapital,
    totalManagementFees,
    lpCommitment,
    gpCommitment,
    exportSettings,
    updateFundParameter,
    batchUpdate,
    updateStageStrategy,
    updateGraduationRate,
    addExpense,
    updateExpense,
    removeExpense,
    validateField,
    validateAll,
    calculateForecast,
    cancelCalculation,
    createScenario,
    switchScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
    updateExportSettings,
    exportScenario,
    importScenario,
    exportToExcel,
    resetToDefaults,
    clearCache
  ]);
  
  return (
    <FundContext.Provider value={contextValue}>
      {children}
    </FundContext.Provider>
  );
};

// ===== HOOK =====
export const useFundContext = (): FundContextValue => {
  const context = useContext(FundContext);
  if (!context) {
    throw new Error('useFundContext must be used within FundProvider');
  }
  return context;
};
