// src/components/AppLayout.tsx

import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  BarChart3, 
  Settings, 
  Download, 
  Play,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useFundContext } from '../context/FundContext';
import { clsx } from 'clsx';

interface NavigationTab {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navigationTabs: NavigationTab[] = [
  {
    id: 'fund',
    label: 'Fund Overview',
    path: '/fund',
    icon: DollarSign,
    description: 'Fund parameters and key metrics'
  },
  {
    id: 'performance',
    label: 'Performance',
    path: '/performance',
    icon: TrendingUp,
    description: 'Returns analysis and cash flows'
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    path: '/portfolio',
    icon: Target,
    description: 'Company-level investments'
  },
  {
    id: 'scenarios',
    label: 'Scenarios',
    path: '/scenarios',
    icon: BarChart3,
    description: 'Compare different assumptions'
  }
];

const ScenarioSelector: React.FC = () => {
  const { 
    scenarios, 
    activeScenarioId, 
    switchScenario, 
    createScenario,
    duplicateScenario 
  } = useFundContext();
  
  const [isCreating, setIsCreating] = useState(false);
  
  const handleCreateScenario = () => {
    setIsCreating(true);
    const name = prompt('Enter scenario name:');
    if (name) {
      createScenario(name, 'User-created scenario');
    }
    setIsCreating(false);
  };
  
  const handleDuplicateScenario = () => {
    const name = prompt('Enter new scenario name:');
    if (name) {
      duplicateScenario(activeScenarioId, name);
    }
  };
  
  return (
    <div className="flex items-center space-x-3">
      <label className="text-sm font-medium text-gray-700">Scenario:</label>
      <select
        value={activeScenarioId}
        onChange={(e) => switchScenario(e.target.value)}
        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-press-500 focus:border-press-500"
      >
        {scenarios.map(scenario => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.name}
          </option>
        ))}
      </select>
      <div className="flex space-x-1">
        <button
          onClick={handleCreateScenario}
          disabled={isCreating}
          className="px-2 py-1 text-xs bg-press-600 text-white rounded hover:bg-press-700 transition-colors disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'New'}
        </button>
        <button
          onClick={handleDuplicateScenario}
          className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Copy
        </button>
      </div>
    </div>
  );
};

const StatusIndicator: React.FC = () => {
  const { 
    isCalculating, 
    calculationProgress, 
    isValid,
    validationResults,
    forecastResult,
    lastCalculation
  } = useFundContext();
  
  const errorCount = Array.from(validationResults.values()).filter(
    r => !r.isValid && r.severity === 'error'
  ).length;
  
  const warningCount = Array.from(validationResults.values()).filter(
    r => r.severity === 'warning'
  ).length;
  
  if (isCalculating) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Calculating...</span>
        {calculationProgress && calculationProgress > 0 && (
          <span className="text-xs">({calculationProgress}%)</span>
        )}
      </div>
    );
  }
  
  if (errorCount > 0) {
    return (
      <div className="flex items-center space-x-2 text-sm text-red-600">
        <AlertCircle className="h-4 w-4" />
        <span>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
      </div>
    );
  }
  
  if (forecastResult && lastCalculation) {
    return (
      <div className="flex items-center space-x-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span>Up to date</span>
        {warningCount > 0 && (
          <span className="text-yellow-600">({warningCount} warning{warningCount !== 1 ? 's' : ''})</span>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex items-center space-x-2 text-sm text-gray-500">
      <AlertCircle className="h-4 w-4" />
      <span>Needs calculation</span>
    </div>
  );
};

const AppLayout: React.FC = () => {
  const location = useLocation();
  const { 
    fundName, 
    calculateForecast, 
    isCalculating,
    exportScenario,
    activeScenarioId
  } = useFundContext();
  
  const currentPath = location.pathname;
  
  const handleExport = () => {
    const data = exportScenario(activeScenarioId);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fundName.replace(/\s+/g, '_')}_scenario.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-press-500 to-press-teal-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">U</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">UpdogLite</h1>
                  <p className="text-sm text-gray-500">Fund Modeling & Analytics</p>
                </div>
              </div>
              <div className="hidden md:block text-gray-300">|</div>
              <div className="hidden md:block">
                <h2 className="text-lg font-semibold text-gray-900">{fundName}</h2>
                <StatusIndicator />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              <ScenarioSelector />
              <div className="flex space-x-2">
                <button
                  onClick={calculateForecast}
                  disabled={isCalculating}
                  className={clsx(
                    'flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    isCalculating
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-press-600 text-white hover:bg-press-700'
                  )}
                >
                  {isCalculating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  <span>{isCalculating ? 'Calculating...' : 'Calculate'}</span>
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {navigationTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentPath === tab.path;
              
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={clsx(
                    'group flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-press-500 text-press-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Icon className={clsx(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-press-500' : 'text-gray-400 group-hover:text-gray-500'
                  )} />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <p className="text-sm text-gray-500">
                UpdogLite Alpha © 2025 — Professional Fund Modeling
              </p>
              <StatusIndicator />
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
