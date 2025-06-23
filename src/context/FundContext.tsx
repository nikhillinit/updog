// src/context/FundContext.tsx

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
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
  validateEnhancedInputs
} from '../shared/enhanced-fund-model';

// ===== CONTEXT INTERFACES =====

interface FundState extends EnhancedFundInputs {
  // Additional state properties
  isDirty: boolean;
  isCalculating: boolean;
  lastCalculation?: Date;
  calculationProgress?: number;
  validationErrors: ValidationError[];
}

interface FundContextValue extends FundState {
  // Results
  forecastResult?: ForecastResult;
  
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
  
  // Validation
  validationResults: Map<string, ValidationResult>;
  validateField: (field: string, value: any) => ValidationResult;
  validateAll: () => Map<string, ValidationResult>;
  isValid: boolean;
  
  // Calculations
  calculateForecast: () => Promise<void>;
  
  // Export
  exportSettings: ExportSettings;
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  exportScenario: (id: string) => string;
  importScenario: (data: string) => string;
  
  // Computed Values
  investableCapital: number;
  totalManagementFees: number;
  lpCommitment: number;
  gpCommitment: number;
  
  // Utilities
  resetToDefaults: () => void;
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
  
  // Debounced calculation
  const [calculationTimeout, setCalculationTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // ===== COMPUTED VALUES =====
  
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
    
    try {
      // Simulate calculation progress
      const progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          calculationProgress: Math.min((prev.calculationProgress || 0) + 10, 90)
        }));
      }, 50);
      
      // Perform calculation
      const result = await new Promise<ForecastResult>((resolve) => {
        setTimeout(() => {
          const forecast = buildEnhancedFundForecast(state);
          resolve(forecast);
        }, 300); // Simulate calculation time
      });
      
      clearInterval(progressInterval);
      
      setForecastResult(result);
      setState(prev => ({
        ...prev,
        isCalculating: false,
        calculationProgress: 100,
        lastCalculation: new Date(),
        isDirty: false
      }));
      
      // Update active scenario with results
      setScenarios(prev => prev.map(scenario =>
        scenario.id === activeScenarioId
          ? { ...scenario, results: result, inputs: state }
          : scenario
      ));
      
    } catch (error) {
      console.error('Calculation failed:', error);
      setState(prev => ({
        ...prev,
        isCalculating: false,
        calculationProgress: 0
      }));
    }
  }, [state, isValid, activeScenarioId]);
  
  // ===== AUTO-CALCULATION =====
  
  useEffect(() => {
    if (state.isDirty && isValid) {
      if (calculationTimeout) {
        clearTimeout(calculationTimeout);
      }
      
      const timeout = setTimeout(() => {
        calculateForecast();
      }, 1000); // 1 second debounce
      
      setCalculationTimeout(timeout);
      
      return () => clearTimeout(timeout);
    }
  }, [state.isDirty, isValid, calculateForecast, calculationTimeout]);
  
  // ===== STATE UPDATES =====
  
  const updateFundParameter = useCallback(<K extends keyof FundState>(key: K, value: FundState[K]) => {
    setState(prev => ({
      ...prev,
      [key]: value,
      isDirty: true
    }));
  }, []);
  
  const updateStageStrategy = useCallback((index: number, strategy: Partial<StageStrategy>) => {
    setState(prev => ({
      ...prev,
      stageStrategies: prev.stageStrategies.map((s, i) =>
        i === index ? { ...s, ...strategy } : s
      ),
      isDirty: true
    }));
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
      setState(scenario.inputs);
      setForecastResult(scenario.results);
      setActiveScenarioId(id);
    }
  }, [scenarios]);
  
  const updateScenario = useCallback((id: string, updates: Partial<FundScenario>) => {
    setScenarios(prev => prev.map(scenario =>
      scenario.id === id ? { ...scenario, ...updates } : scenario
    ));
  }, []);
  
  const deleteScenario = useCallback((id: string) => {
    if (scenarios.length <= 1) return; // Don't delete last scenario
    
    setScenarios(prev => prev.filter(s => s.id !== id));
    
    if (activeScenarioId === id) {
      const remaining = scenarios.filter(s => s.id !== id);
      switchScenario(remaining[0].id);
    }
  }, [scenarios, activeScenarioId, switchScenario]);
  
  const duplicateScenario = useCallback((id: string, newName: string): string => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return '';
    
    return createScenario(newName, `Copy of ${scenario.description || scenario.name}`);
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
  
  const resetToDefaults = useCallback(() => {
    setState(createDefaultState());
    setForecastResult(undefined);
  }, []);
  
  // ===== VALIDATION ON MOUNT =====
  
  useEffect(() => {
    validateAll();
  }, [validateAll]);
  
  // ===== CONTEXT VALUE =====
  
  const contextValue: FundContextValue = {
    ...state,
    forecastResult,
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
    updateStageStrategy,
    updateGraduationRate,
    addExpense,
    updateExpense,
    removeExpense,
    validateField,
    validateAll,
    calculateForecast,
    createScenario,
    switchScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
    updateExportSettings,
    exportScenario,
    importScenario,
    resetToDefaults
  };
  
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
