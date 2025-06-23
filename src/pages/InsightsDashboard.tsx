import React, { useMemo } from 'react';
import { useFundContext } from '../context/FundContext';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ExcelExportButton from '../components/ExcelExportButton';
import { 
  LineChart, Line, AreaChart, Area, RadarChart, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  Lightbulb, TrendingUp, AlertTriangle, CheckCircle, 
  Info, Target, DollarSign, Clock 
} from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface Insight {
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: string;
  action?: string;
}

export default function InsightsDashboard() {
  const fundContext = useFundContext();
  const { 
    fundSize,
    stageStrategies,
    forecastResult,
    isCalculating
  } = fundContext;

  // Generate insights based on forecast
  const insights = useMemo(() => {
    if (!forecastResult) return [];
    
    const insights: Insight[] = [];
    
    // Performance insights
    if (forecastResult.netMoic >= 3) {
      insights.push({
        type: 'success',
        title: 'Strong Performance Projected',
        description: `Fund is projected to return ${forecastResult.netMoic.toFixed(1)}x net MOIC, exceeding typical venture fund targets.`,
        metric: `${forecastResult.netMoic.toFixed(1)}x`
      });
    } else if (forecastResult.netMoic < 2) {
      insights.push({
        type: 'warning',
        title: 'Below-Target Returns',
        description: 'Projected returns are below typical LP expectations. Consider adjusting stage allocation or graduation rates.',
        metric: `${forecastResult.netMoic.toFixed(1)}x`,
        action: 'Review stage strategy'
      });
    }
    
    // DPI insights
    if (forecastResult.dpi < 1 && forecastResult.timeline.length > 32) {
      insights.push({
        type: 'info',
        title: 'Extended J-Curve',
        description: 'Fund takes longer than typical to return capital. Consider earlier exit strategies.',
        metric: `DPI: ${forecastResult.dpi.toFixed(2)}x`
      });
    }
    
    // Portfolio insights
    const successRate = forecastResult.intermediates.companiesExited / forecastResult.intermediates.companiesCreated;
    if (successRate < 0.2) {
      insights.push({
        type: 'warning',
        title: 'Low Exit Rate',
        description: 'Exit rate is below typical venture outcomes. Review graduation and exit probabilities.',
        metric: `${(successRate * 100).toFixed(0)}%`
      });
    }
    
    // Reserve insights
    const totalInitial = stageStrategies.reduce((sum, s) => sum + s.avgInvestmentSize * s.numFirstChecks, 0);
    const reserveRatio = (forecastResult.totalInvested - totalInitial) / forecastResult.totalInvested;
    
    if (reserveRatio > 0.6) {
      insights.push({
        type: 'info',
        title: 'High Reserve Allocation',
        description: 'Over 60% of capital allocated to follow-ons. Ensure sufficient dry powder for new investments.',
        metric: `${(reserveRatio * 100).toFixed(0)}%`
      });
    }
    
    return insights;
  }, [forecastResult, stageStrategies]);

  // Key performance indicators
  const kpis = useMemo(() => {
    if (!forecastResult) return null;
    
    const finalPoint = forecastResult.timeline[forecastResult.timeline.length - 1];
    const breakEvenQuarter = forecastResult.timeline.findIndex(p => p.dpi >= 1);
    const peakNAVQuarter = forecastResult.timeline.reduce((max, p, i) => 
      p.nav > forecastResult.timeline[max].nav ? i : max, 0
    );
    
    return {
      finalTVPI: finalPoint.tvpi,
      finalDPI: finalPoint.dpi,
      peakNAV: forecastResult.timeline[peakNAVQuarter].nav,
      breakEvenYear: breakEvenQuarter >= 0 ? Math.floor(breakEvenQuarter / 4) + 1 : null,
      successRate: forecastResult.intermediates.companiesExited / forecastResult.intermediates.companiesCreated,
      writeOffRate: forecastResult.intermediates.companiesWrittenOff / forecastResult.intermediates.companiesCreated,
      avgCheckSize: forecastResult.totalInvested / forecastResult.portfolio.length,
      portfolioYield: (forecastResult.totalExitValue - forecastResult.totalInvested) / forecastResult.totalInvested
    };
  }, [forecastResult]);

  // Scenario comparison data
  const scenarioComparison = useMemo(() => {
    if (!forecastResult) return [];
    
    // Simulate different scenarios
    const baseCase = {
      tvpi: forecastResult.tvpi,
      dpi: forecastResult.dpi,
      irr: forecastResult.netIrr
    };
    
    return [
      { scenario: 'Bear', tvpi: baseCase.tvpi * 0.7, dpi: baseCase.dpi * 0.7, irr: forecastResult.netIrr - 0.05 },
      { scenario: 'Base', tvpi: baseCase.tvpi, dpi: baseCase.dpi, irr: forecastResult.netIrr },
      { scenario: 'Bull', tvpi: baseCase.tvpi * 1.3, dpi: baseCase.dpi * 1.3, irr: forecastResult.netIrr + 0.05 }
    ];
  }, [forecastResult]);

  // Risk metrics for radar chart
  const riskMetrics = useMemo(() => {
    if (!kpis) return [];
    
    return [
      { metric: 'Returns', value: Math.min(kpis.finalTVPI / 3 * 100, 100) },
      { metric: 'Diversification', value: Math.min((1 - Math.max(...stageStrategies.map(s => s.allocationPct))) * 100, 100) },
      { metric: 'Liquidity', value: Math.min(kpis.finalDPI / 2 * 100, 100) },
      { metric: 'Success Rate', value: kpis.successRate * 100 },
      { metric: 'Yield', value: kpis.portfolioYield * 100 }
    ];
  }, [kpis, stageStrategies]);

  if (isCalculating) {
    return <LoadingSpinner message="Generating insights..." />;
  }

  if (!forecastResult || !kpis) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">
            Please run a fund forecast first to see insights.
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
          <h1 className="text-3xl font-bold text-gray-900">Insights Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            AI-powered insights and recommendations for your fund
          </p>
        </div>
        <ExcelExportButton />
      </div>

      {/* Key Insights */}
      <div className="space-y-4">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              insight.type === 'success' 
                ? 'bg-green-50 border-green-200' 
                : insight.type === 'warning'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {insight.type === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
                {insight.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                {insight.type === 'info' && <Info className="h-5 w-5 text-blue-600" />}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${
                  insight.type === 'success' 
                    ? 'text-green-800' 
                    : insight.type === 'warning'
                    ? 'text-yellow-800'
                    : 'text-blue-800'
                }`}>
                  {insight.title}
                  {insight.metric && (
                    <span className="ml-2 font-bold">{insight.metric}</span>
                  )}
                </h3>
                <p className={`mt-1 text-sm ${
                  insight.type === 'success' 
                    ? 'text-green-700' 
                    : insight.type === 'warning'
                    ? 'text-yellow-700'
                    : 'text-blue-700'
                }`}>
                  {insight.description}
                </p>
                {insight.action && (
                  <button className={`mt-2 text-sm font-medium ${
                    insight.type === 'success' 
                      ? 'text-green-800 hover:text-green-900' 
                      : insight.type === 'warning'
                      ? 'text-yellow-800 hover:text-yellow-900'
                      : 'text-blue-800 hover:text-blue-900'
                  }`}>
                    {insight.action} →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Portfolio Yield"
          value={formatPercent(kpis.portfolioYield)}
          subValue="Return on investment"
          icon={TrendingUp}
          color="green"
          status={kpis.portfolioYield > 0.5 ? 'positive' : 'neutral'}
        />
        <MetricCard
          label="Success Rate"
          value={formatPercent(kpis.successRate)}
          subValue="Successful exits"
          icon={Target}
          color="blue"
          status={kpis.successRate > 0.3 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Break-even"
          value={kpis.breakEvenYear ? `Year ${kpis.breakEvenYear}` : 'Not yet'}
          subValue="DPI ≥ 1.0x"
          icon={Clock}
          color="purple"
        />
        <MetricCard
          label="Peak NAV"
          value={formatCurrency(kpis.peakNAV)}
          subValue="Maximum value"
          icon={DollarSign}
          color="indigo"
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Scenario Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scenarioComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="scenario" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Line type="monotone" dataKey="tvpi" stroke="#3B82F6" name="TVPI" strokeWidth={2} />
              <Line type="monotone" dataKey="dpi" stroke="#10B981" name="DPI" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Profile */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Profile</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={riskMetrics}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar 
                name="Fund Profile" 
                dataKey="value" 
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Lightbulb className="h-5 w-5 mr-2 text-yellow-500" />
          Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900">Optimize Stage Allocation</h4>
            <p className="mt-1 text-sm text-gray-600">
              Consider increasing Seed allocation to 65% for better risk-adjusted returns based on current graduation rates.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900">Reserve Strategy</h4>
            <p className="mt-1 text-sm text-gray-600">
              Current reserve ratio supports 1.5x follow-on per winner. Consider increasing to 2x for top performers.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900">Exit Timing</h4>
            <p className="mt-1 text-sm text-gray-600">
              Focus on Series B/C exits for optimal IRR. Later stage exits may improve MOIC but reduce IRR.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900">Portfolio Construction</h4>
            <p className="mt-1 text-sm text-gray-600">
              Current portfolio of {forecastResult.portfolio.length} companies provides good diversification for fund size.
            </p>
          </div>
        </div>
      </div>

      {/* Fund Score Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-xl font-bold mb-4">Fund Score Card</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-blue-100 text-sm">Performance Score</p>
            <div className="flex items-baseline mt-1">
              <span className="text-3xl font-bold">
                {Math.round(Math.min(100, kpis.finalTVPI * 25))}
              </span>
              <span className="text-xl ml-1">/100</span>
            </div>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Risk Score</p>
            <div className="flex items-baseline mt-1">
              <span className="text-3xl font-bold">
                {Math.round(100 - kpis.writeOffRate * 100)}
              </span>
              <span className="text-xl ml-1">/100</span>
            </div>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Efficiency Score</p>
            <div className="flex items-baseline mt-1">
              <span className="text-3xl font-bold">
                {Math.round(Math.min(100, kpis.successRate * 300))}
              </span>
              <span className="text-xl ml-1">/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
