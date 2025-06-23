import React, { useState, useMemo } from 'react';
import { useFundContext } from '../context/FundContext';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ExcelExportButton from '../components/ExcelExportButton';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import { TrendingUp, DollarSign, Target, Edit2, Save, X } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
const STAGE_COLORS = {
  'Pre-Seed': '#EC4899',
  'Seed': '#8B5CF6',
  'Series A': '#3B82F6',
  'Series B': '#10B981',
  'Series C': '#F59E0B',
  'Series D+': '#EF4444'
};

export default function ExitsAnalysis() {
  const fundContext = useFundContext();
  const [isEditingMatrix, setIsEditingMatrix] = useState(false);
  const [tempExitProbs, setTempExitProbs] = useState({});

  const { 
    fundSize,
    stageStrategies,
    forecastResult,
    exitProbabilityMatrix,
    updateExitProbability,
    isCalculating
  } = fundContext;

  // Exit metrics
  const exitMetrics = useMemo(() => {
    if (!forecastResult) return null;

    const exitedCompanies = forecastResult.portfolio.filter(c => c.status === 'exited');
    const totalCompanies = forecastResult.portfolio.length;
    const totalExitValue = exitedCompanies.reduce((sum, c) => sum + (c.exitValue || 0), 0);
    
    const exitsByStage = stageStrategies.map(strategy => {
      const stageExits = exitedCompanies.filter(c => c.entryStage === strategy.stage);
      return {
        stage: strategy.stage,
        count: stageExits.length,
        value: stageExits.reduce((sum, c) => sum + (c.exitValue || 0), 0),
        avgMultiple: stageExits.length > 0
          ? stageExits.reduce((sum, c) => sum + ((c.exitValue || 0) / c.totalInvested), 0) / stageExits.length
          : 0
      };
    });

    return {
      totalExits: exitedCompanies.length,
      exitRate: totalCompanies > 0 ? exitedCompanies.length / totalCompanies : 0,
      totalExitValue,
      avgExitSize: exitedCompanies.length > 0 ? totalExitValue / exitedCompanies.length : 0,
      exitsByStage,
      topExits: exitedCompanies
        .sort((a, b) => (b.exitValue || 0) - (a.exitValue || 0))
        .slice(0, 5)
    };
  }, [forecastResult, stageStrategies]);

  // Exit distribution data
  const exitDistribution = useMemo(() => {
    if (!forecastResult) return [];

    const distribution = [
      { range: '0x (Failed)', count: 0, value: 0, color: COLORS[0] },
      { range: '1-3x', count: 0, value: 0, color: COLORS[1] },
      { range: '3-5x', count: 0, value: 0, color: COLORS[2] },
      { range: '5-10x', count: 0, value: 0, color: COLORS[3] },
      { range: '10x+', count: 0, value: 0, color: COLORS[4] }
    ];

    forecastResult.portfolio.forEach(company => {
      if (!company.exitValue || company.totalInvested === 0) {
        distribution[0].count++;
      } else {
        const multiple = company.exitValue / company.totalInvested;
        if (multiple < 1) distribution[0].count++;
        else if (multiple < 3) {
          distribution[1].count++;
          distribution[1].value += company.exitValue;
        } else if (multiple < 5) {
          distribution[2].count++;
          distribution[2].value += company.exitValue;
        } else if (multiple < 10) {
          distribution[3].count++;
          distribution[3].value += company.exitValue;
        } else {
          distribution[4].count++;
          distribution[4].value += company.exitValue;
        }
      }
    });

    return distribution;
  }, [forecastResult]);

  // Holding period analysis
  const holdingPeriods = useMemo(() => {
    if (!forecastResult) return [];

    const periods = stageStrategies.map(strategy => {
      const stageCompanies = forecastResult.portfolio.filter(c => c.entryStage === strategy.stage);
      const exitedCompanies = stageCompanies.filter(c => c.status === 'exited' && c.exitQuarter);
      
      const avgHoldingPeriod = exitedCompanies.length > 0
        ? exitedCompanies.reduce((sum, c) => {
            const entryQuarter = c.investments[0]?.quarter || 0;
            const holdingQuarters = (c.exitQuarter || 0) - entryQuarter;
            return sum + holdingQuarters / 4; // Convert to years
          }, 0) / exitedCompanies.length
        : 0;

      return {
        stage: strategy.stage,
        avgYears: avgHoldingPeriod,
        minYears: avgHoldingPeriod * 0.75,
        maxYears: avgHoldingPeriod * 1.5,
        color: STAGE_COLORS[strategy.stage as keyof typeof STAGE_COLORS]
      };
    });

    return periods;
  }, [forecastResult, stageStrategies]);

  // Handle exit probability editing
  const startEditingMatrix = () => {
    setTempExitProbs(JSON.parse(JSON.stringify(exitProbabilityMatrix)));
    setIsEditingMatrix(true);
  };

  const saveMatrix = () => {
    Object.entries(tempExitProbs).forEach(([stage, probs]: [string, any]) => {
      Object.entries(probs).forEach(([field, value]) => {
        updateExitProbability(stage, field, value as number);
      });
    });
    setIsEditingMatrix(false);
  };

  const updateTempProbability = (stage: string, field: string, value: number) => {
    setTempExitProbs(prev => ({
      ...prev,
      [stage]: {
        ...(prev as any)[stage],
        [field]: value / 100
      }
    }));
  };

  if (isCalculating) {
    return <LoadingSpinner message="Analyzing exit data..." />;
  }

  if (!forecastResult || !exitMetrics) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">
            Please run a fund forecast first to see exit analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exits Analysis</h1>
          <p className="mt-2 text-sm text-gray-600">
            Exit performance, timing, and probability analysis
          </p>
        </div>
        <ExcelExportButton />
      </div>

      {/* Key Exit Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Total Exits"
          value={exitMetrics.totalExits}
          subValue={`${(exitMetrics.exitRate * 100).toFixed(0)}% exit rate`}
          icon={Target}
          color="blue"
        />
        <MetricCard
          label="Total Exit Value"
          value={formatCurrency(exitMetrics.totalExitValue)}
          subValue="Gross proceeds"
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          label="Avg Exit Size"
          value={formatCurrency(exitMetrics.avgExitSize)}
          subValue="Per company"
          icon={TrendingUp}
          color="purple"
        />
        <MetricCard
          label="Best Multiple"
          value={`${Math.max(...exitMetrics.exitsByStage.map(s => s.avgMultiple)).toFixed(1)}x`}
          subValue="Highest stage avg"
          icon={Target}
          color="indigo"
        />
      </div>

      {/* Exit Probability Matrix */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Exit Probability Matrix</h2>
          {!isEditingMatrix ? (
            <button
              onClick={startEditingMatrix}
              className="flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={saveMatrix}
                className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </button>
              <button
                onClick={() => setIsEditingMatrix(false)}
                className="flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Failure</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">1-3x</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">3-5x</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">5-10x</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">10x+</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Object.entries(exitProbabilityMatrix || {}).map(([stage, probs]) => (
                <tr key={stage}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{stage}</td>
                  {isEditingMatrix ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={((tempExitProbs as any)[stage]?.failure || 0) * 100}
                          onChange={(e) => updateTempProbability(stage, 'failure', parseFloat(e.target.value))}
                          className="w-16 px-2 py-1 text-sm text-center border rounded"
                          min="0"
                          max="100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={((tempExitProbs as any)[stage]?.lowMultiple || 0) * 100}
                          onChange={(e) => updateTempProbability(stage, 'lowMultiple', parseFloat(e.target.value))}
                          className="w-16 px-2 py-1 text-sm text-center border rounded"
                          min="0"
                          max="100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={((tempExitProbs as any)[stage]?.mediumMultiple || 0) * 100}
                          onChange={(e) => updateTempProbability(stage, 'mediumMultiple', parseFloat(e.target.value))}
                          className="w-16 px-2 py-1 text-sm text-center border rounded"
                          min="0"
                          max="100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={((tempExitProbs as any)[stage]?.highMultiple || 0) * 100}
                          onChange={(e) => updateTempProbability(stage, 'highMultiple', parseFloat(e.target.value))}
                          className="w-16 px-2 py-1 text-sm text-center border rounded"
                          min="0"
                          max="100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={((tempExitProbs as any)[stage]?.homeRun || 0) * 100}
                          onChange={(e) => updateTempProbability(stage, 'homeRun', parseFloat(e.target.value))}
                          className="w-16 px-2 py-1 text-sm text-center border rounded"
                          min="0"
                          max="100"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm text-center text-red-600">
                        {formatPercent(probs.failure)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-yellow-600">
                        {formatPercent(probs.lowMultiple)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-blue-600">
                        {formatPercent(probs.mediumMultiple)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-green-600">
                        {formatPercent(probs.highMultiple)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-purple-600">
                        {formatPercent(probs.homeRun)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exit Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exit Multiple Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Exit Multiple Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={exitDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <RechartsTooltip />
              <Bar dataKey="count" name="# of Exits">
                {exitDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Exit Value by Stage */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Exit Value by Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={exitMetrics.exitsByStage.filter(s => s.value > 0)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ stage, value }) => `${stage}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {exitMetrics.exitsByStage.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STAGE_COLORS[entry.stage as keyof typeof STAGE_COLORS]} 
                  />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Holding Period Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Holding Period by Stage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={holdingPeriods}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={{ value: 'Years', angle: -90, position: 'insideLeft' }}
            />
            <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)} years`} />
            <Bar dataKey="avgYears" name="Avg Holding Period">
              {holdingPeriods.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Exits Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Exits</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invested</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Exit Value</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Multiple</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {exitMetrics.topExits.map((company, index) => (
                <tr key={company.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{company.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{company.entryStage}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatCurrency(company.totalInvested)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatCurrency(company.exitValue || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-right">
                    <span className={`
                      ${(company.exitValue || 0) / company.totalInvested >= 10 ? 'text-purple-600' :
                        (company.exitValue || 0) / company.totalInvested >= 5 ? 'text-green-600' :
                        (company.exitValue || 0) / company.totalInvested >= 3 ? 'text-blue-600' :
                        'text-gray-600'}
                    `}>
                      {((company.exitValue || 0) / company.totalInvested).toFixed(1)}x
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
