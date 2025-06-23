// src/pages/FundOverview.tsx

import React from 'react';
import { useFundContext } from '../context/FundContext';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { DollarSign, TrendingUp, Target, BarChart3 } from 'lucide-react';

const FundOverview: React.FC = () => {
  const { 
    fundName,
    fundSize,
    managementFeeRate,
    carryPct,
    forecastResult,
    isCalculating,
    investableCapital,
    totalManagementFees
  } = useFundContext();

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  
  const formatPercent = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(value);

  if (isCalculating) {
    return <LoadingSpinner message="Calculating fund metrics..." />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Fund Overview Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{fundName}</h1>
        <p className="mt-2 text-gray-600">
          Fund overview and key performance metrics
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Fund Size"
          value={formatCurrency(fundSize)}
          subValue={`Investable: ${formatCurrency(investableCapital)}`}
          icon={DollarSign}
          color="blue"
        />
        <MetricCard
          label="Management Fee"
          value={formatPercent(managementFeeRate)}
          subValue={`Total: ${formatCurrency(totalManagementFees)}`}
          icon={BarChart3}
          color="purple"
        />
        <MetricCard
          label="Carry"
          value={formatPercent(carryPct)}
          subValue="American waterfall"
          icon={TrendingUp}
          color="green"
        />
        <MetricCard
          label="Portfolio"
          value={forecastResult?.intermediates.companiesCreated || 0}
          subValue={`${forecastResult?.intermediates.companiesExited || 0} exits`}
          icon={Target}
          color="indigo"
        />
      </div>

      {/* Performance Metrics */}
      {forecastResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            label="Gross MOIC"
            value={`${forecastResult.grossMoic.toFixed(2)}x`}
            subValue={`Net: ${forecastResult.netMoic.toFixed(2)}x`}
            color="green"
          />
          <MetricCard
            label="Gross IRR"
            value={formatPercent(forecastResult.grossIrr)}
            subValue={`Net: ${formatPercent(forecastResult.netIrr)}`}
            color="blue"
          />
          <MetricCard
            label="TVPI"
            value={`${forecastResult.tvpi.toFixed(2)}x`}
            subValue={`DPI: ${forecastResult.dpi.toFixed(2)}x | RVPI: ${forecastResult.rvpi.toFixed(2)}x`}
            color="purple"
          />
        </div>
      )}

      {/* Placeholder for charts and detailed content */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Fund Parameters</h3>
        </div>
        <div className="card-body">
          <p className="text-gray-600">
            Fund parameter configuration and scenario modeling will be available here.
            This is a comprehensive Alpha build with all sophisticated models integrated.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FundOverview;
