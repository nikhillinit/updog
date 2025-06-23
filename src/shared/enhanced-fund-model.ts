import Decimal from 'decimal.js';
import {
  EnhancedFundInputs,
  ForecastResult,
  PortfolioCompany,
  CashFlowPoint,
  ValidationError,
  WaterfallSummary,
  CompanyResult,
  StageStrategy,
  GraduationMatrix,
  ExitProbabilityMatrix
} from '../types';

// ===== CONSTANTS =====

export const DEFAULT_FUND_PARAMS = {
  fundName: 'Demo Fund I',
  fundSize: 100000000,
  vintageYear: new Date().getFullYear(),
  managementFeeRate: 0.02,
  carryPct: 0.20,
  hurdleRate: 0.08,
  gpCommitmentPct: 2,
  includeGpInFees: false,
  investmentPeriodYears: 5,
  fundLifeYears: 10,
  followOnReserveRatio: 0.5,
  recyclingEnabled: false,
  waterfallType: 'american' as const
};

export const DEFAULT_STAGE_STRATEGIES: StageStrategy[] = [
  {
    stage: 'Pre-Seed',
    allocationPct: 0.20,
    numFirstChecks: 15,
    avgInvestmentSize: 500000,
    graduationRate: 0.35,
    weightedExitValue: 10000000
  },
  {
    stage: 'Seed',
    allocationPct: 0.60,
    numFirstChecks: 20,
    avgInvestmentSize: 1500000,
    graduationRate: 0.45,
    weightedExitValue: 25000000
  },
  {
    stage: 'Series A',
    allocationPct: 0.20,
    numFirstChecks: 5,
    avgInvestmentSize: 3000000,
    graduationRate: 0.60,
    weightedExitValue: 50000000
  }
];

export const DEFAULT_GRADUATION_MATRIX: GraduationMatrix = {
  'Pre-Seed': { 'Seed': 0.35, 'Series A': 0.05, 'Exit': 0.10 },
  'Seed': { 'Series A': 0.45, 'Series B': 0.10, 'Exit': 0.15 },
  'Series A': { 'Series B': 0.50, 'Series C': 0.10, 'Exit': 0.20 },
  'Series B': { 'Series C': 0.45, 'Series D+': 0.15, 'Exit': 0.30 },
  'Series C': { 'Series D+': 0.40, 'Exit': 0.60 },
  'Series D+': { 'Exit': 1.00 }
};

export const DEFAULT_EXIT_PROBABILITIES: ExitProbabilityMatrix = {
  'Pre-Seed': { failure: 0.70, lowMultiple: 0.15, mediumMultiple: 0.10, highMultiple: 0.04, homeRun: 0.01 },
  'Seed': { failure: 0.60, lowMultiple: 0.20, mediumMultiple: 0.15, highMultiple: 0.04, homeRun: 0.01 },
  'Series A': { failure: 0.45, lowMultiple: 0.25, mediumMultiple: 0.20, highMultiple: 0.08, homeRun: 0.02 },
  'Series B': { failure: 0.30, lowMultiple: 0.30, mediumMultiple: 0.25, highMultiple: 0.12, homeRun: 0.03 },
  'Series C': { failure: 0.20, lowMultiple: 0.35, mediumMultiple: 0.30, highMultiple: 0.12, homeRun: 0.03 },
  'Series D+': { failure: 0.10, lowMultiple: 0.30, mediumMultiple: 0.35, highMultiple: 0.20, homeRun: 0.05 }
};

// ===== VALIDATION =====

export function validateEnhancedInputs(inputs: EnhancedFundInputs): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!inputs.fundSize || inputs.fundSize <= 0) {
    errors.push({
      field: 'fundSize',
      message: 'Fund size must be positive',
      code: 'INVALID_FUND_SIZE',
      severity: 'error'
    });
  }
  
  if (!inputs.stageStrategies || inputs.stageStrategies.length === 0) {
    errors.push({
      field: 'stageStrategies',
      message: 'At least one stage strategy is required',
      code: 'MISSING_STAGE_STRATEGIES',
      severity: 'error'
    });
  } else {
    const totalAllocation = inputs.stageStrategies.reduce((sum, s) => sum + s.allocationPct, 0);
    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      errors.push({
        field: 'stageStrategies',
        message: `Stage allocations must sum to 100% (currently ${(totalAllocation * 100).toFixed(1)}%)`,
        code: 'INVALID_ALLOCATION_SUM',
        severity: 'error'
      });
    }
  }
  
  return errors;
}

