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

// ===== MEMOIZATION CACHE =====
const calculationCache = new Map<string, ForecastResult>();
const CACHE_SIZE_LIMIT = 100;

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

// ===== PERFORMANCE MONITORING =====
const performanceMetrics = {
  calculationTimes: [] as number[],
  cacheHits: 0,
  cacheMisses: 0,
  
  recordCalculation(timeMs: number) {
    this.calculationTimes.push(timeMs);
    if (this.calculationTimes.length > 100) {
      this.calculationTimes.shift();
    }
  },
  
  getAverageCalculationTime() {
    if (this.calculationTimes.length === 0) return 0;
    return this.calculationTimes.reduce((a, b) => a + b, 0) / this.calculationTimes.length;
  },
  
  getCacheHitRate() {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }
};

// ===== VALIDATION WITH TYPE GUARDS =====
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

function isValidStageStrategy(strategy: unknown): strategy is StageStrategy {
  if (!strategy || typeof strategy !== 'object') return false;
  const s = strategy as any;
  return (
    typeof s.stage === 'string' &&
    isValidNumber(s.allocationPct) &&
    isValidNumber(s.avgInvestmentSize) &&
    isValidNumber(s.graduationRate) &&
    isValidNumber(s.weightedExitValue) &&
    isValidNumber(s.exitMultiple) &&
    isValidNumber(s.avgExitQuarter)
  );
}

export function validateEnhancedInputs(inputs: EnhancedFundInputs): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Fund size validation with type guard
  if (!isValidNumber(inputs.fundSize) || inputs.fundSize <= 0) {
    errors.push({
      field: 'fundSize',
      message: 'Fund size must be a positive number',
      code: 'INVALID_FUND_SIZE',
      severity: 'error'
    });
  }
  
  // Stage strategies validation
  if (!Array.isArray(inputs.stageStrategies) || inputs.stageStrategies.length === 0) {
    errors.push({
      field: 'stageStrategies',
      message: 'At least one stage strategy is required',
      code: 'MISSING_STAGE_STRATEGIES',
      severity: 'error'
    });
  } else {
    // Validate each strategy with type guard
    inputs.stageStrategies.forEach((strategy, index) => {
      if (!isValidStageStrategy(strategy)) {
        errors.push({
          field: `stageStrategies[${index}]`,
          message: `Invalid stage strategy at index ${index}`,
          code: 'INVALID_STAGE_STRATEGY',
          severity: 'error'
        });
        return;
      }
      
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
    
    // Validate allocations sum
    const totalAllocation = inputs.stageStrategies
      .filter(isValidStageStrategy)
      .reduce((sum, s) => sum + s.allocationPct, 0);
      
    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      errors.push({
        field: 'stageStrategies',
        message: `Stage allocations must sum to 100% (currently ${(totalAllocation * 100).toFixed(1)}%)`,
        code: 'INVALID_ALLOCATION_SUM',
        severity: 'error'
      });
    }
  }
  
  // Management fee validation
  if (!isValidNumber(inputs.managementFeeRate)) {
    errors.push({
      field: 'managementFeeRate',
      message: 'Management fee rate must be a valid number',
      code: 'INVALID_MGMT_FEE',
      severity: 'error'
    });
  } else if (inputs.managementFeeRate < 0 || inputs.managementFeeRate > 0.1) {
    errors.push({
      field: 'managementFeeRate',
      message: 'Management fee rate should be between 0% and 10%',
      code: 'INVALID_MGMT_FEE_RANGE',
      severity: 'warning'
    });
  }
  
  // Carry validation
  if (!isValidNumber(inputs.carryPct)) {
    errors.push({
      field: 'carryPct',
      message: 'Carry percentage must be a valid number',
      code: 'INVALID_CARRY',
      severity: 'error'
    });
  } else if (inputs.carryPct < 0 || inputs.carryPct > 0.5) {
    errors.push({
      field: 'carryPct',
      message: 'Carry percentage should be between 0% and 50%',
      code: 'INVALID_CARRY_RANGE',
      severity: 'warning'
    });
  }
  
  // Reserve sufficiency check
  const totalManagementFees = inputs.fundSize * inputs.managementFeeRate * inputs.fundLifeYears;
  const investableCapital = inputs.fundSize - totalManagementFees;
  const totalPlannedInvestment = inputs.stageStrategies.reduce((sum, s) => {
    return sum + (s.allocationPct * investableCapital);
  }, 0);
  
  const reserveRatio = (investableCapital - totalPlannedInvestment) / investableCapital;
  if (reserveRatio < 0.1) {
    errors.push({
      field: 'reserves',
      message: `Low reserve ratio: ${(reserveRatio * 100).toFixed(1)}%. Consider reserving 20-30% for follow-ons.`,
      code: 'LOW_RESERVES',
      severity: 'warning'
    });
  }
  
  return errors;
}

