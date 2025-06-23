import Decimal from 'decimal.js';

// ===== FUND PARAMETERS =====

export interface EnhancedFundInputs {
  // Basic fund info
  fundName: string;
  fundSize: number;
  vintageYear: number;
  
  // Economics
  managementFeeRate: number;
  carryPct: number;
  hurdleRate: number;
  gpCommitmentPct: number;
  includeGpInFees: boolean;
  
  // Timing
  investmentPeriodYears: number;
  fundLifeYears: number;
  extensionYears?: number;
  
  // Strategy
  stageStrategies: StageStrategy[];
  graduationMatrix: GraduationMatrix;
  exitProbabilityMatrix?: ExitProbabilityMatrix;
  
  // Reserve strategy
  followOnReserveRatio: number;
  recyclingEnabled: boolean;
  recyclingCap?: number;
  
  // Advanced options
  feeProfiles?: FeeProfile[];
  expenses?: FundExpense[];
  waterfallType?: 'american' | 'european';
}

export interface StageStrategy {
  stage: string;
  allocationPct: number;
  numFirstChecks: number;
  avgInvestmentSize: number;
  graduationRate: number;
  weightedExitValue: number;
}

export interface GraduationMatrix {
  [fromStage: string]: {
    [toStage: string]: number;
  };
}

export interface ExitProbabilityMatrix {
  [stage: string]: {
    failure: number;
    lowMultiple: number;
    mediumMultiple: number;
    highMultiple: number;
    homeRun: number;
  };
}

export interface FeeProfile {
  name: string;
  value: number;
  basis: string;
  startQuarter: number;
  endQuarter: number;
}

export interface FundExpense {
  id: string;
  name: string;
  amount: number;
  timing: 'upfront' | 'annual' | 'quarterly';
  startQuarter?: number;
  endQuarter?: number;
}

// ===== PORTFOLIO COMPANY =====

export interface Investment {
  stage: string;
  amount: number;
  quarter: number;
  ownership?: number;
  valuation?: number;
  isFollowOn?: boolean;
}

export interface PortfolioCompany {
  id: string;
  name: string;
  entryStage: string;
  currentStage: string;
  investments: Investment[];
  totalInvested: number;
  currentValuation?: number;
  exitValue?: number;
  exitQuarter?: number;
  status: "active" | "exited" | "written-off";
  sector?: string;
  geography?: string;
}

// ===== FORECAST RESULTS =====

export interface CashFlowPoint {
  quarter: number;
  year: number;
  yearQuarter: string;
  
  contributions: number;
  distributions: number;
  managementFees: number;
  
  cumulativeContributions: number;
  cumulativeDistributions: number;
  nav: number;
  
  dpi: number;
  rvpi: number;
  tvpi: number;
  moic: number;
  netMoic: number;
  grossIrr: number;
  netIrr: number;
}

export interface CompanyResult {
  companyId: string;
  invested: number;
  exitProceeds: number;
  profit: number;
  carry: number;
  lpProfit: number;
  multiple: number;
}

export interface WaterfallSummary {
  totalInvested: number;
  totalExitValue: number;
  totalProfit: number;
  lpReturnOfCapital: number;
  lpPreferredReturn: number;
  gpCatchUp: number;
  gpCarry: number;
  lpCarry: number;
  finalLpProceeds: number;
  finalGpProceeds: number;
}

export interface ForecastResult {
  timeline: CashFlowPoint[];
  portfolio: PortfolioCompany[];
  companyResults: CompanyResult[];
  waterfallSummary: WaterfallSummary;
  
  totalInvested: number;
  totalExitValue: number;
  totalManagementFees: number;
  totalGpCarry: number;
  totalLpProfit: number;
  
  grossMoic: number;
  netMoic: number;
  grossIrr: number;
  netIrr: number;
  tvpi: number;
  dpi: number;
  rvpi: number;
  
  calculationDate: Date;
  fundLifeQuarters: number;
  
  intermediates: {
    quarterlyDeployments: number[];
    quarterlyNAVs: number[];
    quarterlyDistributions: number[];
    quarterlyManagementFees: number[];
    companiesCreated: number;
    companiesExited: number;
    companiesWrittenOff: number;
  };
}

// ===== SCENARIO MANAGEMENT =====

export interface FundScenario {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  inputs: EnhancedFundInputs;
  results?: ForecastResult;
  isBaseline?: boolean;
}

export interface BatchRunResult {
  scenarioId: string;
  scenarioName: string;
  description?: string;
  inputs: Partial<EnhancedFundInputs>;
  result: ForecastResult;
  metrics: {
    grossMoic: number;
    netMoic: number;
    grossIrr: number;
    netIrr: number;
    tvpi: number;
    dpi: number;
    totalInvested: number;
    totalExitValue: number;
    successRate: number;
  };
  executionTime: number;
}

// ===== VALIDATION =====

export interface ValidationResult {
  field: string;
  isValid: boolean;
  error?: string;
  warning?: string;
  suggestion?: {
    value: any;
    message: string;
  };
  severity?: 'error' | 'warning' | 'info';
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

// ===== EXPORT SETTINGS =====

export interface ExportSettings {
  includeCashFlows: boolean;
  includeCompanyDetails: boolean;
  includeAssumptions: boolean;
  includeCharts: boolean;
  format: 'excel' | 'csv' | 'pdf';
  lpFriendly: boolean;
}

// ===== ERROR HANDLING =====

export class FundModelError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FundModelError';
  }
}