// ===== MAIN FORECAST FUNCTION =====

export async function buildEnhancedFundForecast(
  inputs: EnhancedFundInputs
): Promise<ForecastResult> {
  // Validate inputs
  const errors = validateEnhancedInputs(inputs);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
  }

  // Calculate investable capital
  const gpCommitment = new Decimal(inputs.fundSize).times(inputs.gpCommitmentPct).dividedBy(100);
  const lpCommitment = new Decimal(inputs.fundSize).minus(gpCommitment);
  const feeBase = inputs.includeGpInFees ? inputs.fundSize : lpCommitment.toNumber();
  
  // Build portfolio
  const portfolio = buildPortfolioFromStrategy(inputs);
  
  // Generate cash flows
  const timeline = generateCashFlows(inputs, portfolio, feeBase);
  
  // Calculate waterfall
  const { waterfallSummary, companyResults } = calculateWaterfall(
    portfolio,
    inputs.carryPct,
    inputs.hurdleRate,
    lpCommitment.toNumber()
  );
  
  // Calculate metrics
  const metrics = calculateMetrics(timeline, portfolio, waterfallSummary);
  
  return {
    timeline,
    portfolio,
    companyResults,
    waterfallSummary,
    ...metrics,
    calculationDate: new Date(),
    fundLifeQuarters: inputs.fundLifeYears * 4
  };
}

// ===== PORTFOLIO GENERATION =====

function buildPortfolioFromStrategy(inputs: EnhancedFundInputs): PortfolioCompany[] {
  const portfolio: PortfolioCompany[] = [];
  let companyId = 0;
  
  // Create initial investments by stage
  inputs.stageStrategies.forEach(strategy => {
    for (let i = 0; i < strategy.numFirstChecks; i++) {
      const investmentQuarter = Math.floor(Math.random() * (inputs.investmentPeriodYears * 4));
      
      const company: PortfolioCompany = {
        id: `company-${++companyId}`,
        name: `${strategy.stage} Company ${i + 1}`,
        entryStage: strategy.stage,
        currentStage: strategy.stage,
        investments: [{
          stage: strategy.stage,
          amount: strategy.avgInvestmentSize,
          quarter: investmentQuarter,
          ownership: 0.10 + Math.random() * 0.15
        }],
        totalInvested: strategy.avgInvestmentSize,
        status: 'active'
      };
      
      // Simulate graduation and follow-on investments
      simulateCompanyProgression(company, inputs, investmentQuarter);
      
      portfolio.push(company);
    }
  });
  
  return portfolio;
}

function simulateCompanyProgression(
  company: PortfolioCompany,
  inputs: EnhancedFundInputs,
  startQuarter: number
): void {
  let currentStage = company.entryStage;
  let currentQuarter = startQuarter;
  
  // Simulate progression through stages
  for (let i = 0; i < 4; i++) { // Max 4 follow-on rounds
    currentQuarter += 4 + Math.floor(Math.random() * 4); // 4-8 quarters between rounds
    
    if (currentQuarter >= inputs.fundLifeYears * 4) break;
    
    const graduationRates = inputs.graduationMatrix[currentStage];
    if (!graduationRates) break;
    
    // Determine next stage based on probabilities
    const rand = Math.random();
    let cumProb = 0;
    let graduated = false;
    
    for (const [nextStage, prob] of Object.entries(graduationRates)) {
      cumProb += prob;
      if (rand < cumProb) {
        if (nextStage === 'Exit') {
          // Company exits
          company.status = 'exited';
          company.exitQuarter = currentQuarter;
          company.exitValue = calculateExitValue(company, inputs.exitProbabilityMatrix);
          return;
        } else {
          // Company graduates to next stage
          currentStage = nextStage;
          graduated = true;
          
          // Add follow-on investment
          const followOnAmount = company.totalInvested * 0.5; // Simple 50% follow-on
          company.investments.push({
            stage: currentStage,
            amount: followOnAmount,
            quarter: currentQuarter,
            isFollowOn: true
          });
          company.totalInvested += followOnAmount;
          company.currentStage = currentStage;
          break;
        }
      }
    }
    
    if (!graduated) break;
  }
  
  // If not exited, determine final outcome
  if (company.status === 'active') {
    const exitProbs = inputs.exitProbabilityMatrix?.[currentStage] || DEFAULT_EXIT_PROBABILITIES[currentStage];
    const rand = Math.random();
    
    if (rand < exitProbs.failure) {
      company.status = 'written-off';
      company.exitValue = 0;
    } else {
      company.status = 'exited';
      company.exitQuarter = inputs.fundLifeYears * 4;
      company.exitValue = calculateExitValue(company, inputs.exitProbabilityMatrix);
    }
  }
}

