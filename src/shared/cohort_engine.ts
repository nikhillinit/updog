// src/shared/cohort_engine.ts
import Decimal from 'decimal.js';
import { 
  StageStrategy, 
  GraduationMatrix, 
  ExitProbabilityMatrix,
  PortfolioCompany,
  Investment
} from '../types/index';

// ===== COHORT INTERFACES =====
export interface Cohort {
  id: string;
  stage: string;
  vintage: number; // Quarter when cohort was created
  initialCompanies: number;
  currentCompanies: number;
  totalInvested: number;
  currentValue: number;
  realizedValue: number;
  writeOffs: number;
  graduates: Record<string, number>; // Stage -> count
  exits: {
    fail: number;
    low: number;
    med: number;
    high: number;
    mega: number;
  };
}

export interface CohortSnapshot {
  quarter: number;
  cohorts: Cohort[];
  aggregates: {
    totalCompanies: number;
    activeCompanies: number;
    totalInvested: number;
    unrealizedValue: number;
    realizedValue: number;
    totalValue: number;
  };
}

export interface CohortEngineConfig {
  fundSize: number;
  investableCapital: number;
  investmentPeriodQuarters: number;
  fundLifeQuarters: number;
  stageStrategies: StageStrategy[];
  graduationMatrix: GraduationMatrix;
  exitProbabilityMatrix: ExitProbabilityMatrix;
  followOnReserveRatio: number;
  recyclingEnabled: boolean;
  recyclingCap: number;
}

// ===== COHORT ENGINE CLASS =====
export class CohortEngine {
  private config: CohortEngineConfig;
  private cohorts: Map<string, Cohort> = new Map();
  private snapshots: CohortSnapshot[] = [];
  private capitalDeployed: number = 0;
  private capitalRealized: number = 0;
  private capitalRecycled: number = 0;
  
  constructor(config: CohortEngineConfig) {
    this.config = config;
  }
  
  // ===== CORE METHODS =====
  
  /**
   * Run the cohort progression simulation
   */
  simulate(): CohortSnapshot[] {
    this.reset();
    
    for (let quarter = 0; quarter <= this.config.fundLifeQuarters; quarter++) {
      // Deploy capital in investment period
      if (quarter < this.config.investmentPeriodQuarters) {
        this.deployCapital(quarter);
      }
      
      // Progress all cohorts
      this.progressCohorts(quarter);
      
      // Handle exits and distributions
      this.processExits(quarter);
      
      // Create snapshot
      this.createSnapshot(quarter);
    }
    
    return this.snapshots;
  }
  
  /**
   * Deploy capital to create new cohorts
   */
  private deployCapital(quarter: number): void {
    const remainingCapital = this.config.investableCapital - this.capitalDeployed + this.capitalRecycled;
    const quartersRemaining = this.config.investmentPeriodQuarters - quarter;
    
    if (quartersRemaining <= 0 || remainingCapital <= 0) return;
    
    // Calculate deployment for this quarter
    const targetDeployment = remainingCapital / quartersRemaining;
    
    // Allocate across stages based on strategy
    for (const strategy of this.config.stageStrategies) {
      const stageAllocation = targetDeployment * strategy.allocationPct;
      const numCompanies = Math.floor(stageAllocation / strategy.avgInvestmentSize);
      
      if (numCompanies > 0) {
        const cohortId = `${strategy.stage}-Q${quarter}`;
        const cohort: Cohort = {
          id: cohortId,
          stage: strategy.stage,
          vintage: quarter,
          initialCompanies: numCompanies,
          currentCompanies: numCompanies,
          totalInvested: numCompanies * strategy.avgInvestmentSize,
          currentValue: numCompanies * strategy.avgInvestmentSize,
          realizedValue: 0,
          writeOffs: 0,
          graduates: {},
          exits: { fail: 0, low: 0, med: 0, high: 0, mega: 0 }
        };
        
        this.cohorts.set(cohortId, cohort);
        this.capitalDeployed += cohort.totalInvested;
      }
    }
  }
  
