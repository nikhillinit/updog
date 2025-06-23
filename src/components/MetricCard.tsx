// src/components/MetricCard.tsx
import React, { memo, useMemo } from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart
} from 'recharts';

interface SparklineData {
  value: number;
  label?: string;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  change?: {
    value: number;
    label?: string;
  };
  status?: 'positive' | 'negative' | 'neutral';
  icon?: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'indigo' | 'teal' | 'red' | 'yellow';
  className?: string;
  onClick?: () => void;
  sparkline?: SparklineData[];
  sparklineType?: 'line' | 'area';
  loading?: boolean;
  tooltip?: string;
  trend?: 'up' | 'down' | 'flat';
  format?: 'currency' | 'percent' | 'number' | 'custom';
}

const formatValue = (value: string | number, format?: MetricCardProps['format']): string => {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: value < 1000 ? 2 : 0
      }).format(value);
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(value);
    case 'number':
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value);
    default:
      return String(value);
  }
};

const SparklineChart = memo(({ 
  data, 
  type = 'line', 
  color 
}: { 
  data: SparklineData[]; 
  type: 'line' | 'area';
  color: string;
}) => {
  const chartData = useMemo(() => 
    data.map((d, index) => ({ x: index, y: d.value })),
    [data]
  );
  
  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={40}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${color})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Line
          type="monotone"
          dataKey="y"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

SparklineChart.displayName = 'SparklineChart';

const MetricCard: React.FC<MetricCardProps> = memo(({
  label,
  value,
  subValue,
  change,
  status = 'neutral',
  icon: Icon,
  color = 'blue',
  className = '',
  onClick,
  sparkline,
  sparklineType = 'line',
  loading = false,
  tooltip,
  trend,
  format
}) => {
  const colorClasses = useMemo(() => ({
    text: {
      blue: 'text-blue-600',
      green: 'text-green-600',
      purple: 'text-purple-600',
      indigo: 'text-indigo-600',
      teal: 'text-teal-600',
      red: 'text-red-600',
      yellow: 'text-yellow-600'
    },
    icon: {
      blue: 'text-blue-400',
      green: 'text-green-400',
      purple: 'text-purple-400',
      indigo: 'text-indigo-400',
      teal: 'text-teal-400',
      red: 'text-red-400',
      yellow: 'text-yellow-400'
    },
    sparkline: {
      blue: '#3b82f6',
      green: '#10b981',
      purple: '#9333ea',
      indigo: '#6366f1',
      teal: '#14b8a6',
      red: '#ef4444',
      yellow: '#f59e0b'
    }
  }), []);
  
  const changeColorClasses = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50'
  };
  
  const trendIcons = {
    up: '↑',
    down: '↓',
    flat: '→'
  };
  
  const formattedValue = useMemo(() => 
    formatValue(value, format),
    [value, format]
  );
  
  if (loading) {
    return (
      <div className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse',
        className
      )}>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      </div>
    );
  }
  
  return (
    <div 
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 relative',
        onClick && 'cursor-pointer hover:shadow-md hover:border-gray-300',
        className
      )}
      onClick={onClick}
      title={tooltip}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-gray-600 truncate">{label}</p>
            {trend && (
              <span className={clsx(
                'text-xs font-medium',
                trend === 'up' && 'text-green-600',
                trend === 'down' && 'text-red-600',
                trend === 'flat' && 'text-gray-500'
              )}>
                {trendIcons[trend]}
              </span>
            )}
          </div>
          <p className={clsx('text-2xl font-bold mt-1', colorClasses.text[color])}>
            {formattedValue}
          </p>
          {subValue && (
            <p className="text-sm text-gray-500 mt-1 truncate">{subValue}</p>
          )}
          {change && (
            <div className={clsx(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2',
              changeColorClasses[status]
            )}>
              {change.value > 0 ? '+' : ''}{change.value}%
              {change.label && <span className="ml-1">{change.label}</span>}
            </div>
          )}
        </div>
        {Icon && !sparkline && (
          <Icon className={clsx('h-8 w-8 flex-shrink-0', colorClasses.icon[color])} />
        )}
      </div>
      
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4 -mx-2">
          <SparklineChart 
            data={sparkline} 
            type={sparklineType} 
            color={colorClasses.sparkline[color]}
          />
        </div>
      )}
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

export default MetricCard;

// Export a memoized version that only re-renders when props change
export const MemoizedMetricCard = memo(MetricCard, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.value === nextProps.value &&
    prevProps.label === nextProps.label &&
    prevProps.subValue === nextProps.subValue &&
    prevProps.loading === nextProps.loading &&
    JSON.stringify(prevProps.change) === JSON.stringify(nextProps.change) &&
    JSON.stringify(prevProps.sparkline) === JSON.stringify(nextProps.sparkline)
  );
});
