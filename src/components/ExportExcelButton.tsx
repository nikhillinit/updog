// src/components/ExportExcelButton.tsx

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { useFundContext } from '../context/FundContext';
import type { FundScenario, ForecastResult, CashFlowPoint, PortfolioCompany } from '../types';

interface ExportExcelButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary';
  includeScenarios?: boolean;
}

export const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({ 
  className = '', 
  variant = 'secondary',
  includeScenarios = false
}) => {
  const fundContext = useFundContext();
  const [isExporting, setIsExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleExport = async (customOptions?: Partial<typeof fundContext.exportSettings>) => {
    setIsExporting(true);
    setShowOptions(false);

    try {
      // Ensure we have the latest forecast
      if (!fundContext.forecastResult) {
        await fundContext.calculateForecast();
      }

      if (!fundContext.forecastResult) {
        throw new Error('Unable to generate forecast');
      }

      // Merge custom options with context export settings
      const exportOptions = {
        ...fundContext.exportSettings,
        ...customOptions
      };

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Add metadata
      wb.Props = {
        Title: `${fundContext.fundName} Forecast`,
        Subject: "VC Fund Forecast Model",
        Author: "POVC Fund Model",
        CreatedDate: new Date()
      };

      // Summary Sheet
      if (exportOptions.includeCashFlows || customOptions?.includeSummary) {
        addSummarySheet(wb, fundContext.fundName, fundContext.forecastResult, fundContext);
      }

      // Cash Flows Sheet
      if (exportOptions.includeCashFlows) {
        addCashFlowsSheet(wb, fundContext.forecastResult.timeline, exportOptions.lpFriendly);
      }

      // Portfolio Sheet
      if (exportOptions.includeCompanyDetails) {
        addPortfolioSheet(wb, fundContext.forecastResult.portfolio, exportOptions.lpFriendly);
      }

      // Assumptions Sheet (if not LP friendly)
      if (exportOptions.includeAssumptions && !exportOptions.lpFriendly) {
        addAssumptionsSheet(wb, fundContext);
      }

      // Scenarios Sheet (if requested)
      if (includeScenarios && fundContext.scenarios.length > 1) {
        addScenariosSheet(wb, fundContext.scenarios);
      }

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${fundContext.fundName.replace(/\s+/g, '_')}_Forecast_${timestamp}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);

    } catch (error) {
      console.error('Excel export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export option configurations
  const exportOptions = [
    {
      label: 'Full Model',
      description: 'Complete model with all details',
      icon: FileSpreadsheet,
      options: {
        includeSummary: true,
        includeCashFlows: true,
        includeCompanyDetails: true,
        includeAssumptions: true,
        lpFriendly: false
      }
    },
    {
      label: 'LP Report',
      description: 'Simplified for LPs',
      icon: FileSpreadsheet,
      options: {
        includeSummary: true,
        includeCashFlows: true,
        includeCompanyDetails: true,
        includeAssumptions: false,
        lpFriendly: true
      }
    },
    {
      label: 'Cash Flows Only',
      description: 'Quarterly cash flow analysis',
      icon: FileSpreadsheet,
      options: {
        includeSummary: false,
        includeCashFlows: true,
        includeCompanyDetails: false,
        includeAssumptions: false,
        lpFriendly: false
      }
    },
    {
      label: 'Portfolio Summary',
      description: 'Company-level details',
      icon: FileSpreadsheet,
      options: {
        includeSummary: false,
        includeCashFlows: false,
        includeCompanyDetails: true,
        includeAssumptions: false,
        lpFriendly: false
      }
    }
  ];

  const baseClasses = variant === 'primary'
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300';

  const buttonClasses = `
    ${baseClasses}
    px-4 py-2 rounded-lg font-medium 
    transition-all duration-200 
    flex items-center gap-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${className}
  `;

  // Single button mode
  if (!showOptions && !isExporting) {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setShowOptions(true)}
          className={buttonClasses}
          disabled={!fundContext.forecastResult}
        >
          <Download className="w-4 h-4" />
          <span>Export to Excel</span>
          <ChevronDown className="w-4 h-4 ml-1" />
        </button>
      </div>
    );
  }

  // Loading state
  if (isExporting) {
    return (
      <button className={buttonClasses} disabled>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
        <span>Generating Excel...</span>
      </button>
    );
  }

  // Options dropdown
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowOptions(false)}
        className={buttonClasses}
      >
        <Download className="w-4 h-4" />
        <span>Export to Excel</span>
        <ChevronDown className="w-4 h-4 ml-1 rotate-180" />
      </button>

      <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
        <div className="py-1">
          {exportOptions.map((option, index) => (
            <button
              key={index}
              onClick={() => handleExport(option.options)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 transition-colors"
            >
              <option.icon className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {option.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Quick export with current settings */}
        <div className="border-t border-gray-200 px-4 py-3">
          <button
            onClick={() => handleExport()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Quick Export (Current Settings)
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions for creating sheets
function addSummarySheet(
  wb: XLSX.WorkBook,
  fundName: string,
  result: ForecastResult,
  fundContext: any
) {
  const summaryData = [
    [`${fundName} - Fund Summary`],
    [`Generated: ${new Date().toLocaleDateString()}`],
    [],
    ['FUND METRICS', ''],
    ['Fund Size', fundContext.fundSize],
    ['GP Commitment %', fundContext.gpCommitmentPct],
    ['Management Fee', fundContext.managementFeeRate * 100 + '%'],
    ['Carry %', fundContext.carryPct],
    [],
    ['RETURNS', ''],
    ['Gross MOIC', result.grossMoic?.toFixed(2) + 'x' || 'N/A'],
    ['Net MOIC', result.netMoic?.toFixed(2) + 'x' || 'N/A'],
    ['Gross IRR', result.grossIrr ? (result.grossIrr * 100).toFixed(1) + '%' : 'N/A'],
    ['Net IRR', result.netIrr ? (result.netIrr * 100).toFixed(1) + '%' : 'N/A'],
    ['DPI', result.dpi?.toFixed(2) || 'N/A'],
    ['TVPI', result.tvpi?.toFixed(2) || 'N/A'],
    [],
    ['PORTFOLIO', ''],
    ['Total Companies', result.portfolio.length],
    ['Active', result.portfolio.filter(c => c.status === 'active').length],
    ['Exited', result.portfolio.filter(c => c.status === 'exited').length],
    ['Written Off', result.portfolio.filter(c => c.status === 'written-off').length],
    [],
    ['CAPITAL', ''],
    ['Total Invested', result.totalInvested],
    ['Total Exit Value', result.totalExitValue],
    ['Total Management Fees', result.totalManagementFees],
    ['Total GP Carry', result.totalGpCarry]
  ];

  const ws = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Format cells
  ws['!cols'] = [{ wch: 25 }, { wch: 20 }];
  ws['!rows'] = [{ hpt: 30 }, { hpt: 20 }];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
}

function addCashFlowsSheet(
  wb: XLSX.WorkBook,
  timeline: CashFlowPoint[],
  lpFriendly: boolean
) {
  const headers = [
    'Quarter',
    'Year', 
    'Period',
    'Contributions',
    'Distributions',
    'Net Cash Flow',
    'NAV',
    'Cumulative Contributions',
    'Cumulative Distributions',
    'DPI',
    'RVPI',
    'TVPI'
  ];

  if (!lpFriendly) {
    headers.push('Management Fees', 'Gross IRR', 'Net IRR');
  }

  const data = timeline.map(point => {
    const row = [
      point.quarter,
      point.year,
      `Y${point.year}Q${((point.quarter - 1) % 4) + 1}`,
      point.contributions,
      point.distributions,
      point.distributions - point.contributions,
      point.nav,
      point.cumulativeContributions,
      point.cumulativeDistributions,
      point.dpi,
      point.rvpi,
      point.tvpi
    ];

    if (!lpFriendly) {
      row.push(
        point.managementFees || 0,
        point.grossIrr || 0,
        point.netIrr || 0
      );
    }

    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  
  // Format columns
  ws['!cols'] = headers.map((_, index) => {
    if (index <= 2) return { wch: 10 };
    return { wch: 18 };
  });
  
  XLSX.utils.book_append_sheet(wb, ws, 'Cash Flows');
}

function addPortfolioSheet(
  wb: XLSX.WorkBook,
  portfolio: PortfolioCompany[],
  lpFriendly: boolean
) {
  const headers = [
    'Company ID',
    'Company Name',
    'Entry Stage',
    'Current Stage',
    'Status',
    'Total Invested',
    'Exit Value',
    'Multiple',
    'Exit Quarter'
  ];

  if (!lpFriendly) {
    headers.push('Investment Count', 'Initial Investment', 'Follow-ons');
  }

  const data = portfolio.map(company => {
    const row = [
      company.id,
      company.name || company.id,
      company.entryStage,
      company.currentStage,
      company.status,
      company.totalInvested,
      company.exitValue || 0,
      company.exitValue ? (company.exitValue / company.totalInvested).toFixed(2) + 'x' : 'N/A',
      company.exitQuarter || ''
    ];

    if (!lpFriendly) {
      const initialInvestment = company.investments[0]?.amount || 0;
      const followOns = company.totalInvested - initialInvestment;
      row.push(
        company.investments.length,
        initialInvestment,
        followOns
      );
    }

    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  
  // Format columns
  ws['!cols'] = headers.map((_, index) => {
    if (index === 1) return { wch: 20 }; // Company name
    return { wch: 15 };
  });
  
  XLSX.utils.book_append_sheet(wb, ws, 'Portfolio');
}

function addAssumptionsSheet(wb: XLSX.WorkBook, fundContext: any) {
  const assumptionsData = [
    ['Model Assumptions'],
    [],
    ['Category', 'Parameter', 'Value', 'Notes'],
    ['Fund Structure', 'Fund Size', fundContext.fundSize, 'Total capital to deploy'],
    ['Fund Structure', 'Investment Period', fundContext.investmentPeriodYears + ' years', 'Active deployment period'],
    ['Fund Structure', 'Fund Life', fundContext.fundLifeYears + ' years', 'Total fund duration'],
    [],
    ['Economics', 'Management Fee', fundContext.managementFeeRate * 100 + '%', 'Annual fee on committed capital'],
    ['Economics', 'Carried Interest', fundContext.carryPct + '%', 'GP share of profits'],
    ['Economics', 'GP Commitment', fundContext.gpCommitmentPct + '%', 'GP capital commitment'],
    [],
    ['Portfolio Construction', '', '', ''],
    ...fundContext.stageStrategies.map((strategy: any) => [
      'Stage Allocation',
      strategy.stage,
      strategy.allocationPct + '%',
      `Target: ${strategy.numFirstChecks || Math.round(fundContext.fundSize * strategy.allocationPct / 100 / strategy.avgInvestmentSize)} investments`
    ])
  ];

  const ws = XLSX.utils.aoa_to_sheet(assumptionsData);
  ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 40 }];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Assumptions');
}

function addScenariosSheet(wb: XLSX.WorkBook, scenarios: FundScenario[]) {
  const headers = [
    'Scenario',
    'Description',
    'Gross MOIC',
    'Net MOIC',
    'Gross IRR',
    'Net IRR',
    'DPI',
    'TVPI'
  ];

  const data = scenarios
    .filter(s => s.results)
    .map(scenario => [
      scenario.name,
      scenario.description || '',
      scenario.results?.grossMoic?.toFixed(2) + 'x' || 'N/A',
      scenario.results?.netMoic?.toFixed(2) + 'x' || 'N/A',
      scenario.results?.grossIrr ? (scenario.results.grossIrr * 100).toFixed(1) + '%' : 'N/A',
      scenario.results?.netIrr ? (scenario.results.netIrr * 100).toFixed(1) + '%' : 'N/A',
      scenario.results?.dpi?.toFixed(2) || 'N/A',
      scenario.results?.tvpi?.toFixed(2) || 'N/A'
    ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  
  ws['!cols'] = [
    { wch: 20 }, // Scenario name
    { wch: 30 }, // Description
    { wch: 12 }, // Gross MOIC
    { wch: 12 }, // Net MOIC
    { wch: 12 }, // Gross IRR
    { wch: 12 }, // Net IRR
    { wch: 10 }, // DPI
    { wch: 10 }  // TVPI
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Scenarios');
}

export default ExportExcelButton;
