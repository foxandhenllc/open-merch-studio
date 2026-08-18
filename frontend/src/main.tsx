import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App';
import './styles.css';

const observabilityEnabled =
  window.location.hostname === 'openmerchstudio.com' ||
  window.location.hostname === 'www.openmerchstudio.com' ||
  window.location.hostname.endsWith('.vercel.app');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    {observabilityEnabled && <Analytics />}
    {observabilityEnabled && <SpeedInsights />}
  </React.StrictMode>
);
