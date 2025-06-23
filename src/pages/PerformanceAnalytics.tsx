import React, { useMemo } from 'react';
import { useFundContext } from '../context/FundContext';
import MetricCard from '../components/MetricCard';
import JCurveChart from '../components/JCurveChart';
import LoadingSpinner from '../components/LoadingSpinner';
import ExcelExportButton from '../components/ExcelExportButton';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, DollarSign, Activity, Target } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function PerformanceAnalytics() {
  const fundContext = useFundContext();
  const { 
    fundSize,
    stageStrategies,
    forecastResult,
    isCalculating
  } = fundContext;

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    if (!forecastResult) return null;
    
    const lastPoint = forecastResult.timeline[forecastResult.timeline.length - 1];
    const midPoint = forecastResult.timeline[Math.floor(forecastResult.timeline.length / 2)];
    
    return {
      currentTVPI: lastPoint.tvpi,
      currentDPI: lastPoint.dpi,
      currentRVPI: lastPoint.rvpi,
      grossMOIC: forecastResult.grossMoic,
      netMOIC: forecastResult.netMoic,
      grossIRR: forecastResult.grossIrr,
      netIRR: forecastResult.netIrr,
      totalDistributions: lastPoint.cumulativeDistributions,
      unrealizedValue: lastPoint.nav,
      midpointTVPI: midPoint.tvpi,
      deploymentRate: (forecastResult.totalInvested / fundSize) * 100
    };
  }, [forecastResult, fundSize]);

  // Timeline data for charts
  const timelineData = useMemo(() => {
    if (!forecastResult) return [];
    
    return forecastResult.timeline.map(point => ({
      quarter: `Y${point.year}Q${(point.quarter % 4) + 1}`,
      year: point.year,
      tvpi: point.tvpi,
      dpi: point.dpi,
      rvpi: point.rvpi,
      nav: point.nav / 1000000,
      distributions: point.cumulativeDistributions / 1000000,
      contributions: point.cumulativeContributions / 1000000,
      netCashFlow: (point.cumulativeDistributions - point.cumulativeContributions) / 1000000
    }));
  }, [forecastResult]);

  // Portfolio composition data
  const portfolioComposition = useMemo(() => {
    if (!forecastResult) return [];
    
    return stageStrategies.map((strategy, index) => ({
      stage: strategy.stage,
      value: strategy.allocationPct * forecastResult.totalInvested,
      percentage: strategy.allocationPct * 100,
      companies: strategy.numFirstChecks,
      fill: COLORS[index]
    }));
  }, [forecastResult, stageStrategies]);

  if (isCalculating) {
    return <LoadingSpinner message="Calculating performance metrics..." />;
  }

  if (!forecastResult) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">
            Please run a fund forecast first to see performance analytics.
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
          <h1 className="text-3xl font-bold text-gray-900">Performance Analytics</h1>
          <p className="mt-2 text-sm text-gray-600">
            Fund performance metrics and return analysis
          </p>
        </div>
        <ExcelExportButton />
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Net TVPI"
          value={`${performanceMetrics!.currentTVPI.toFixed(2)}x`}
          subValue="Total value to paid-in"
          icon={TrendingUp}
          color="blue"
          status={performanceMetrics!.currentTVPI > 2.5 ? 'positive' : 'neutral'}
        />
        <MetricCard
          label="Net IRR"
          value={formatPercent(performanceMetrics!.netIRR)}
          subValue="Annual return"
          icon={Activity}
          color="green"
          status={performanceMetrics!.netIRR > 0.20 ? 'positive' : 'neutral'}
        />
        <MetricCard
          label="Net DPI"
          value={`${performanceMetrics!.currentDPI.toFixed(2)}x`}
          subValue="Distributions to paid-in"
          icon={DollarSign}
          color="purple"
        />
        <MetricCard
          label="Net MOIC"
          value={`${performanceMetrics!.netMOIC.toFixed(2)}x`}
          subValue="Multiple on invested capital"
          icon={Target}
          color="indigo"
          status={performanceMetrics!.netMOIC > 3 ? 'positive' : 'neutral'}
        />
      </div>

      {/* J-Curve Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">J-Curve Analysis</h2>
        <JCurveChart 
          data={forecastResult.timeline}
          height={400}
          showMetrics={true}
          showNAV={true}
        />
      </div>

      {/* Multiple Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TVPI/DPI/RVPI Progression */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Multiple Progression</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="quarter" 
                tick={{ fontSize: 12 }}
                interval={Math.floor(timelineData.length / 8)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <RechartsTooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="tvpi" 
                stroke="#3B82F6" 
                name="TVPI"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="dpi" 
                stroke="#10B981" 
                name="DPI"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="rvpi" 
                stroke="#F59E0B" 
                name="RVPI"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Portfolio Composition */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Composition</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={portfolioComposition}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ stage, percentage }) => `${stage} (${percentage.toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {portfolioComposition.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Flow Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumulative Cash Flows</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="quarter" 
              tick={{ fontSize: 12 }}
              interval={Math.floor(timelineData.length / 8)}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value}M`}
            />
            <RechartsTooltip formatter={(value: number) => `$${value.toFixed(1)}M`} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="contributions" 
              stackId="1"
              stroke="#EF4444" 
              fill="#FEE2E2"
              name="Contributions"
            />
            <Area 
              type="monotone" 
              dataKey="distributions" 
              stackId="2"
              stroke="#10B981" 
              fill="#D1FAE5"
              name="Distributions"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gross vs Net Returns</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Gross MOIC</span>
              <span className="text-sm font-medium">{performanceMetrics!.grossMOIC.toFixed(2)}x</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Net MOIC</span>
              <span className="text-sm font-medium">{performanceMetrics!.netMOIC.toFixed(2)}x</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Impact of Fees</span>
                <span className="text-sm font-medium text-red-600">
                  -{((performanceMetrics!.grossMOIC - performanceMetrics!.netMOIC) / performanceMetrics!.grossMOIC * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">IRR Analysis</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Gross IRR</span>
              <span className="text-sm font-medium">{formatPercent(performanceMetrics!.grossIRR)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Net IRR</span>
              <span className="text-sm font-medium">{formatPercent(performanceMetrics!.netIRR)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">IRR Spread</span>
                <span className="text-sm font-medium">
                  {((performanceMetrics!.grossIRR - performanceMetrics!.netIRR) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Capital Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Deployment Rate</span>
              <span className="text-sm font-medium">{performanceMetrics!.deploymentRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Distributed</span>
              <span className="text-sm font-medium">{formatCurrency(performanceMetrics!.totalDistributions)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Unrealized Value</span>
              <span className="text-sm font-medium">{formatCurrency(performanceMetrics!.unrealizedValue)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
