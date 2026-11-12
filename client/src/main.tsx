import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { safeGetSession, safeSetSession } from './utils/storage';
import './index.css';

// Recover once from stale chunk preload errors after a new frontend deployment
window.addEventListener('vite:preloadError', () => {
  if (!safeGetSession('kk_chunk_reload_attempted')) {
    safeSetSession('kk_chunk_reload_attempted', '1');
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
