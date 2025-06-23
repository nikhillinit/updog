// src/pages/PortfolioManagement.tsx

import React from 'react';
import { useFundContext } from '../context/FundContext';
import DataTable from '../components/DataTable';
import LoadingSpinner from '../components/LoadingSpinner';

const PortfolioManagement: React.FC = () => {
  const { isCalculating, forecastResult } = useFundContext();

  if (isCalculating) {
    return <LoadingSpinner message="Loading portfolio data..." />;
  }

  const portfolioColumns = [
    {
      key: 'name',
      header: 'Company',
      cell: (company: any) => (
        <div>
          <div className="font-medium text-gray-900">{company.name}</div>
          <div className="text-sm text-gray-500">{company.currentStage}</div>
        </div>
      )
    },
    {
      key: 'totalInvested',
      header: 'Invested',
      cell: (company: any) => (
        <span className="font-medium">
          ${(company.totalInvested / 1000).toFixed(0)}K
        </span>
      )
    },
    {
      key: 'exitValue',
      header: 'Exit Value',
      cell: (company: any) => (
        <span className={company.exitValue ? 'text-green-600' : 'text-gray-400'}>
          {company.exitValue ? `$${(company.exitValue / 1000000).toFixed(1)}M` : 'TBD'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      cell: (company: any) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          company.status === 'active' ? 'bg-green-100 text-green-800' :
          company.status === 'exited' ? 'bg-blue-100 text-blue-800' :
          'bg-red-100 text-red-800'
        }`}>
          {company.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Portfolio Management</h1>
        <p className="mt-2 text-gray-600">
          Company-level investments, performance tracking, and portfolio analytics
        </p>
      </div>

      {forecastResult?.portfolio && forecastResult.portfolio.length > 0 ? (
        <DataTable
          data={forecastResult.portfolio}
          columns={portfolioColumns}
          emptyMessage="No portfolio companies found"
        />
      ) : (
        <div className="card">
          <div className="card-body text-center py-12">
            <p className="text-gray-500">
              Portfolio companies will appear here after fund calculation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioManagement;
