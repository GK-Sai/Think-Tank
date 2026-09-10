import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './store/AuthContext';
import { ToastProvider } from './store/ToastContext';

import './styles/global.css';
import './styles/app.css';
import './styles/login.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Opting in to the v7 behaviour now: it is what this app already
        assumes, and it keeps the console clear so a real warning is
        visible when one appears. */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
