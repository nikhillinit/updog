// src/components/JCurveChart.tsx
import React, { useMemo, memo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  TooltipProps
} from 'recharts';
import { clsx } from 'clsx';
import { CashFlowPoint } from '../types/index';

interface JCurveChartProps {
  data: CashFlowPoint[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  metrics?: Array<'nav' | 'dpi' | 'rvpi' | 'tvpi' | 'irr' | 'moic'>;
  variant?: 'line' | 'area';
  className?: string;
  title?: string;
  loading?: boolean;
}

interface ChartDataPoint {
  quarter: number;
  year: number;
  yearQuarter: string;
  nav?: number;
  dpi?: number;
  rvpi?: number;
  tvpi?: number;
  netIrr?: number;
  grossIrr?: number;
  moic?: number;
  netMoic?: number;
  cumulativeContributions?: number;
  cumulativeDistributions?: number;
  netCashFlow?: number;
  netCashFlowPercent?: number;
}

const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

const formatMultiple = (value: number): string => {
  return `${value.toFixed(2)}x`;
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length > 0) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between space-x-4 text-sm">
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.dataKey === 'netIrr' || entry.dataKey === 'grossIrr'
                ? formatPercent(entry.value as number)
                : entry.dataKey === 'nav' || entry.dataKey === 'netCashFlow'
                ? formatCurrency(entry.value as number)
                : entry.dataKey === 'moic' || entry.dataKey === 'netMoic' || 
                  entry.dataKey === 'tvpi' || entry.dataKey === 'dpi' || entry.dataKey === 'rvpi'
                ? formatMultiple(entry.value as number)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const JCurveChart: React.FC<JCurveChartProps> = memo(({
  data,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  metrics = ['tvpi', 'dpi', 'rvpi'],
  variant = 'line',
  className = '',
  title,
  loading = false
}) => {
  // Process data for charting
  const chartData = useMemo(() => {
    return data.map((point): ChartDataPoint => {
      const netCashFlow = point.cumulativeDistributions - point.cumulativeContributions;
      const netCashFlowPercent = point.cumulativeContributions > 0 
        ? netCashFlow / point.cumulativeContributions 
        : 0;
      
      return {
        quarter: point.quarter,
        year: point.year,
        yearQuarter: point.yearQuarter,
        nav: point.nav,
        dpi: point.dpi,
        rvpi: point.rvpi,
        tvpi: point.tvpi,
        netIrr: point.netIrr,
        grossIrr: point.grossIrr,
        moic: point.moic,
        netMoic: point.netMoic,
        cumulativeContributions: point.cumulativeContributions,
        cumulativeDistributions: point.cumulativeDistributions,
        netCashFlow,
        netCashFlowPercent
      };
    });
  }, [data]);
  
  // Define metric configurations
  const metricConfigs = {
    nav: { key: 'nav', name: 'NAV', color: '#3b82f6', formatter: formatCurrency },
    dpi: { key: 'dpi', name: 'DPI', color: '#10b981', formatter: formatMultiple },
    rvpi: { key: 'rvpi', name: 'RVPI', color: '#f59e0b', formatter: formatMultiple },
    tvpi: { key: 'tvpi', name: 'TVPI', color: '#8b5cf6', formatter: formatMultiple },
    irr: { key: 'netIrr', name: 'Net IRR', color: '#ef4444', formatter: formatPercent },
    moic: { key: 'netMoic', name: 'Net MOIC', color: '#14b8a6', formatter: formatMultiple }
  };
  
  const selectedMetrics = metrics.map(m => metricConfigs[m]).filter(Boolean);
  
  if (loading) {
    return (
      <div className={clsx('bg-white rounded-lg p-6 animate-pulse', className)}>
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className={`bg-gray-200 rounded`} style={{ height }}></div>
      </div>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <div className={clsx('bg-white rounded-lg p-6', className)}>
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }
  
  const Chart = variant === 'area' ? AreaChart : LineChart;
  const DataComponent = variant === 'area' ? Area : Line;
  
  return (
    <div className={clsx('bg-white rounded-lg p-6', className)}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          )}
          
          <XAxis
            dataKey="yearQuarter"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              // Auto-format based on the primary metric
              const primaryMetric = selectedMetrics[0];
              if (primaryMetric) {
                return primaryMetric.formatter(value);
              }
              return value.toFixed(1);
            }}
          />
          
          {showTooltip && (
            <Tooltip content={<CustomTooltip />} />
          )}
          
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType={variant === 'area' ? 'rect' : 'line'}
            />
          )}
          
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="5 5" />
          
          {variant === 'area' && (
            <defs>
              {selectedMetrics.map((metric) => (
                <linearGradient key={metric.key} id={`gradient-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
          )}
          
          {selectedMetrics.map((metric) => (
            <DataComponent
              key={metric.key}
              type="monotone"
              dataKey={metric.key}
              name={metric.name}
              stroke={metric.color}
              strokeWidth={2}
              fill={variant === 'area' ? `url(#gradient-${metric.key})` : undefined}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
});

JCurveChart.displayName = 'JCurveChart';

export default JCurveChart;

// Specialized J-Curve for net cash flows
export const NetCashFlowJCurve = memo((props: Omit<JCurveChartProps, 'metrics'>) => {
  const enhancedData = useMemo(() => {
    if (!props.data) return [];
    
    return props.data.map(point => ({
      ...point,
      netCashFlowPercent: point.cumulativeContributions > 0
        ? (point.cumulativeDistributions - point.cumulativeContributions) / point.cumulativeContributions
        : 0
    }));
  }, [props.data]);
  
  return (
    <div className={props.className}>
      {props.title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{props.title}</h3>
      )}
      
      <ResponsiveContainer width="100%" height={props.height || 300}>
        <AreaChart data={enhancedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="netCashFlowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="50%" stopColor="#ef4444" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          
          <XAxis
            dataKey="yearQuarter"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatPercent(value)}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <ReferenceLine y={0} stroke="#6b7280" strokeWidth={2} />
          
          <Area
            type="monotone"
            dataKey="netCashFlowPercent"
            name="Net Cash Flow %"
            stroke="#6b7280"
            strokeWidth={2}
            fill="url(#netCashFlowGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