  /**
   * Progress cohorts through graduation and follow-on rounds
   */
  private progressCohorts(quarter: number): void {
    for (const cohort of this.cohorts.values()) {
      // Skip if no active companies
      if (cohort.currentCompanies <= 0) continue;
      
      const cohortAge = quarter - cohort.vintage;
      
      // Process graduations (typically after 4-8 quarters)
      if (cohortAge >= 4 && cohortAge <= 20) {
        this.processGraduations(cohort, quarter);
      }
      
      // Update valuations based on stage progression
      this.updateCohortValuation(cohort, cohortAge);
    }
  }
  
  /**
   * Process graduations within a cohort
   */
  private processGraduations(cohort: Cohort, quarter: number): void {
    const graduationRates = this.config.graduationMatrix[cohort.stage];
    if (!graduationRates) return;
    
    const activeCompanies = cohort.currentCompanies;
    
    for (const [toStage, rate] of Object.entries(graduationRates)) {
      const graduatingCompanies = Math.floor(activeCompanies * rate);
      
      if (graduatingCompanies > 0) {
        // Track graduations
        cohort.graduates[toStage] = (cohort.graduates[toStage] || 0) + graduatingCompanies;
        
        // Create follow-on investment opportunity
        const strategy = this.config.stageStrategies.find(s => s.stage === toStage);
        if (strategy && this.hasFollowOnCapacity()) {
          const followOnAmount = graduatingCompanies * strategy.avgInvestmentSize * 0.5;
          
          // Check reserve capacity
          if (this.canInvestFollowOn(followOnAmount)) {
            cohort.totalInvested += followOnAmount;
            this.capitalDeployed += followOnAmount;
            
            // Boost valuation for successful follow-on
            cohort.currentValue *= 1.5;
          }
        }
      }
    }
  }
  
  /**
   * Process exits and calculate realized values
   */
  private processExits(quarter: number): void {
    for (const cohort of this.cohorts.values()) {
      const cohortAge = quarter - cohort.vintage;
      
      // Exit timing varies by stage (earlier stages exit later)
      const minExitAge = this.getMinExitAge(cohort.stage);
      if (cohortAge < minExitAge) continue;
      
      const exitProbs = this.config.exitProbabilityMatrix[cohort.stage];
      if (!exitProbs || cohort.currentCompanies <= 0) continue;
      
      // Calculate exits for this quarter
      const exitRate = this.getQuarterlyExitRate(cohort.stage, cohortAge);
      const exitingCompanies = Math.min(
        Math.floor(cohort.currentCompanies * exitRate),
        cohort.currentCompanies
      );
      
      if (exitingCompanies > 0) {
        // Distribute exits across outcomes
        const outcomes = this.distributeExitOutcomes(exitingCompanies, exitProbs);
        
        // Calculate exit values
        let totalExitValue = 0;
        const avgInvestmentPerCompany = cohort.totalInvested / cohort.initialCompanies;
        
        // Process each outcome type
        totalExitValue += outcomes.low * avgInvestmentPerCompany * 2;    // 2x
        totalExitValue += outcomes.med * avgInvestmentPerCompany * 5;    // 5x
        totalExitValue += outcomes.high * avgInvestmentPerCompany * 20;  // 20x
        totalExitValue += outcomes.mega * avgInvestmentPerCompany * 100; // 100x
        
        // Update cohort metrics
        cohort.currentCompanies -= exitingCompanies;
        cohort.realizedValue += totalExitValue;
        cohort.currentValue = Math.max(0, cohort.currentValue - (exitingCompanies * avgInvestmentPerCompany));
        
        // Track exits
        Object.entries(outcomes).forEach(([outcome, count]) => {
          cohort.exits[outcome as keyof typeof cohort.exits] += count;
        });
        
        // Update capital realized
        this.capitalRealized += totalExitValue;
        
        // Handle recycling
        if (this.config.recyclingEnabled && quarter < this.config.investmentPeriodQuarters) {
          const recyclableAmount = Math.min(
            totalExitValue,
            this.config.investableCapital * this.config.recyclingCap - this.capitalRecycled
          );
          this.capitalRecycled += recyclableAmount;
        }
      }
    }
  }
  
