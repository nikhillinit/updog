// src/shared/enhanced-fund-model.ts

import Decimal from 'decimal.js';
import {
  EnhancedFundInputs,
  ForecastResult,
  PortfolioCompany,
  Investment,
  CashFlowPoint,
  CompanyResult,
  WaterfallSummary,
  FundModelError,
  ValidationError
} from '../types/index';

// ===== CONFIGURATION =====

Decimal.config({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
});

// ===== DEFAULT VALUES =====

export const DEFAULT_FUND_PARAMS = {
  fundName: 'Press On Ventures Fund I',
  fundSize: 20000000,
  managementFeeRate: 0.02,
  carryPct: 0.20,
  hurdleRate: 0,
  gpCommitmentPct: 2,
  includeGpInFees: false,
  fundLifeYears: 10,
  investmentPeriodYears: 5,
  fundLifeQuarters: 40,
  investPeriodQuarters: 20,
  waterfallType: 'american' as const
};

export const DEFAULT_STAGE_STRATEGIES = [
  {
    stage: 'Pre-Seed',
    allocationPct: 0.43,
    avgInvestmentSize: 250000,
    graduationRate: 0.30,
    weightedExitValue: 17500000,
    exitMultiple: 15,
    avgExitQuarter: 16
  },
  {
    stage: 'Seed',
    allocationPct: 0.43,
    avgInvestmentSize: 400000,
    graduationRate: 0.35,
    weightedExitValue: 39500000,
    exitMultiple: 20,
    avgExitQuarter: 20
  },
  {
    stage: 'Series A',
    allocationPct: 0.14,
    avgInvestmentSize: 600000,
    graduationRate: 0.50,
    weightedExitValue: 71750000,
    exitMultiple: 12,
    avgExitQuarter: 24
  }
];

export const DEFAULT_GRADUATION_MATRIX = {
  'Pre-Seed': { 'Seed': 0.30, 'Series A': 0.12, 'Series B': 0.06 },
  'Seed': { 'Series A': 0.35, 'Series B': 0.20, 'Series C': 0.12 },
  'Series A': { 'Series B': 0.50, 'Series C': 0.30, 'Series D+': 0.21 },
  'Series B': { 'Series C': 0.50, 'Series D+': 0.35 },
  'Series C': { 'Series D+': 0.60 },
  'Series D+': { 'Exit': 1.00 }
};

export const DEFAULT_EXIT_PROBABILITIES = {
  'Pre-Seed': { fail: 0.90, low: 0.06, med: 0.02, high: 0.01, mega: 0.01 },
  'Seed': { fail: 0.80, low: 0.10, med: 0.05, high: 0.03, mega: 0.02 },
  'Series A': { fail: 0.65, low: 0.15, med: 0.10, high: 0.07, mega: 0.03 },
  'Series B': { fail: 0.50, low: 0.20, med: 0.15, high: 0.10, mega: 0.05 },
  'Series C': { fail: 0.35, low: 0.25, med: 0.20, high: 0.15, mega: 0.05 },
  'Series D+': { fail: 0.10, low: 0.20, med: 0.30, high: 0.25, mega: 0.15 }
};

// ===== VALIDATION =====