// ===== OPTIMIZED PORTFOLIO GENERATION =====
const portfolioCache = new Map<string, PortfolioCompany[]>();

export function buildPortfolioFromStrategy(inputs: EnhancedFundInputs): PortfolioCompany[] {
  // Generate cache key
  const cacheKey = JSON.stringify({
    fundSize: inputs.fundSize,
    stageStrategies: inputs.stageStrategies,
    managementFeeRate: inputs.managementFeeRate,
    fundLifeYears: inputs.fundLifeYears
  });
  
  // Check cache
  if (portfolioCache.has(cacheKey)) {
    return portfolioCache.get(cacheKey)!;
  }
  
  const portfolio: PortfolioCompany[] = [];
  
  // Calculate investable capital using Decimal for precision
  const gpCommitment = new Decimal(inputs.fundSize).times(inputs.gpCommitmentPct).dividedBy(100);
  const lpCommitment = new Decimal(inputs.fundSize).minus(gpCommitment);
  const feeBase = inputs.includeGpInFees ? inputs.fundSize : lpCommitment.toNumber();
  const totalManagementFees = new Decimal(feeBase)
    .times(inputs.managementFeeRate)
    .times(inputs.fundLifeYears);
  const investableCapital = new Decimal(inputs.fundSize).minus(totalManagementFees);
  
  // Use deterministic random seed for consistent results
  let seed = 12345;
  const deterministicRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  
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
        quarter: Math.floor(deterministicRandom() * inputs.investPeriodQuarters),
        ownership: 0.05, // Simplified ownership calculation
        isFollowOn: false
      };
      
      // Determine exit characteristics using exit probability matrix
      const exitProbs = inputs.exitProbabilityMatrix[strategy.stage] || DEFAULT_EXIT_PROBABILITIES[strategy.stage];
      const random = deterministicRandom();
      let exitOutcome: 'fail' | 'low' | 'med' | 'high' | 'mega' = 'fail';
      let exitMultiple = 0;
      
      const cumulativeProbs = {
        fail: exitProbs.fail,
        low: exitProbs.fail + exitProbs.low,
        med: exitProbs.fail + exitProbs.low + exitProbs.med,
        high: exitProbs.fail + exitProbs.low + exitProbs.med + exitProbs.high,
        mega: 1.0
      };
      
      if (random <= cumulativeProbs.fail) {
        exitOutcome = 'fail';
        exitMultiple = 0;
      } else if (random <= cumulativeProbs.low) {
        exitOutcome = 'low';
        exitMultiple = 1 + deterministicRandom() * 2; // 1-3x
      } else if (random <= cumulativeProbs.med) {
        exitOutcome = 'med';
        exitMultiple = 3 + deterministicRandom() * 7; // 3-10x
      } else if (random <= cumulativeProbs.high) {
        exitOutcome = 'high';
        exitMultiple = 10 + deterministicRandom() * 40; // 10-50x
      } else {
        exitOutcome = 'mega';
        exitMultiple = 50 + deterministicRandom() * 100; // 50-150x
      }
      
      const company: PortfolioCompany = {
        id: companyId,
        name: `${strategy.stage} Company ${i + 1}`,
        entryStage: strategy.stage,
        currentStage: strategy.stage,
        investments: [initialInvestment],
        totalInvested: strategy.avgInvestmentSize,
        exitValue: exitMultiple > 0 ? strategy.avgInvestmentSize * exitMultiple : 0,
        exitQuarter: exitMultiple > 0 ? strategy.avgExitQuarter + Math.floor(deterministicRandom() * 8) : undefined,
        status: exitMultiple > 0 ? 'active' : 'written-off'
      };
      
      portfolio.push(company);
    }
  });
  
  // Cache result
  if (portfolioCache.size >= CACHE_SIZE_LIMIT) {
    const firstKey = portfolioCache.keys().next().value;
    portfolioCache.delete(firstKey);
  }
  portfolioCache.set(cacheKey, portfolio);
  
  return portfolio;
}

