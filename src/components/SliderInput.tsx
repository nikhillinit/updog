// src/components/SliderInput.tsx
import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { clsx } from 'clsx';
import { Info, AlertCircle } from 'lucide-react';

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  format?: 'percent' | 'currency' | 'number';
  decimals?: number;
  showInput?: boolean;
  showTicks?: boolean;
  tickCount?: number;
  color?: 'blue' | 'green' | 'purple' | 'indigo';
  error?: string;
  warning?: string;
  tooltip?: string;
  disabled?: boolean;
  debounceMs?: number;
  markers?: Array<{ value: number; label: string }>;
  className?: string;
}

const formatDisplayValue = (
  value: number,
  format?: SliderInputProps['format'],
  decimals: number = 1,
  unit?: string
): string => {
  switch (format) {
    case 'percent':
      return `${(value * 100).toFixed(decimals)}%`;
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(value);
    case 'number':
      return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
    default:
      return `${value}${unit ? ` ${unit}` : ''}`;
  }
};

const SliderInput: React.FC<SliderInputProps> = memo(({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit,
  format,
  decimals = 1,
  showInput = true,
  showTicks = false,
  tickCount = 5,
  color = 'blue',
  error,
  warning,
  tooltip,
  disabled = false,
  debounceMs = 0,
  markers,
  className = ''
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [inputValue, setInputValue] = useState(formatDisplayValue(value, format, decimals, unit));
  const [isDragging, setIsDragging] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  
  // Update local value when prop changes
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
      setInputValue(formatDisplayValue(value, format, decimals, unit));
    }
  }, [value, format, decimals, unit, isDragging]);
  
  // Handle slider change with optional debouncing
  const handleSliderChange = useCallback((newValue: number) => {
    setLocalValue(newValue);
    
    if (debounceMs > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    } else {
      onChange(newValue);
    }
  }, [onChange, debounceMs]);
  
  // Handle direct input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputStr = e.target.value;
    setInputValue(inputStr);
    
    // Parse the input value
    let numValue: number;
    if (format === 'percent') {
      numValue = parseFloat(inputStr.replace('%', '')) / 100;
    } else if (format === 'currency') {
      numValue = parseFloat(inputStr.replace(/[$,]/g, ''));
    } else {
      numValue = parseFloat(inputStr);
    }
    
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      handleSliderChange(numValue);
    }
  }, [format, min, max, handleSliderChange]);
  
  // Handle input blur to ensure valid value
  const handleInputBlur = useCallback(() => {
    const validValue = Math.max(min, Math.min(max, localValue));
    setLocalValue(validValue);
    setInputValue(formatDisplayValue(validValue, format, decimals, unit));
    onChange(validValue);
  }, [localValue, min, max, format, decimals, unit, onChange]);
  
  // Calculate percentage for slider position
  const percentage = ((localValue - min) / (max - min)) * 100;
  
  // Generate tick marks
  const ticks = showTicks ? Array.from({ length: tickCount }, (_, i) => {
    const tickValue = min + (i / (tickCount - 1)) * (max - min);
    return {
      value: tickValue,
      position: ((tickValue - min) / (max - min)) * 100
    };
  }) : [];
  
  const colorClasses = {
    track: {
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      purple: 'bg-purple-600',
      indigo: 'bg-indigo-600'
    },
    thumb: {
      blue: 'border-blue-600',
      green: 'border-green-600',
      purple: 'border-purple-600',
      indigo: 'border-indigo-600'
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  return (
    <div className={clsx('space-y-2', className)}>
      {/* Label and value display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">
            {label}
          </label>
          {tooltip && (
            <div className="relative group">
              <Info className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-xs whitespace-normal">
                  {tooltip}
                  <div className="absolute top-full left-4 -mt-1 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        {!showInput && (
          <span className="text-sm font-medium text-gray-900">
            {formatDisplayValue(localValue, format, decimals, unit)}
          </span>
        )}
      </div>
      
      {/* Slider container */}
      <div className="relative">
        {/* Track background */}
        <div className="relative h-2 bg-gray-200 rounded-full">
          {/* Filled track */}
          <div
            className={clsx(
              'absolute h-2 rounded-full transition-all duration-150',
              colorClasses.track[color],
              isDragging && 'transition-none'
            )}
            style={{ width: `${percentage}%` }}
          />
          
          {/* Tick marks */}
          {ticks.map((tick, index) => (
            <div
              key={index}
              className="absolute w-0.5 h-3 bg-gray-300 -top-0.5"
              style={{ left: `${tick.position}%`, transform: 'translateX(-50%)' }}
            />
          ))}
          
          {/* Custom markers */}
          {markers?.map((marker, index) => {
            const markerPosition = ((marker.value - min) / (max - min)) * 100;
            return (
              <div
                key={index}
                className="absolute flex flex-col items-center"
                style={{ left: `${markerPosition}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-1 h-4 bg-gray-400 -top-1 absolute" />
                <span className="text-xs text-gray-500 mt-5 whitespace-nowrap">
                  {marker.label}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Slider input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          disabled={disabled}
          className={clsx(
            'absolute inset-0 w-full h-2 opacity-0 cursor-pointer',
            disabled && 'cursor-not-allowed'
          )}
        />
        
        {/* Custom thumb */}
        <div
          className={clsx(
            'absolute w-5 h-5 bg-white border-2 rounded-full shadow-md transition-all duration-150',
            'pointer-events-none -translate-x-1/2 -top-1.5',
            colorClasses.thumb[color],
            isDragging && 'scale-110 shadow-lg transition-none',
            disabled && 'opacity-50'
          )}
          style={{ left: `${percentage}%` }}
        />
      </div>
      
      {/* Input field */}
      {showInput && (
        <div className="mt-3">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={disabled}
            className={clsx(
              'block w-full px-3 py-2 border rounded-md shadow-sm text-sm',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : warning
                ? 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
              disabled && 'bg-gray-50 cursor-not-allowed'
            )}
          />
        </div>
      )}
      
      {/* Error/warning messages */}
      {error && (
        <div className="flex items-center space-x-1 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      {warning && !error && (
        <div className="flex items-center space-x-1 text-sm text-yellow-600">
          <AlertCircle className="h-4 w-4" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
});

SliderInput.displayName = 'SliderInput';

export default SliderInput;

// Export a version with common presets
export const PercentageSlider = memo((props: Omit<SliderInputProps, 'format' | 'min' | 'max' | 'step'>) => (
  <SliderInput
    {...props}
    format="percent"
    min={0}
    max={1}
    step={0.01}
    decimals={1}
  />
));

export const CurrencySlider = memo((props: Omit<SliderInputProps, 'format'>) => (
  <SliderInput
    {...props}
    format="currency"
    decimals={0}
  />
));

export const IntegerSlider = memo((props: Omit<SliderInputProps, 'format' | 'decimals'>) => (
  <SliderInput
    {...props}
    format="number"
    decimals={0}
    step={1}
  />
));
