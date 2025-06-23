// src/pages/ScenarioComparison.tsx

import React from 'react';
import { useFundContext } from '../context/FundContext';
import DataTable from '../components/DataTable';
import LoadingSpinner from '../components/LoadingSpinner';

const ScenarioComparison: React.FC = () => {
  const { scenarios, isCalculating } = useFundContext();

  if (isCalculating) {
    return <LoadingSpinner message="Loading scenario comparison..." />;
  }

  const scenarioColumns = [
    {
      key: 'name',
      header: 'Scenario',
      cell: (scenario: any) => (
        <div>
          <div className="font-medium text-gray-900">{scenario.name}</div>
          <div className="text-sm text-gray-500">{scenario.description || 'No description'}</div>
        </div>
      )
    },
    {
      key: 'grossMoic',
      header: 'Gross MOIC',
      cell: (scenario: any) => (
        <span className="font-medium">
          {scenario.results ? `${scenario.results.grossMoic.toFixed(2)}x` : 'Pending'}
        </span>
      )
    },
    {
      key: 'netIrr',
      header: 'Net IRR',
      cell: (scenario: any) => (
        <span className="font-medium">
          {scenario.results ? `${(scenario.results.netIrr * 100).toFixed(1)}%` : 'Pending'}
        </span>
      )
    },
    {
      key: 'tvpi',
      header: 'TVPI',
      cell: (scenario: any) => (
        <span className="font-medium">
          {scenario.results ? `${scenario.results.tvpi.toFixed(2)}x` : 'Pending'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      cell: (scenario: any) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          scenario.results ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {scenario.results ? 'Calculated' : 'Pending'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scenario Comparison</h1>
        <p className="mt-2 text-gray-600">
          Compare different fund assumptions and analyze sensitivity to key parameters
        </p>
      </div>

      <DataTable
        data={scenarios}
        columns={scenarioColumns}
        emptyMessage="No scenarios available"
      />

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Scenario Analysis</h3>
        </div>
        <div className="card-body">
          <p className="text-gray-600">
            Advanced scenario comparison charts and sensitivity analysis will be displayed here.
            This includes your sophisticated batch runner and scenario table builder integration.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScenarioComparison;
