import React, { useState, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FundProvider } from './context/FundContext';
import AppLayout from './components/AppLayout';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load page components for better performance
const FundOverview = React.lazy(() => import('./pages/FundOverview'));
const PerformanceAnalytics = React.lazy(() => import('./pages/PerformanceAnalytics'));
const PortfolioManagement = React.lazy(() => import('./pages/PortfolioManagement'));
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
                  path="portfolio" 
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <PortfolioManagement />
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