export function validateEnhancedInputs(inputs: EnhancedFundInputs): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Fund size validation
  if (!inputs.fundSize || inputs.fundSize <= 0) {
    errors.push({
      field: 'fundSize',
      message: 'Fund size must be positive',
      code: 'INVALID_FUND_SIZE',
      severity: 'error'
    });
  }
  
  // Stage strategies validation
  if (!inputs.stageStrategies || inputs.stageStrategies.length === 0) {
    errors.push({
      field: 'stageStrategies',
      message: 'At least one stage strategy is required',
      code: 'MISSING_STAGE_STRATEGIES',
      severity: 'error'
    });
  } else {
    // Validate allocations sum to ~100%
    const totalAllocation = inputs.stageStrategies.reduce((sum, s) => sum + s.allocationPct, 0);
    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      errors.push({
        field: 'stageStrategies',
        message: `Stage allocations must sum to 100% (currently ${(totalAllocation * 100).toFixed(1)}%)`,
        code: 'INVALID_ALLOCATION_SUM',
        severity: 'error'
      });
    }
    
    // Validate individual strategies
    inputs.stageStrategies.forEach((strategy, index) => {
      if (strategy.avgInvestmentSize <= 0) {
        errors.push({
          field: `stageStrategies[${index}].avgInvestmentSize`,
          message: `Average investment size must be positive for ${strategy.stage}`,
          code: 'INVALID_INVESTMENT_SIZE',
          severity: 'error'
        });
      }
      
      if (strategy.allocationPct < 0 || strategy.allocationPct > 1) {
        errors.push({
          field: `stageStrategies[${index}].allocationPct`,
          message: `Allocation percentage must be between 0 and 1 for ${strategy.stage}`,
          code: 'INVALID_ALLOCATION_PCT',
          severity: 'error'
        });
      }
    });
  }
  
  // Management fee validation
  if (inputs.managementFeeRate < 0 || inputs.managementFeeRate > 0.1) {
    errors.push({
      field: 'managementFeeRate',
      message: 'Management fee rate should be between 0% and 10%',
      code: 'INVALID_MGMT_FEE',
      severity: 'warning'
    });
  }
  
  // Carry validation
  if (inputs.carryPct < 0 || inputs.carryPct > 0.5) {
    errors.push({
      field: 'carryPct',
      message: 'Carry percentage should be between 0% and 50%',
      code: 'INVALID_CARRY',
      severity: 'warning'
    });
  }
  
  return errors;
}

// ===== PORTFOLIO GENERATION =====

export function buildPortfolioFromStrategy(inputs: EnhancedFundInputs): PortfolioCompany[] {
  const portfolio: PortfolioCompany[] = [];
  
  // Calculate investable capital
  const gpCommitment = new Decimal(inputs.fundSize).times(inputs.gpCommitmentPct).dividedBy(100);
  const lpCommitment = new Decimal(inputs.fundSize).minus(gpCommitment);
  const feeBase = inputs.includeGpInFees ? inputs.fundSize : lpCommitment.toNumber();
  const totalManagementFees = new Decimal(feeBase)
    .times(inputs.managementFeeRate)
    .times(inputs.fundLifeYears);
  const investableCapital = new Decimal(inputs.fundSize).minus(totalManagementFees);
  
  // Generate companies for each stage
  inputs.stageStrategies.forEach((strategy, strategyIndex) => {
    const stageCapital = investableCapital.times(strategy.allocationPct);
    const numCompanies = Math.floor(stageCapital.dividedBy(strategy.avgInvestmentSize).toNumber());
    
    for (let i = 0; i < numCompanies; i++) {
      const companyId = `${strategy.stage.toLowerCase().replace(/\s+/g, '-')}-${strategyIndex}-${i + 1}`;
      
      // Initial investment
      const initialInvestment: Investment = {
        stage: strategy.stage,
        amount: strategy.avgInvestmentSize,
        quarter: Math.floor(Math.random() * inputs.investPeriodQuarters),
        ownership: strategy.avgInvestmentSize / (strategy.avgInvestmentSize / 0.05), // Assume 5% ownership
        isFollowOn: false
      };
      
      // Determine exit characteristics
      const exitProbs = inputs.exitProbabilityMatrix[strategy.stage] || DEFAULT_EXIT_PROBABILITIES[strategy.stage];
      const random = Math.random();
      let exitOutcome: 'fail' | 'low' | 'med' | 'high' | 'mega' = 'fail';
      let exitMultiple = 0;
      
      if (random > exitProbs.fail) {
        if (random > exitProbs.fail + exitProbs.low) {
          if (random > exitProbs.fail + exitProbs.low + exitProbs.med) {
            if (random > exitProbs.fail + exitProbs.low + exitProbs.med + exitProbs.high) {
              exitOutcome = 'mega';
              exitMultiple = 50 + Math.random() * 100; // 50-150x
            } else {
              exitOutcome = 'high';
              exitMultiple = 10 + Math.random() * 40; // 10-50x
            }
          } else {
            exitOutcome = 'med';
            exitMultiple = 3 + Math.random() * 7; // 3-10x
          }
        } else {
          exitOutcome = 'low';
          exitMultiple = 1 + Math.random() * 2; // 1-3x
        }
      }
      
      const company: PortfolioCompany = {
        id: companyId,
        name: `Company ${companyId}`,
        entryStage: strategy.stage,
        currentStage: strategy.stage,
        investments: [initialInvestment],
        totalInvested: strategy.avgInvestmentSize,
        exitValue: exitMultiple > 0 ? strategy.avgInvestmentSize * exitMultiple : 0,
        exitQuarter: exitMultiple > 0 ? strategy.avgExitQuarter + Math.floor(Math.random() * 8) : undefined,
        status: exitMultiple > 0 ? 'active' : 'written-off'
      };
      
      portfolio.push(company);
    }
  });
  
  return portfolio;
}

