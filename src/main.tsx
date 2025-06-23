import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Enable React strict mode for development
const isDevelopment = import.meta.env.DEV;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const AppComponent = isDevelopment ? (
  <React.StrictMode>
    <App />
  </React.StrictMode>
) : (
  <App />
);

root.render(AppComponent);

// Hot module replacement for development
if (isDevelopment && import.meta.hot) {
  import.meta.hot.accept();
}
