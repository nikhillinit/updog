import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FundProvider } from './context/FundContext';
import AppLayout from './components/AppLayout';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load page components
const FundOverview = React.lazy(() => import('./pages/FundOverview'));
const PerformanceAnalytics = React.lazy(() => import('./pages/PerformanceAnalytics'));
const ExitsAnalysis = React.lazy(() => import('./pages/ExitsAnalysis'));
const InsightsDashboard = React.lazy(() => import('./pages/InsightsDashboard'));
const PortfolioOverview = React.lazy(() => import('./pages/PortfolioOverview'));
const ScenarioComparison = React.lazy(() => import('./pages/ScenarioComparison'));

function App() {
  return (
    <ErrorBoundary>
      <FundProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/fund" replace />} />
                <Route 
                  path="fund" 
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <FundOverview />
                    </Suspense>
                  } 
                />
                <Route 
                  path="performance" 
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <PerformanceAnalytics />
                    </Suspense>
                  } 
                />
                <Route 
                  path="exits" 
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <ExitsAnalysis />
                    </Suspense>
                  } 
                />
                <Route 
                  path="insights" 
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <InsightsDashboard />
                    </Suspense>
                  } 
                />
                <Route 
                  path="portfolio" 
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <PortfolioOverview />
                    </Suspense>
                  } 
                />
                <Route 
                  path="scenarios" 
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <ScenarioComparison />
                    </Suspense>
                  } 
                />
              </Route>
            </Routes>
          </div>
        </Router>
      </FundProvider>
    </ErrorBoundary>
  );
}

export default App;