// ===== OPTIMIZED PORTFOLIO PROGRESSION =====
export function simulatePortfolioProgression(
  portfolio: PortfolioCompany[], 
  inputs: EnhancedFundInputs
): PortfolioCompany[] {
  // Use deterministic seed for consistent results
  let seed = 67890;
  const deterministicRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  
  return portfolio.map(company => {
    const updatedCompany = { ...company, investments: [...company.investments] };
    
    // Check for graduation and follow-on opportunities
    const graduationRates = inputs.graduationMatrix[company.currentStage] || {};
    
    // Determine if company graduates
    for (const [toStage, rate] of Object.entries(graduationRates)) {
      if (deterministicRandom() < rate && company.status === 'active') {
        // Add follow-on investment
        const followOnAmount = company.investments[0].amount * (0.5 + deterministicRandom() * 1.0);
        const followOnInvestment: Investment = {
          stage: toStage,
          amount: followOnAmount,
          quarter: company.investments[0].quarter + 4 + Math.floor(deterministicRandom() * 8),
          ownership: 0.03, // Simplified
          isFollowOn: true
        };
        
        updatedCompany.investments.push(followOnInvestment);
        updatedCompany.totalInvested += followOnAmount;
        updatedCompany.currentStage = toStage;
        
        // Update exit value with higher multiple for later stages
        if (updatedCompany.exitValue) {
          const stageMultiplier = {
            'Seed': 1.2,
            'Series A': 1.5,
            'Series B': 1.8,
            'Series C': 2.0,
            'Series D+': 2.5
          };
          updatedCompany.exitValue *= stageMultiplier[toStage as keyof typeof stageMultiplier] || 1.0;
        }
        
        break; // Only graduate once per simulation
      }
    }
    
    return updatedCompany;
  });
}

// ===== OPTIMIZED AMERICAN WATERFALL =====
const waterfallCache = new Map<string, WaterfallSummary>();

export function calculateAmericanWaterfall(
  totalInvested: number,
  totalExitValue: number,
  carryPct: number,
  hurdleRate: number = 0
): WaterfallSummary {
  const cacheKey = `${totalInvested}-${totalExitValue}-${carryPct}-${hurdleRate}`;
  
  if (waterfallCache.has(cacheKey)) {
    return waterfallCache.get(cacheKey)!;
  }
  
  const invested = new Decimal(totalInvested);
  const exitValue = new Decimal(totalExitValue);
  const profit = exitValue.minus(invested);
  
  if (profit.lte(0)) {
    const result = {
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
    waterfallCache.set(cacheKey, result);
    return result;
  }
  
  // American waterfall (deal-by-deal carry)
  const lpReturnOfCapital = invested.toNumber();
  const preferredReturn = invested.times(hurdleRate);
  const lpPreferredReturn = preferredReturn.toNumber();
  const profitAfterHurdle = profit.minus(preferredReturn);
  const gpCarry = Decimal.max(0, profitAfterHurdle.times(carryPct));
  const lpCarry = profitAfterHurdle.minus(gpCarry);
  
  const result = {
    totalInvested,
    totalExitValue,
    totalProfit: profit.toNumber(),
    lpReturnOfCapital,
    lpPreferredReturn,
    gpCatchUp: 0,
    gpCarry: gpCarry.toNumber(),
    lpCarry: lpCarry.toNumber(),
    finalLpProceeds: lpReturnOfCapital + lpPreferredReturn + lpCarry.toNumber(),
    finalGpProceeds: gpCarry.toNumber()
  };
  
  // Manage cache size
  if (waterfallCache.size >= CACHE_SIZE_LIMIT) {
    const firstKey = waterfallCache.keys().next().value;
    waterfallCache.delete(firstKey);
  }
  waterfallCache.set(cacheKey, result);
  
  return result;
}

// ===== OPTIMIZED IRR CALCULATION =====
export function calculateIRR(cashFlows: number[]): number {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) return 0;
  
  // Check for trivial cases
  const hasPositive = cashFlows.some(cf => cf > 0);
  const hasNegative = cashFlows.some(cf => cf < 0);
  if (!hasPositive || !hasNegative) return 0;
  
  // Newton-Raphson method with better initial guess
  let rate = 0.1;
  const tolerance = 1e-6;
  const maxIterations = 50;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    
    for (let j = 0; j < cashFlows.length; j++) {
      const discountFactor = Math.pow(1 + rate, j);
      npv += cashFlows[j] / discountFactor;
      dnpv -= (j * cashFlows[j]) / (discountFactor * (1 + rate));
    }
    
    if (Math.abs(npv) < tolerance) break;
    if (Math.abs(dnpv) < tolerance) break;
    
    const newRate = rate - npv / dnpv;
    
    // Bounds checking to prevent divergence
    if (newRate < -0.99) rate = -0.99;
    else if (newRate > 10) rate = 10;
    else rate = newRate;
  }
  
  return isNaN(rate) || !isFinite(rate) ? 0 : rate;
}

