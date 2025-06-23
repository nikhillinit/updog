// src/types/index.ts

import Decimal from 'decimal.js';

// ===== CORE FUND TYPES =====

export interface StageStrategy {
  stage: string;
  allocationPct: number;
  avgInvestmentSize: number;
  numFirstChecks?: number;
  graduationRate: number;
  weightedExitValue: number;
  exitMultiple: number;
  avgExitQuarter: number;
}

export interface GraduationMatrix {
  [fromStage: string]: {
    [toStage: string]: number;
  };
}

export interface ExitProbabilityMatrix {
  [stage: string]: {
    fail: number;
    low: number;
    med: number;
    high: number;
    mega: number;
    success?: number; // computed as 1 - fail
  };
}

export interface FundExpense {
  id: string;
  category: string;
  amount: number;
  startQuarter: number;
  endQuarter: number;
  isAnnual?: boolean;
}

export interface FeeProfile {
  name: string;
  value: number; // percentage
  basis: 'LP Committed Capital' | 'Invested Capital' | 'Fund Size';
  startQuarter: number;
  endQuarter: number;
}

// ===== ENHANCED FUND INPUTS =====

export interface EnhancedFundInputs {
  // Basic Fund Parameters
  fundName: string;
  fundSize: number;
  managementFeeRate: number;
  carryPct: number;
  hurdleRate?: number;
  gpCommitmentPct: number;
  includeGpInFees: boolean;
  
  // Fund Structure
  fundLifeYears: number;
  investmentPeriodYears: number;
  fundLifeQuarters: number;
  investPeriodQuarters: number;
  
  // Strategy
  stageStrategies: StageStrategy[];
  graduationMatrix: GraduationMatrix;
  exitProbabilityMatrix: ExitProbabilityMatrix;
  
  // Advanced
  feeProfiles: FeeProfile[];
  expenses: FundExpense[];
  waterfallType: 'american' | 'european';
}

// ===== PORTFOLIO TYPES =====

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
  yearQuarter: string; // "Y1Q1" format
  
  // Cash flows
  contributions: number;
  distributions: number;
  managementFees: number;
  
  // Running totals
  cumulativeContributions: number;
  cumulativeDistributions: number;
  nav: number;
  
  // Performance metrics
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
  // Core results
  timeline: CashFlowPoint[];
  portfolio: PortfolioCompany[];
  companyResults: CompanyResult[];
  waterfallSummary: WaterfallSummary;
  
  // Summary metrics
  totalInvested: number;
  totalExitValue: number;
  totalManagementFees: number;
  totalGpCarry: number;
  totalLpProfit: number;
  
  // Performance metrics
  grossMoic: number;
  netMoic: number;
  grossIrr: number;
  netIrr: number;
  tvpi: number;
  dpi: number;
  rvpi: number;
  
  // Meta information
  calculationDate: Date;
  fundLifeQuarters: number;
  
  // Intermediate data for analysis
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

// ===== ERROR HANDLING =====

export class FundModelError extends Error {
  constructor(public code: string, message: string, public details?: any) {
    super(message);
    this.name = 'FundModelError';
  }
}

// ===== UTILITY TYPES =====

export type TimeInterval = 'Quarter' | 'Year' | 'Month';
export type WaterfallType = 'american' | 'european';
export type CompanyStatus = 'active' | 'exited' | 'written-off';
export type ExitOutcome = 'fail' | 'low' | 'med' | 'high' | 'mega';

// ===== EXPORT TYPES =====

export interface ExportSettings {
  includeCashFlows: boolean;
  includeCompanyDetails: boolean;
  includeAssumptions: boolean;
  includeCharts: boolean;
  format: 'excel' | 'csv' | 'pdf' | 'json';
  lpFriendly: boolean;
}

export interface ExportResult {
  filename: string;
  data: Blob | string;
  mimeType: string;
  sheets?: Record<string, string>; // For multi-sheet exports
}
