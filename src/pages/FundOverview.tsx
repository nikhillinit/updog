import React, { useMemo } from 'react';
import { useFundContext } from '../context/FundContext';
import MetricCard from '../components/MetricCard';
import { SliderInput, PercentageSlider, CurrencySlider } from '../components/SliderInput';
import LoadingSpinner from '../components/LoadingSpinner';
import ExcelExportButton from '../components/ExcelExportButton';
import { DollarSign, TrendingUp, Users, Calendar, PieChart, AlertCircle } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function FundOverview() {
  const fundContext = useFundContext();
  const {
    fundName,
    fundSize,
    fundLifeYears,
    investmentPeriodYears,
    managementFeeRate,
    carryPct,
    gpCommitmentPct,
    stageStrategies,
    forecastResult,
    isCalculating,
    investableCapital,
    totalManagementFees,
    updateFundParameter,
    calculateForecast
  } = fundContext;

  // Calculate key fund metrics
  const metrics = useMemo(() => {
    const totalPortfolioSize = stageStrategies.reduce((sum, s) => sum + s.numFirstChecks, 0);
    const avgCheckSize = stageStrategies.reduce((sum, s) => sum + s.avgInvestmentSize * s.allocationPct, 0);
    const initialCapitalDeployment = stageStrategies.reduce((sum, s) => sum + s.avgInvestmentSize * s.numFirstChecks, 0);
    const reserveRatio = ((investableCapital - initialCapitalDeployment) / investableCapital) * 100;

    return {
      totalPortfolioSize,
      avgCheckSize,
      initialCapitalDeployment,
      reserveRatio,
      lpCommitment: fundSize * (1 - gpCommitmentPct / 100),
      gpCommitment: fundSize * (gpCommitmentPct / 100)
    };
  }, [fundSize, stageStrategies, gpCommitmentPct, investableCapital]);

  // Stage allocation breakdown
  const stageBreakdown = useMemo(() => {
    return stageStrategies.map(strategy => ({
      stage: strategy.stage,
      allocation: strategy.allocationPct * 100,
      companies: strategy.numFirstChecks,
      avgCheck: strategy.avgInvestmentSize,
      totalCapital: strategy.allocationPct * investableCapital
    }));
  }, [stageStrategies, investableCapital]);

  if (isCalculating) {
    return <LoadingSpinner message="Calculating fund metrics..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{fundName || 'Fund Overview'}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Comprehensive overview of fund structure and allocation strategy
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-4">
          <ExcelExportButton />
          <button
            onClick={calculateForecast}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Calculate Forecast
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Fund Size"
          value={formatCurrency(fundSize)}
          subValue="Total commitments"
          icon={DollarSign}
          color="blue"
        />
        <MetricCard
          label="Investable Capital"
          value={formatCurrency(investableCapital)}
          subValue="After fees"
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          label="Portfolio Size"
          value={metrics.totalPortfolioSize}
          subValue="Target companies"
          icon={Users}
          color="purple"
        />
        <MetricCard
          label="Reserve Ratio"
          value={`${metrics.reserveRatio.toFixed(0)}%`}
          subValue="For follow-ons"
          icon={PieChart}
          color="indigo"
        />
      </div>

      {/* Interactive Parameters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Fund Parameters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CurrencySlider
            label="Fund Size"
            value={fundSize}
            onChange={(value) => updateFundParameter('fundSize', value)}
            min={10000000}
            max={500000000}
            step={5000000}
            tooltip="Total capital commitments from all LPs"
          />
          
          <PercentageSlider
            label="Management Fee"
            value={managementFeeRate * 100}
            onChange={(value) => updateFundParameter('managementFeeRate', value / 100)}
            min={1}
            max={3}
            step={0.25}
            tooltip="Annual management fee percentage"
          />
          
          <PercentageSlider
            label="Carry Percentage"
            value={carryPct * 100}
            onChange={(value) => updateFundParameter('carryPct', value / 100)}
            min={10}
            max={30}
            step={5}
            tooltip="GP share of profits above hurdle"
          />
          
          <PercentageSlider
            label="GP Commitment"
            value={gpCommitmentPct}
            onChange={(value) => updateFundParameter('gpCommitmentPct', value)}
            min={1}
            max={5}
            step={0.5}
            tooltip="GP investment as % of fund"
          />
        </div>
      </div>

      {/* Stage Allocation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Stage Allocation Strategy</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Allocation %
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  # Companies
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Check Size
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Capital
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stageBreakdown.map((stage, index) => (
                <tr key={stage.stage} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stage.stage}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {stage.allocation.toFixed(0)}%
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {stage.companies}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(stage.avgCheck)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(stage.totalCapital)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fund Economics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">LP/GP Split</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">LP Commitment</span>
              <span className="text-sm font-medium">{formatCurrency(metrics.lpCommitment)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">GP Commitment</span>
              <span className="text-sm font-medium">{formatCurrency(metrics.gpCommitment)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">Total Fund Size</span>
                <span className="text-sm font-bold">{formatCurrency(fundSize)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fee Structure</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Management Fee</span>
              <span className="text-sm font-medium">{formatPercent(managementFeeRate)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Mgmt Fees</span>
              <span className="text-sm font-medium">{formatCurrency(totalManagementFees)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Carried Interest</span>
              <span className="text-sm font-medium">{formatPercent(carryPct)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Preview */}
      {forecastResult && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Preview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Net TVPI</p>
              <p className="text-2xl font-bold text-gray-900">
                {forecastResult.tvpi.toFixed(2)}x
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Net DPI</p>
              <p className="text-2xl font-bold text-gray-900">
                {forecastResult.dpi.toFixed(2)}x
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Net IRR</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercent(forecastResult.netIrr)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Net MOIC</p>
              <p className="text-2xl font-bold text-gray-900">
                {forecastResult.netMoic.toFixed(2)}x
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