// ===== PORTFOLIO PROGRESSION SIMULATION =====

export function simulatePortfolioProgression(
  portfolio: PortfolioCompany[], 
  inputs: EnhancedFundInputs
): PortfolioCompany[] {
  return portfolio.map(company => {
    // Simulate follow-on investments based on graduation matrix
    const updatedCompany = { ...company, investments: [...company.investments] };
    
    // Check for graduation and follow-on opportunities
    const graduationRates = inputs.graduationMatrix[company.currentStage] || {};
    const hasSuccessfulGraduation = Object.values(graduationRates).some(rate => Math.random() < rate);
    
    if (hasSuccessfulGraduation && company.status === 'active') {
      // Add follow-on investment
      const followOnAmount = company.investments[0].amount * (0.5 + Math.random() * 1.0); // 0.5-1.5x initial
      const followOnInvestment: Investment = {
        stage: company.currentStage,
        amount: followOnAmount,
        quarter: company.investments[0].quarter + 4 + Math.floor(Math.random() * 8),
        ownership: followOnAmount / (followOnAmount / 0.03), // Assume 3% additional ownership
        isFollowOn: true
      };
      
      updatedCompany.investments.push(followOnInvestment);
      updatedCompany.totalInvested += followOnAmount;
      
      // Update exit value proportionally
      if (updatedCompany.exitValue) {
        updatedCompany.exitValue *= 1.2; // 20% boost for follow-on
      }
    }
    
    return updatedCompany;
  });
}

// ===== AMERICAN WATERFALL CALCULATION =====

export function calculateAmericanWaterfall(
  totalInvested: number,
  totalExitValue: number,
  carryPct: number,
  hurdleRate: number = 0
): WaterfallSummary {
  const invested = new Decimal(totalInvested);
  const exitValue = new Decimal(totalExitValue);
  const profit = exitValue.minus(invested);
  
  if (profit.lte(0)) {
    return {
      totalInvested,
      totalExitValue,
      totalProfit: 0,
      lpReturnOfCapital: Math.min(totalExitValue, totalInvested),
      lpPreferredReturn: 0,
      gpCatchUp: 0,
      gpCarry: 0,
      lpCarry: 0,
      finalLpProceeds: totalExitValue,
      finalGpProceeds: 0
    };
  }
  
  // American waterfall (deal-by-deal carry)
  // 1. Return of capital to LPs
  const lpReturnOfCapital = invested.toNumber();
  
  // 2. Preferred return to LPs (if any)
  const preferredReturn = invested.times(hurdleRate);
  const lpPreferredReturn = preferredReturn.toNumber();
  
  // 3. GP carry on profit
  const profitAfterHurdle = profit.minus(preferredReturn);
  const gpCarry = Decimal.max(0, profitAfterHurdle.times(carryPct));
  const lpCarry = profitAfterHurdle.minus(gpCarry);
  
  return {
    totalInvested,
    totalExitValue,
    totalProfit: profit.toNumber(),
    lpReturnOfCapital,
    lpPreferredReturn,
    gpCatchUp: 0, // No catch-up in American waterfall
    gpCarry: gpCarry.toNumber(),
    lpCarry: lpCarry.toNumber(),
    finalLpProceeds: lpReturnOfCapital + lpPreferredReturn + lpCarry.toNumber(),
    finalGpProceeds: gpCarry.toNumber()
  };
}

