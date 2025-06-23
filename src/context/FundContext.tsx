import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  EnhancedFundInputs,
  ForecastResult,
  FundScenario,
  ValidationResult,
  ValidationError,
  StageStrategy,
  FundExpense,
  ExportSettings,
  BatchRunResult
} from '../types';
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
  updateExitProbability: (stage: string, field: string, value: number) => void;
  
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
  const [state, setState] = useState<FundState>(createDefaultState());
  const [forecastResult, setForecastResult] = useState<ForecastResult>();
  const [exportSettings, setExportSettings] = useState<ExportSettings>(defaultExportSettings);
  
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
    return feeBase * state.managementFeeRate * state.investmentPeriodYears;
  }, [state.fundSize, lpCommitment, state.managementFeeRate, state.investmentPeriodYears, state.includeGpInFees]);
  
  const investableCapital = useMemo(() => {
    return state.fundSize - totalManagementFees;
  }, [state.fundSize, totalManagementFees]);
  
  const isValid = useMemo(() => {
    return Array.from(validationResults.values()).every(result => result.isValid);
  }, [validationResults]);
  
  // ===== STATE UPDATE FUNCTIONS =====
  
  const updateFundParameter = useCallback(<K extends keyof FundState>(
    key: K,
    value: FundState[K]
  ) => {
    setState(prev => ({
      ...prev,
      [key]: value,
      isDirty: true
    }));
  }, []);
  
  const updateStageStrategy = useCallback((
    index: number,
    strategy: Partial<StageStrategy>
  ) => {
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
  
  const updateGraduationRate = useCallback((
    fromStage: string,
    toStage: string,
    rate: number
  ) => {
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
  
  const updateExitProbability = useCallback((
    stage: string,
    field: string,
    value: number
  ) => {
    setState(prev => ({
      ...prev,
      exitProbabilityMatrix: {
        ...prev.exitProbabilityMatrix!,
        [stage]: {
          ...prev.exitProbabilityMatrix![stage],
          [field]: value
        }
      },
      isDirty: true
    }));
  }, []);
  
  // ===== VALIDATION =====
  
  const validateField = useCallback((field: string, value: any): ValidationResult => {
    const result: ValidationResult = { field, isValid: true };
    
    switch (field) {
      case 'fundSize':
        if (!value || value <= 0) {
          result.isValid = false;
          result.error = 'Fund size must be positive';
        } else if (value < 10000000) {
          result.warning = 'Fund size below $10M may be too small for effective diversification';
        }
        break;
      
      case 'managementFeeRate':
        if (value < 0 || value > 0.1) {
          result.isValid = false;
          result.error = 'Management fee should be between 0% and 10%';
        } else if (value > 0.025) {
          result.warning = 'Management fee above 2.5% is high for most funds';
        }
        break;
      
      case 'carryPct':
        if (value < 0 || value > 0.5) {
          result.isValid = false;
          result.error = 'Carry should be between 0% and 50%';
        } else if (value !== 0.2) {
          result.warning = 'Standard carry is 20%';
        }
        break;
    }
    
    return result;
  }, []);
  
  const validateAll = useCallback(() => {
    const results = new Map<string, ValidationResult>();
    
    // Validate key fields
    results.set('fundSize', validateField('fundSize', state.fundSize));
    results.set('managementFeeRate', validateField('managementFeeRate', state.managementFeeRate));
    results.set('carryPct', validateField('carryPct', state.carryPct));
    
    // Validate stage strategies
    const totalAllocation = state.stageStrategies.reduce((sum, s) => sum + s.allocationPct, 0);
    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      results.set('stageStrategies', {
        field: 'stageStrategies',
        isValid: false,
        error: `Allocations must sum to 100% (currently ${(totalAllocation * 100).toFixed(1)}%)`
      });
    }
    
    setValidationResults(results);
    return results;
  }, [state, validateField]);
  
  // ===== CALCULATION =====
  
  const calculateForecast = useCallback(async () => {
    if (!isValid) {
      console.warn('Cannot calculate forecast with validation errors');
      return;
    }
    
    setState(prev => ({ ...prev, isCalculating: true }));
    
    try {
      const result = await buildEnhancedFundForecast(state);
      setForecastResult(result);
      
      setState(prev => ({
        ...prev,
        isCalculating: false,
        isDirty: false,
        lastCalculation: new Date(),
        validationErrors: []
      }));
    } catch (error) {
      console.error('Forecast calculation failed:', error);
      setState(prev => ({
        ...prev,
        isCalculating: false,
        validationErrors: [{
          field: 'general',
          message: error instanceof Error ? error.message : 'Calculation failed',
          code: 'CALC_ERROR',
          severity: 'error'
        }]
      }));
    }
  }, [state, isValid]);
  
  // ===== SCENARIO MANAGEMENT =====
  
  const createScenario = useCallback((name: string, description?: string): string => {
    const newId = `scenario-${Date.now()}`;
    const newScenario: FundScenario = {
      id: newId,
      name,
      description,
      createdAt: new Date(),
      inputs: { ...state },
      results: forecastResult
    };
    
    setScenarios(prev => [...prev, newScenario]);
    return newId;
  }, [state, forecastResult]);
  
  const switchScenario = useCallback((id: string) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;
    
    setState(scenario.inputs);
    setForecastResult(scenario.results);
    setActiveScenarioId(id);
  }, [scenarios]);
  
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
      switchScenario(remaining[0].id);
    }
  }, [scenarios, activeScenarioId, switchScenario]);
  
  const duplicateScenario = useCallback((id: string, newName: string): string => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return '';
    
    return createScenario(newName, `Copy of ${scenario.description || scenario.name}`);
  }, [scenarios, createScenario]);
  
  // ===== UTILITIES =====
  
  const updateExportSettings = useCallback((settings: Partial<ExportSettings>) => {
    setExportSettings(prev => ({ ...prev, ...settings }));
  }, []);
  
  const resetToDefaults = useCallback(() => {
    setState(createDefaultState());
    setForecastResult(undefined);
  }, []);
  
  // ===== AUTO VALIDATION =====
  
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
    
    updateFundParameter,
    updateStageStrategy,
    updateGraduationRate,
    updateExitProbability,
    validateField,
    validateAll,
    calculateForecast,
    createScenario,
    switchScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
    updateExportSettings,
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
