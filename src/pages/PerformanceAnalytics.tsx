// src/pages/PerformanceAnalytics.tsx

import React from 'react';
import { useFundContext } from '../context/FundContext';
import LoadingSpinner from '../components/LoadingSpinner';

const PerformanceAnalytics: React.FC = () => {
  const { isCalculating, forecastResult } = useFundContext();

  if (isCalculating) {
    return <LoadingSpinner message="Loading performance analytics..." />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance Analytics</h1>
        <p className="mt-2 text-gray-600">
          Returns analysis, cash flows, and performance metrics over time
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Performance Over Time</h3>
        </div>
        <div className="card-body">
          <p className="text-gray-600">
            Interactive charts showing NAV progression, cash flows, and performance ratios will be displayed here.
            Full integration with Recharts and your sophisticated fund model.
          </p>
          {forecastResult && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-900">Total Invested</div>
                <div className="text-gray-600">${(forecastResult.totalInvested / 1000000).toFixed(1)}M</div>
              </div>
              <div>
                <div className="font-medium text-gray-900">Total Exit Value</div>
                <div className="text-gray-600">${(forecastResult.totalExitValue / 1000000).toFixed(1)}M</div>
              </div>
              <div>
                <div className="font-medium text-gray-900">GP Carry</div>
                <div className="text-gray-600">${(forecastResult.totalGpCarry / 1000000).toFixed(1)}M</div>
              </div>
              <div>
                <div className="font-medium text-gray-900">LP Profit</div>
                <div className="text-gray-600">${(forecastResult.totalLpProfit / 1000000).toFixed(1)}M</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalytics;