  /**
   * Update cohort valuation based on age and performance
   */
  private updateCohortValuation(cohort: Cohort, age: number): void {
    // Simple valuation step-up model
    const annualStepUp = this.getAnnualStepUp(cohort.stage);
    const quarterlyStepUp = Math.pow(1 + annualStepUp, 0.25) - 1;
    
    // Apply step-up to unrealized portion
    const unrealizedRatio = cohort.currentCompanies / cohort.initialCompanies;
    if (unrealizedRatio > 0) {
      cohort.currentValue *= (1 + quarterlyStepUp);
    }
  }
  
  /**
   * Create a snapshot of current state
   */
  private createSnapshot(quarter: number): void {
    const aggregates = {
      totalCompanies: 0,
      activeCompanies: 0,
      totalInvested: 0,
      unrealizedValue: 0,
      realizedValue: 0,
      totalValue: 0
    };
    
    for (const cohort of this.cohorts.values()) {
      aggregates.totalCompanies += cohort.initialCompanies;
      aggregates.activeCompanies += cohort.currentCompanies;
      aggregates.totalInvested += cohort.totalInvested;
      aggregates.unrealizedValue += cohort.currentValue;
      aggregates.realizedValue += cohort.realizedValue;
    }
    
    aggregates.totalValue = aggregates.unrealizedValue + aggregates.realizedValue;
    
    this.snapshots.push({
      quarter,
      cohorts: Array.from(this.cohorts.values()),
      aggregates
    });
  }
  
  // ===== HELPER METHODS =====
  
  private reset(): void {
    this.cohorts.clear();
    this.snapshots = [];
    this.capitalDeployed = 0;
    this.capitalRealized = 0;
    this.capitalRecycled = 0;
  }
  
  private hasFollowOnCapacity(): boolean {
    const reserveCapital = this.config.investableCapital * this.config.followOnReserveRatio;
    const availableReserve = reserveCapital - (this.capitalDeployed - this.config.investableCapital * (1 - this.config.followOnReserveRatio));
    return availableReserve > 0;
  }
  
  private canInvestFollowOn(amount: number): boolean {
    const totalDeployed = this.capitalDeployed + amount;
    return totalDeployed <= this.config.investableCapital + this.capitalRecycled;
  }
  
  private getMinExitAge(stage: string): number {
    const stageExitAges: Record<string, number> = {
      'Pre-Seed': 12,  // 3 years
      'Seed': 16,      // 4 years
      'Series A': 20,  // 5 years
      'Series B': 16,  // 4 years
      'Series C': 12,  // 3 years
      'Series D+': 8   // 2 years
    };
    return stageExitAges[stage] || 16;
  }
  
  private getQuarterlyExitRate(stage: string, age: number): number {
    // Exit rate increases with age
    const baseRate = 0.05; // 5% per quarter base
    const ageMultiplier = Math.min(age / 20, 2); // Up to 2x for older cohorts
    return baseRate * ageMultiplier;
  }
  
  private getAnnualStepUp(stage: string): number {
    const stepUps: Record<string, number> = {
      'Pre-Seed': 0.30,   // 30% annual
      'Seed': 0.25,       // 25% annual
      'Series A': 0.20,   // 20% annual
      'Series B': 0.15,   // 15% annual
      'Series C': 0.12,   // 12% annual
      'Series D+': 0.10   // 10% annual
    };
    return stepUps[stage] || 0.15;
  }
  
  private distributeExitOutcomes(
    companies: number, 
    probabilities: ExitProbabilityMatrix[string]
  ): Record<string, number> {
    const outcomes = { fail: 0, low: 0, med: 0, high: 0, mega: 0 };
    
    // Deterministic distribution based on probabilities
    outcomes.fail = Math.floor(companies * probabilities.fail);
    outcomes.low = Math.floor(companies * probabilities.low);
    outcomes.med = Math.floor(companies * probabilities.med);
    outcomes.high = Math.floor(companies * probabilities.high);
    outcomes.mega = Math.floor(companies * probabilities.mega);
    
    // Handle rounding remainder
    const distributed = Object.values(outcomes).reduce((sum, count) => sum + count, 0);
    const remainder = companies - distributed;
    if (remainder > 0) {
      outcomes.low += remainder; // Default remainder to low exits
    }
    
    return outcomes;
  }
  