function calculateExitValue(
  company: PortfolioCompany,
  exitProbMatrix?: ExitProbabilityMatrix
): number {
  const exitProbs = exitProbMatrix?.[company.currentStage] || DEFAULT_EXIT_PROBABILITIES[company.currentStage];
  const rand = Math.random();
  
  let multiple = 0;
  if (rand < exitProbs.failure) {
    multiple = 0;
  } else if (rand < exitProbs.failure + exitProbs.lowMultiple) {
    multiple = 0.5 + Math.random() * 2.5; // 0.5x - 3x
  } else if (rand < exitProbs.failure + exitProbs.lowMultiple + exitProbs.mediumMultiple) {
    multiple = 3 + Math.random() * 7; // 3x - 10x
  } else if (rand < exitProbs.failure + exitProbs.lowMultiple + exitProbs.mediumMultiple + exitProbs.highMultiple) {
    multiple = 10 + Math.random() * 15; // 10x - 25x
  } else {
    multiple = 25 + Math.random() * 75; // 25x - 100x
  }
  
  return company.totalInvested * multiple;
}

// ===== CASH FLOW GENERATION =====

function generateCashFlows(
  inputs: EnhancedFundInputs,
  portfolio: PortfolioCompany[],
  feeBase: number
): CashFlowPoint[] {
  const timeline: CashFlowPoint[] = [];
  const quarters = inputs.fundLifeYears * 4;
  
  let cumulativeContributions = 0;
  let cumulativeDistributions = 0;
  let cumulativeFees = 0;
  
  for (let q = 0; q <= quarters; q++) {
    const year = Math.floor(q / 4) + 1;
    const quarterInYear = (q % 4) + 1;
    
    // Calculate contributions (investments + fees)
    const investments = portfolio.reduce((sum, company) => {
      return sum + company.investments
        .filter(inv => inv.quarter === q)
        .reduce((invSum, inv) => invSum + inv.amount, 0);
    }, 0);
    
    const mgmtFee = q < inputs.investmentPeriodYears * 4 
      ? feeBase * inputs.managementFeeRate / 4 
      : 0;
    
    const contributions = investments + mgmtFee;
    cumulativeContributions += contributions;
    cumulativeFees += mgmtFee;
    
    // Calculate distributions
    const distributions = portfolio
      .filter(c => c.exitQuarter === q && c.exitValue)
      .reduce((sum, c) => sum + (c.exitValue || 0), 0);
    
    cumulativeDistributions += distributions;
    
    // Calculate NAV
    const activeCompanies = portfolio.filter(c => 
      (!c.exitQuarter || c.exitQuarter > q) && 
      c.investments.some(inv => inv.quarter <= q)
    );
    
    const nav = activeCompanies.reduce((sum, company) => {
      // Simple NAV calculation - could be enhanced
      const quartersSinceInvestment = q - company.investments[0].quarter;
      const growthFactor = 1 + (0.05 * quartersSinceInvestment / 4); // 5% annual growth
      return sum + company.totalInvested * growthFactor;
    }, 0);
    
    // Calculate metrics
    const totalValue = cumulativeDistributions + nav;
    const netContributions = cumulativeContributions;
    
    timeline.push({
      quarter: q,
      year,
      yearQuarter: `Y${year}Q${quarterInYear}`,
      contributions,
      distributions,
      managementFees: mgmtFee,
      cumulativeContributions,
      cumulativeDistributions,
      nav,
      dpi: netContributions > 0 ? cumulativeDistributions / netContributions : 0,
      rvpi: netContributions > 0 ? nav / netContributions : 0,
      tvpi: netContributions > 0 ? totalValue / netContributions : 0,
      moic: netContributions > 0 ? totalValue / netContributions : 0,
      netMoic: 0, // Will be calculated after waterfall
      grossIrr: 0, // Will be calculated separately
      netIrr: 0 // Will be calculated separately
    });
  }
  
  return timeline;
}

// ===== WATERFALL CALCULATIONS =====