// ===== IRR CALCULATION =====

export function calculateIRR(cashFlows: number[]): number {
  // Simple IRR calculation using Newton-Raphson method
  if (cashFlows.length === 0) return 0;
  
  let rate = 0.1; // Initial guess
  const tolerance = 1e-6;
  const maxIterations = 100;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    
    for (let j = 0; j < cashFlows.length; j++) {
      const period = j;
      npv += cashFlows[j] / Math.pow(1 + rate, period);
      dnpv -= (period * cashFlows[j]) / Math.pow(1 + rate, period + 1);
    }
    
    if (Math.abs(npv) < tolerance) break;
    if (Math.abs(dnpv) < tolerance) break;
    
    rate = rate - npv / dnpv;
  }
  
  return isNaN(rate) || !isFinite(rate) ? 0 : rate;
}

// ===== MAIN FORECAST FUNCTION =====

export function buildEnhancedFundForecast(inputs: EnhancedFundInputs): ForecastResult {
  // Validate inputs
  const errors = validateEnhancedInputs(inputs);
  const criticalErrors = errors.filter(e => e.severity === 'error');
  if (criticalErrors.length > 0) {
    throw new FundModelError(
      'VALIDATION_ERROR', 
      `Validation failed: ${criticalErrors.map(e => e.message).join('; ')}`,
      criticalErrors
    );
  }
  
  // Build portfolio
  let portfolio = buildPortfolioFromStrategy(inputs);
  portfolio = simulatePortfolioProgression(portfolio, inputs);
  
  // Calculate company-level results
  const companyResults: CompanyResult[] = portfolio.map(company => {
    const invested = company.totalInvested;
    const exitProceeds = company.exitValue || 0;
    const profit = exitProceeds - invested;
    const carry = Math.max(0, profit * inputs.carryPct);
    const lpProfit = profit - carry;
    
    return {
      companyId: company.id,
      invested,
      exitProceeds,
      profit,
      carry,
      lpProfit,
      multiple: invested > 0 ? exitProceeds / invested : 0
    };
  });
  
  // Aggregate metrics
  const totalInvested = companyResults.reduce((sum, r) => sum + r.invested, 0);
  const totalExitValue = companyResults.reduce((sum, r) => sum + r.exitProceeds, 0);
  
  // Calculate waterfall
  const waterfallSummary = calculateAmericanWaterfall(
    totalInvested,
    totalExitValue,
    inputs.carryPct,
    inputs.hurdleRate || 0
  );
  
  // Calculate management fees
  const gpCommitment = inputs.fundSize * (inputs.gpCommitmentPct / 100);
  const lpCommitment = inputs.fundSize - gpCommitment;
  const feeBase = inputs.includeGpInFees ? inputs.fundSize : lpCommitment;
  const quarterlyMgmtFee = feeBase * inputs.managementFeeRate / 4;
  const totalManagementFees = quarterlyMgmtFee * inputs.fundLifeQuarters;
  
  // Build timeline
  const timeline: CashFlowPoint[] = [];
  const quarterlyDeployments: number[] = [];
  const quarterlyNAVs: number[] = [];
  const quarterlyDistributions: number[] = [];
  const quarterlyManagementFees: number[] = [];
  
  let cumulativeContributions = 0;
  let cumulativeDistributions = 0;
  let nav = 0;
  
  // Simple deployment schedule (front-loaded)
  const totalDeployments = totalInvested;
  const deploymentsPerQuarter = totalDeployments / inputs.investPeriodQuarters;
  
  // Simple distribution schedule (starts in year 3)
  const distributionStartQuarter = 12;
  const distributionPeriod = inputs.fundLifeQuarters - distributionStartQuarter;
  const distributionsPerQuarter = totalExitValue / distributionPeriod;
  
  for (let quarter = 0; quarter <= inputs.fundLifeQuarters; quarter++) {
    const year = quarter / 4;
    const yearQuarter = `Y${Math.floor(year) + 1}Q${(quarter % 4) + 1}`;
    
    // Capital contributions (100% called immediately)
    const contribution = quarter === 0 ? inputs.fundSize : 0;
    cumulativeContributions += contribution;
    
    // Deployments
    const deployment = quarter <= inputs.investPeriodQuarters ? deploymentsPerQuarter : 0;
    quarterlyDeployments.push(deployment);
    
    // Distributions
    const distribution = quarter >= distributionStartQuarter ? distributionsPerQuarter : 0;
    cumulativeDistributions += distribution;
    quarterlyDistributions.push(distribution);
    
    // Management fees
    const mgmtFee = quarter > 0 ? quarterlyMgmtFee : 0;
    quarterlyManagementFees.push(mgmtFee);
    
    // NAV calculation
    const investedToDate = Math.min(totalInvested, quarter * deploymentsPerQuarter);
    const unrealizedValue = totalExitValue - cumulativeDistributions;
    nav = Math.max(0, unrealizedValue);
    quarterlyNAVs.push(nav);
    
    // Performance ratios
    const dpi = cumulativeContributions > 0 ? cumulativeDistributions / cumulativeContributions : 0;
    const rvpi = cumulativeContributions > 0 ? nav / cumulativeContributions : 0;
    const tvpi = dpi + rvpi;
    
    // IRR calculation (simplified)
    const cashFlows = [-cumulativeContributions, cumulativeDistributions + nav];
    const grossIrr = calculateIRR(cashFlows);
    const netIrr = grossIrr - (totalManagementFees / inputs.fundSize) / inputs.fundLifeYears;
    
    timeline.push({
      quarter,
      year,
      yearQuarter,
      contributions: contribution,
      distributions: distribution,
      managementFees: mgmtFee,
      cumulativeContributions,
      cumulativeDistributions,
      nav,
      dpi,
      rvpi,
      tvpi,
      moic: totalInvested > 0 ? totalExitValue / totalInvested : 0,
      netMoic: totalInvested > 0 ? (totalExitValue - totalManagementFees) / totalInvested : 0,
      grossIrr,
      netIrr
    });
  }
  
  return {
    timeline,
    portfolio,
    companyResults,
    waterfallSummary,
    totalInvested,
    totalExitValue,
    totalManagementFees,
    totalGpCarry: waterfallSummary.gpCarry,
    totalLpProfit: waterfallSummary.finalLpProceeds,
    grossMoic: totalInvested > 0 ? totalExitValue / totalInvested : 0,
    netMoic: totalInvested > 0 ? (totalExitValue - totalManagementFees) / totalInvested : 0,
    grossIrr: timeline[timeline.length - 1]?.grossIrr || 0,
    netIrr: timeline[timeline.length - 1]?.netIrr || 0,
    tvpi: timeline[timeline.length - 1]?.tvpi || 0,
    dpi: timeline[timeline.length - 1]?.dpi || 0,
    rvpi: timeline[timeline.length - 1]?.rvpi || 0,
    calculationDate: new Date(),
    fundLifeQuarters: inputs.fundLifeQuarters,
    intermediates: {
      quarterlyDeployments,
      quarterlyNAVs,
      quarterlyDistributions,
      quarterlyManagementFees,
      companiesCreated: portfolio.length,
      companiesExited: portfolio.filter(c => c.status === 'exited').length,
      companiesWrittenOff: portfolio.filter(c => c.status === 'written-off').length
    }
  };
}