  // ===== PUBLIC GETTERS =====
  
  getSnapshots(): CohortSnapshot[] {
    return this.snapshots;
  }
  
  getFinalMetrics(): {
    totalDeployed: number;
    totalRealized: number;
    totalRecycled: number;
    capitalEfficiency: number;
    successRate: number;
  } {
    const finalSnapshot = this.snapshots[this.snapshots.length - 1];
    const totalExits = Array.from(this.cohorts.values()).reduce((sum, cohort) => {
      return sum + Object.values(cohort.exits).reduce((s, c) => s + c, 0);
    }, 0);
    
    const successfulExits = Array.from(this.cohorts.values()).reduce((sum, cohort) => {
      return sum + cohort.exits.low + cohort.exits.med + cohort.exits.high + cohort.exits.mega;
    }, 0);
    
    return {
      totalDeployed: this.capitalDeployed,
      totalRealized: this.capitalRealized,
      totalRecycled: this.capitalRecycled,
      capitalEfficiency: this.capitalDeployed > 0 ? this.capitalRealized / this.capitalDeployed : 0,
      successRate: totalExits > 0 ? successfulExits / totalExits : 0
    };
  }
  
  exportToPortfolio(): PortfolioCompany[] {
    const portfolio: PortfolioCompany[] = [];
    let companyId = 1;
    
    for (const cohort of this.cohorts.values()) {
      // Create companies for active investments
      for (let i = 0; i < cohort.currentCompanies; i++) {
        const avgInvestment = cohort.totalInvested / cohort.initialCompanies;
        const company: PortfolioCompany = {
          id: `company-${companyId++}`,
          name: `${cohort.stage} Company ${i + 1} (${cohort.id})`,
          entryStage: cohort.stage,
          currentStage: cohort.stage,
          investments: [{
            stage: cohort.stage,
            amount: avgInvestment,
            quarter: cohort.vintage,
            ownership: 0.05,
            isFollowOn: false
          }],
          totalInvested: avgInvestment,
          currentValuation: cohort.currentValue / cohort.currentCompanies,
          status: 'active'
        };
        portfolio.push(company);
      }
      
      // Create exited companies
      const exitedCompanies = cohort.initialCompanies - cohort.currentCompanies;
      const avgInvestment = cohort.totalInvested / cohort.initialCompanies;
      
      // Create representative exited companies
      Object.entries(cohort.exits).forEach(([outcome, count]) => {
        if (count > 0 && outcome !== 'fail') {
          const exitMultiples = { low: 2, med: 5, high: 20, mega: 100 };
          const multiple = exitMultiples[outcome as keyof typeof exitMultiples] || 0;
          
          for (let i = 0; i < Math.min(count, 5); i++) { // Limit to 5 per outcome for performance
            const company: PortfolioCompany = {
              id: `company-${companyId++}`,
              name: `${cohort.stage} Exit (${outcome}) - ${cohort.id}`,
              entryStage: cohort.stage,
              currentStage: cohort.stage,
              investments: [{
                stage: cohort.stage,
                amount: avgInvestment,
                quarter: cohort.vintage,
                ownership: 0.05,
                isFollowOn: false
              }],
              totalInvested: avgInvestment,
              exitValue: avgInvestment * multiple,
              exitQuarter: cohort.vintage + this.getMinExitAge(cohort.stage),
              status: 'exited'
            };
            portfolio.push(company);
          }
        }
      });
    }
    
    return portfolio;
  }
}

// ===== UTILITY FUNCTIONS =====

export function createCohortEngine(config: Partial<CohortEngineConfig>): CohortEngine {
  const defaultConfig: CohortEngineConfig = {
    fundSize: 20000000,
    investableCapital: 18000000,
    investmentPeriodQuarters: 20,
    fundLifeQuarters: 40,
    stageStrategies: [],
    graduationMatrix: {},
    exitProbabilityMatrix: {},
    followOnReserveRatio: 0.3,
    recyclingEnabled: true,
    recyclingCap: 0.2
  };
  
  return new CohortEngine({ ...defaultConfig, ...config });
}
