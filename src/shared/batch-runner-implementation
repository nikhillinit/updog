// src/shared/batchRunner.ts
import { EnhancedFundInputs, ForecastResult } from '../types/index';
import { buildEnhancedFundForecast, clearCalculationCache } from './enhanced-fund-model';

export interface ScenarioRange {
  field: string;
  min: number;
  max: number;
  step: number;
  format?: 'percent' | 'currency' | 'number';
}

export interface BatchScenario {
  id: string;
  name: string;
  inputs: EnhancedFundInputs;
  variations: Record<string, number>;
}

export interface BatchResult {
  scenarioId: string;
  scenarioName: string;
  variations: Record<string, number>;
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
    lpProfit: number;
  };
}

export interface BatchRunnerOptions {
  baseInputs: EnhancedFundInputs;
  ranges: ScenarioRange[];
  parallel?: boolean;
  maxWorkers?: number;
  onProgress?: (progress: number, currentScenario: string) => void;
  onComplete?: (results: BatchResult[]) => void;
  onError?: (error: Error) => void;
}

export class BatchRunner {
  private options: BatchRunnerOptions;
  private results: BatchResult[] = [];
  private totalScenarios: number = 0;
  private completedScenarios: number = 0;
  
  constructor(options: BatchRunnerOptions) {
    this.options = options;
    this.totalScenarios = this.calculateTotalScenarios();
  }
  
  private calculateTotalScenarios(): number {
    return this.options.ranges.reduce((total, range) => {
      const steps = Math.floor((range.max - range.min) / range.step) + 1;
      return total * steps;
    }, 1);
  }
  
  private generateScenarios(): BatchScenario[] {
    const scenarios: BatchScenario[] = [];
    const { baseInputs, ranges } = this.options;
    
    // Generate all combinations
    const generateCombinations = (rangeIndex: number, currentVariations: Record<string, number>): void => {
      if (rangeIndex >= ranges.length) {
        const scenarioId = Object.entries(currentVariations)
          .map(([field, value]) => `${field}_${value}`)
          .join('_');
        
        const scenarioName = Object.entries(currentVariations)
          .map(([field, value]) => `${field}: ${this.formatValue(value, field)}`)
          .join(', ');
        
        // Create modified inputs
        const modifiedInputs = this.applyVariations(baseInputs, currentVariations);
        
        scenarios.push({
          id: scenarioId,
          name: scenarioName,
          inputs: modifiedInputs,
          variations: { ...currentVariations }
        });
        
        return;
      }
      
      const range = ranges[rangeIndex];
      for (let value = range.min; value <= range.max; value += range.step) {
        const newVariations = { ...currentVariations, [range.field]: value };
        generateCombinations(rangeIndex + 1, newVariations);
      }
    };
    
    generateCombinations(0, {});
    return scenarios;
  }
  
  private applyVariations(baseInputs: EnhancedFundInputs, variations: Record<string, number>): EnhancedFundInputs {
    const modified = { ...baseInputs };
    
    for (const [field, value] of Object.entries(variations)) {
      // Handle nested fields (e.g., stageStrategies[0].allocationPct)
      if (field.includes('[') && field.includes(']')) {
        const match = field.match(/(\w+)\[(\d+)\]\.(\w+)/);
        if (match) {
          const [, arrayField, indexStr, property] = match;
          const index = parseInt(indexStr);
          
          if (arrayField === 'stageStrategies' && modified.stageStrategies[index]) {
            modified.stageStrategies = [...modified.stageStrategies];
            modified.stageStrategies[index] = {
              ...modified.stageStrategies[index],
              [property]: value
            };
          }
        }
      } else {
        // Simple field assignment
        (modified as any)[field] = value;
      }
    }
    
    return modified;
  }
  
  private formatValue(value: number, field: string): string {
    const range = this.options.ranges.find(r => r.field === field);
    if (!range) return value.toString();
    
    switch (range.format) {
      case 'percent':
        return `${(value * 100).toFixed(1)}%`;
      case 'currency':
        return `$${(value / 1000000).toFixed(1)}M`;
      default:
        return value.toFixed(2);
    }
  }
  
