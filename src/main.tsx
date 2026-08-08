import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { attendanceSyncQueue } from './lib/attendanceSyncQueue';

// Register Service Worker for offline queuing & caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('EduPulse Service Worker registered:', reg.scope);
    }).catch((err) => {
      console.warn('Service Worker registration failed:', err);
    });
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PROCESS_SYNC_QUEUE') {
      attendanceSyncQueue.processSyncQueue();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

