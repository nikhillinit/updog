// src/components/MetricCard.tsx

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

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
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  change,
  status = 'neutral',
  icon: Icon,
  color = 'blue',
  className = '',
  onClick
}) => {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    teal: 'text-teal-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600'
  };

  const iconColorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    indigo: 'text-indigo-400',
    teal: 'text-teal-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400'
  };

  const changeColorClasses = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50'
  };

  return (
    <div 
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:border-gray-300',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 truncate">{label}</p>
          <p className={clsx('text-2xl font-bold mt-1', colorClasses[color])}>
            {value}
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
        {Icon && (
          <Icon className={clsx('h-8 w-8 flex-shrink-0', iconColorClasses[color])} />
        )}
      </div>
    </div>
  );
};

export default MetricCard;