  async run(): Promise<BatchResult[]> {
    this.results = [];
    this.completedScenarios = 0;
    
    try {
      const scenarios = this.generateScenarios();
      
      if (this.options.parallel && typeof Worker !== 'undefined') {
        // Parallel execution using Web Workers
        return await this.runParallel(scenarios);
      } else {
        // Sequential execution
        return await this.runSequential(scenarios);
      }
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error as Error);
      }
      throw error;
    }
  }
  
  private async runSequential(scenarios: BatchScenario[]): Promise<BatchResult[]> {
    for (const scenario of scenarios) {
      try {
        // Clear cache periodically to prevent memory issues
        if (this.completedScenarios % 50 === 0) {
          clearCalculationCache();
        }
        
        const result = buildEnhancedFundForecast(scenario.inputs);
        
        const batchResult: BatchResult = {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          variations: scenario.variations,
          result,
          metrics: {
            grossMoic: result.grossMoic,
            netMoic: result.netMoic,
            grossIrr: result.grossIrr,
            netIrr: result.netIrr,
            tvpi: result.tvpi,
            dpi: result.dpi,
            totalInvested: result.totalInvested,
            totalExitValue: result.totalExitValue,
            lpProfit: result.totalLpProfit
          }
        };
        
        this.results.push(batchResult);
        this.completedScenarios++;
        
        if (this.options.onProgress) {
          const progress = (this.completedScenarios / this.totalScenarios) * 100;
          this.options.onProgress(progress, scenario.name);
        }
      } catch (error) {
        console.error(`Error in scenario ${scenario.name}:`, error);
        // Continue with next scenario
      }
    }
    
    if (this.options.onComplete) {
      this.options.onComplete(this.results);
    }
    
    return this.results;
  }
  
  private async runParallel(scenarios: BatchScenario[]): Promise<BatchResult[]> {
    const maxWorkers = this.options.maxWorkers || navigator.hardwareConcurrency || 4;
    const chunks = this.chunkArray(scenarios, Math.ceil(scenarios.length / maxWorkers));
    
    const workerPromises = chunks.map((chunk, index) => {
      return this.runWorkerChunk(chunk, index);
    });
    
    const chunkResults = await Promise.all(workerPromises);
    this.results = chunkResults.flat();
    
    if (this.options.onComplete) {
      this.options.onComplete(this.results);
    }
    
    return this.results;
  }
  
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  private async runWorkerChunk(scenarios: BatchScenario[], workerId: number): Promise<BatchResult[]> {
    // Simplified worker implementation
    // In production, this would use actual Web Workers
    const results: BatchResult[] = [];
    
    for (const scenario of scenarios) {
      try {
        const result = buildEnhancedFundForecast(scenario.inputs);
        
        results.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          variations: scenario.variations,
          result,
          metrics: {
            grossMoic: result.grossMoic,
            netMoic: result.netMoic,
            grossIrr: result.grossIrr,
            netIrr: result.netIrr,
            tvpi: result.tvpi,
            dpi: result.dpi,
            totalInvested: result.totalInvested,
            totalExitValue: result.totalExitValue,
            lpProfit: result.totalLpProfit
          }
        });
        
        this.completedScenarios++;
        
        if (this.options.onProgress) {
          const progress = (this.completedScenarios / this.totalScenarios) * 100;
          this.options.onProgress(progress, scenario.name);
        }
      } catch (error) {
        console.error(`Worker ${workerId} error in scenario ${scenario.name}:`, error);
      }
    }
    
    return results;
  }
  
  getResults(): BatchResult[] {
    return this.results;
  }
  
  getSummaryStatistics(): {
    best: BatchResult | null;
    worst: BatchResult | null;
    median: BatchResult | null;
    mean: {
      grossMoic: number;
      netMoic: number;
      grossIrr: number;
      netIrr: number;
      tvpi: number;
    };
    stdDev: {
      grossMoic: number;
      netMoic: number;
      grossIrr: number;
      netIrr: number;
      tvpi: number;
    };
  } {
    if (this.results.length === 0) {
      return {
        best: null,
        worst: null,
        median: null,
        mean: { grossMoic: 0, netMoic: 0, grossIrr: 0, netIrr: 0, tvpi: 0 },
        stdDev: { grossMoic: 0, netMoic: 0, grossIrr: 0, netIrr: 0, tvpi: 0 }
      };
    }
    
    // Sort by net IRR
    const sorted = [...this.results].sort((a, b) => b.metrics.netIrr - a.metrics.netIrr);
    
    // Calculate statistics
    const sum = this.results.reduce((acc, r) => ({
      grossMoic: acc.grossMoic + r.metrics.grossMoic,
      netMoic: acc.netMoic + r.metrics.netMoic,
      grossIrr: acc.grossIrr + r.metrics.grossIrr,
      netIrr: acc.netIrr + r.metrics.netIrr,
      tvpi: acc.tvpi + r.metrics.tvpi
    }), { grossMoic: 0, netMoic: 0, grossIrr: 0, netIrr: 0, tvpi: 0 });
    
    const count = this.results.length;
    const mean = {
      grossMoic: sum.grossMoic / count,
      netMoic: sum.netMoic / count,
      grossIrr: sum.grossIrr / count,
      netIrr: sum.netIrr / count,
      tvpi: sum.tvpi / count
    };
    
    // Calculate standard deviation
    const variance = this.results.reduce((acc, r) => ({
      grossMoic: acc.grossMoic + Math.pow(r.metrics.grossMoic - mean.grossMoic, 2),
      netMoic: acc.netMoic + Math.pow(r.metrics.netMoic - mean.netMoic, 2),
      grossIrr: acc.grossIrr + Math.pow(r.metrics.grossIrr - mean.grossIrr, 2),
      netIrr: acc.netIrr + Math.pow(r.metrics.netIrr - mean.netIrr, 2),
      tvpi: acc.tvpi + Math.pow(r.metrics.tvpi - mean.tvpi, 2)
    }), { grossMoic: 0, netMoic: 0, grossIrr: 0, netIrr: 0, tvpi: 0 });
    
    const stdDev = {
      grossMoic: Math.sqrt(variance.grossMoic / count),
      netMoic: Math.sqrt(variance.netMoic / count),
      grossIrr: Math.sqrt(variance.grossIrr / count),
      netIrr: Math.sqrt(variance.netIrr / count),
      tvpi: Math.sqrt(variance.tvpi / count)
    };
    
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      mean,
      stdDev
    };
  }
}

// Utility function for quick batch runs
export async function runBatchScenarios(
  baseInputs: EnhancedFundInputs,
  ranges: ScenarioRange[],
  options?: Partial<BatchRunnerOptions>
): Promise<BatchResult[]> {
  const runner = new BatchRunner({
    baseInputs,
    ranges,
    ...options
  });
  
  return await runner.run();
}