// ===== MAIN FORECAST WITH CACHING =====
export function buildEnhancedFundForecast(inputs: EnhancedFundInputs): ForecastResult {
  const startTime = performance.now();
  
  // Generate cache key
  const cacheKey = JSON.stringify(inputs);
  
  // Check cache
  if (calculationCache.has(cacheKey)) {
    performanceMetrics.cacheHits++;
    return calculationCache.get(cacheKey)!;
  }
  
  performanceMetrics.cacheMisses++;
  
  try {
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
    
    // Build and progress portfolio
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
    
    // Build timeline with optimized calculations
    const timeline: CashFlowPoint[] = [];
    const quarterlyDeployments: number[] = [];
    const quarterlyNAVs: number[] = [];
    const quarterlyDistributions: number[] = [];
    const quarterlyManagementFees: number[] = [];
    
    let cumulativeContributions = 0;
    let cumulativeDistributions = 0;
    
    // Pre-calculate deployment and distribution schedules
    const deploymentsPerQuarter = totalInvested / inputs.investPeriodQuarters;
    const distributionStartQuarter = 12;
    const distributionPeriod = inputs.fundLifeQuarters - distributionStartQuarter;
    const distributionsPerQuarter = totalExitValue / distributionPeriod;
    
    // Build quarterly cash flows
    for (let quarter = 0; quarter <= inputs.fundLifeQuarters; quarter++) {
      const year = quarter / 4;
      const yearQuarter = `Y${Math.floor(year) + 1}Q${(quarter % 4) + 1}`;
      
      // Capital contributions
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
      const unrealizedValue = Math.max(0, totalExitValue - cumulativeDistributions);
      const nav = unrealizedValue;
      quarterlyNAVs.push(nav);
      
      // Performance ratios
      const dpi = cumulativeContributions > 0 ? cumulativeDistributions / cumulativeContributions : 0;
      const rvpi = cumulativeContributions > 0 ? nav / cumulativeContributions : 0;
      const tvpi = dpi + rvpi;
      
      // Build cash flow array for IRR
      const cashFlows: number[] = [];
      for (let i = 0; i <= quarter; i++) {
        if (i === 0) cashFlows.push(-inputs.fundSize);
        else if (i >= distributionStartQuarter && i < distributionStartQuarter + distributionPeriod) {
          cashFlows.push(distributionsPerQuarter);
        } else if (i === inputs.fundLifeQuarters) {
          cashFlows.push(nav);
        } else {
          cashFlows.push(0);
        }
      }
      
      const grossIrr = calculateIRR(cashFlows);
      const netCashFlows = cashFlows.map((cf, idx) => 
        idx === 0 ? cf : cf - (idx > 0 ? quarterlyMgmtFee : 0)
      );
      const netIrr = calculateIRR(netCashFlows);
      
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
    
    const result: ForecastResult = {
      timeline,
      portfolio,
      companyResults,
      waterfallSummary,
      totalInvested,
      totalExitValue,
      totalManagementFees,
      totalGpCarry: waterfallSummary.gpCarry,
      totalLpProfit: waterfallSummary.finalLpProceeds - inputs.fundSize,
      grossMoic: totalInvested > 0 ? totalExitValue / totalInvested : 0,
      netMoic: totalInvested > 0 ? (totalExitValue - totalManagementFees - waterfallSummary.gpCarry) / inputs.fundSize : 0,
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
        companiesExited: portfolio.filter(c => c.exitValue && c.exitValue > 0).length,
        companiesWrittenOff: portfolio.filter(c => c.status === 'written-off').length
      }
    };
    
    // Cache result
    if (calculationCache.size >= CACHE_SIZE_LIMIT) {
      const firstKey = calculationCache.keys().next().value;
      calculationCache.delete(firstKey);
    }
    calculationCache.set(cacheKey, result);
    
    // Record performance metrics
    const endTime = performance.now();
    performanceMetrics.recordCalculation(endTime - startTime);
    
    return result;
    
  } catch (error) {
    const endTime = performance.now();
    performanceMetrics.recordCalculation(endTime - startTime);
    throw error;
  }
}

// ===== PERFORMANCE MONITORING EXPORTS =====
export function getPerformanceMetrics() {
  return {
    averageCalculationTime: performanceMetrics.getAverageCalculationTime(),
    cacheHitRate: performanceMetrics.getCacheHitRate(),
    totalCalculations: performanceMetrics.cacheHits + performanceMetrics.cacheMisses,
    cacheSize: calculationCache.size
  };
}

export function clearCalculationCache() {
  calculationCache.clear();
  portfolioCache.clear();
  waterfallCache.clear();
  performanceMetrics.cacheHits = 0;
  performanceMetrics.cacheMisses = 0;
}

// ===== TYPE EXPORTS =====
import { StageStrategy } from '../types/index';