function calculateWaterfall(
  portfolio: PortfolioCompany[],
  carryPct: number,
  hurdleRate: number,
  lpCommitment: number
): { waterfallSummary: WaterfallSummary; companyResults: CompanyResult[] } {
  const companyResults: CompanyResult[] = [];
  
  const totalInvested = portfolio.reduce((sum, c) => sum + c.totalInvested, 0);
  const totalExitValue = portfolio.reduce((sum, c) => sum + (c.exitValue || 0), 0);
  const totalProfit = Math.max(0, totalExitValue - totalInvested);
  
  // Simple American waterfall
  const lpReturnOfCapital = Math.min(totalExitValue, totalInvested);
  const remainingAfterCapital = Math.max(0, totalExitValue - lpReturnOfCapital);
  
  // Simplified carry calculation
  const gpCarry = remainingAfterCapital * carryPct;
  const lpProfit = remainingAfterCapital * (1 - carryPct);
  
  portfolio.forEach(company => {
    const exitValue = company.exitValue || 0;
    const profit = Math.max(0, exitValue - company.totalInvested);
    const carry = profit * carryPct;
    
    companyResults.push({
      companyId: company.id,
      invested: company.totalInvested,
      exitProceeds: exitValue,
      profit,
      carry,
      lpProfit: profit - carry,
      multiple: company.totalInvested > 0 ? exitValue / company.totalInvested : 0
    });
  });
  
  const waterfallSummary: WaterfallSummary = {
    totalInvested,
    totalExitValue,
    totalProfit,
    lpReturnOfCapital,
    lpPreferredReturn: 0, // Simplified
    gpCatchUp: 0, // Simplified
    gpCarry,
    lpCarry: lpProfit,
    finalLpProceeds: lpReturnOfCapital + lpProfit,
    finalGpProceeds: gpCarry
  };
  
  return { waterfallSummary, companyResults };
}

// ===== METRICS CALCULATION =====

function calculateMetrics(
  timeline: CashFlowPoint[],
  portfolio: PortfolioCompany[],
  waterfall: WaterfallSummary
) {
  const finalPoint = timeline[timeline.length - 1];
  
  // Calculate IRRs (simplified - would use XIRR in production)
  const cashFlows = timeline.map(point => ({
    date: new Date(2024, 0, 1 + point.quarter * 90),
    amount: -point.contributions + point.distributions
  }));
  
  const grossIrr = calculateSimpleIRR(cashFlows);
  const netIrr = grossIrr * 0.85; // Simplified net IRR
  
  // Update timeline with IRRs
  timeline.forEach(point => {
    point.grossIrr = grossIrr;
    point.netIrr = netIrr;
    point.netMoic = point.moic * 0.85; // Simplified
  });
  
  return {
    totalInvested: waterfall.totalInvested,
    totalExitValue: waterfall.totalExitValue,
    totalManagementFees: timeline.reduce((sum, p) => sum + p.managementFees, 0),
    totalGpCarry: waterfall.gpCarry,
    totalLpProfit: waterfall.lpCarry,
    grossMoic: finalPoint.moic,
    netMoic: finalPoint.netMoic,
    grossIrr,
    netIrr,
    tvpi: finalPoint.tvpi,
    dpi: finalPoint.dpi,
    rvpi: finalPoint.rvpi,
    intermediates: {
      quarterlyDeployments: timeline.map(p => p.contributions),
      quarterlyNAVs: timeline.map(p => p.nav),
      quarterlyDistributions: timeline.map(p => p.distributions),
      quarterlyManagementFees: timeline.map(p => p.managementFees),
      companiesCreated: portfolio.length,
      companiesExited: portfolio.filter(c => c.status === 'exited').length,
      companiesWrittenOff: portfolio.filter(c => c.status === 'written-off').length
    }
  };
}

// Simplified IRR calculation
function calculateSimpleIRR(cashFlows: { date: Date; amount: number }[]): number {
  // This is a very simplified IRR - in production use proper XIRR
  const totalInvested = -cashFlows.filter(cf => cf.amount < 0).reduce((sum, cf) => sum + cf.amount, 0);
  const totalReturned = cashFlows.filter(cf => cf.amount > 0).reduce((sum, cf) => sum + cf.amount, 0);
  const years = 10; // Assuming 10-year fund
  
  if (totalInvested === 0) return 0;
  
  const multiple = totalReturned / totalInvested;
  return Math.pow(multiple, 1 / years) - 1;
}
