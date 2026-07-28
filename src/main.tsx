import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safe alert and confirm patches to avoid SecurityError crashes in sandboxed iframe contexts
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = function (message) {
    try {
      if (originalAlert) {
        originalAlert.call(window, message);
        return;
      }
    } catch (e) {
      console.warn("Native alert was blocked by sandbox, rendering virtual alert toast.", e);
    }
    
    // Fallback: render an elegant temporary bottom-right toast message
    const alertId = "virtual-sandbox-alert-" + Date.now();
    const alertDiv = document.createElement("div");
    alertDiv.id = alertId;
    alertDiv.className = "fixed bottom-5 right-5 z-[10000] max-w-sm bg-slate-900 border-2 border-[#C5A059] text-white p-4 rounded-xl shadow-2xl flex flex-col gap-2 transition-all duration-300 transform translate-y-2 opacity-0 font-sans";
    alertDiv.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <p class="text-xs font-bold leading-relaxed text-slate-200">${message}</p>
        <button onclick="document.getElementById('${alertId}').remove()" class="text-slate-400 hover:text-[#C5A059] font-extrabold text-sm px-1.5 py-0.5 rounded transition cursor-pointer">×</button>
      </div>
    `;
    document.body.appendChild(alertDiv);
    
    // animate entrance
    setTimeout(() => {
      alertDiv.className = "fixed bottom-5 right-5 z-[10000] max-w-sm bg-slate-900 border-2 border-[#C5A059] text-white p-4 rounded-xl shadow-2xl flex flex-col gap-2 transition-all duration-300 transform translate-y-0 opacity-100 font-sans";
    }, 50);
    
    // auto-remove after 7s
    setTimeout(() => {
      if (document.getElementById(alertId)) {
        alertDiv.className = "fixed bottom-5 right-5 z-[10000] max-w-sm bg-slate-900 border-2 border-[#C5A059] text-white p-4 rounded-xl shadow-2xl flex flex-col gap-2 transition-all duration-300 transform translate-y-2 opacity-0 font-sans";
        setTimeout(() => alertDiv.remove(), 300);
      }
    }, 7000);
  };

  const originalConfirm = window.confirm;
  window.confirm = function (message) {
    try {
      if (originalConfirm) {
        return originalConfirm.call(window, message);
      }
    } catch (e) {
      console.warn("Native confirm was blocked by sandbox, defaulting to true.", e);
    }
    return true;
  };
}

// Patch performance.measure to prevent DataCloneError on non-serializable detail objects (e.g. from React 19 profiling/scheduling)
if (typeof window !== 'undefined' && window.performance && typeof window.performance.measure === 'function') {
  const originalMeasure = window.performance.measure;
  window.performance.measure = function (name, startMarkOrOptions, endMark) {
    try {
      return originalMeasure.call(window.performance, name, startMarkOrOptions, endMark);
    } catch (e) {
      try {
        if (startMarkOrOptions && typeof startMarkOrOptions === 'object') {
          return originalMeasure.call(window.performance, name);
        }
      } catch (innerError) {}
      return {
        name,
        entryType: 'measure',
        startTime: 0,
        duration: 0,
        toJSON: () => ({})
      } as PerformanceMeasure;
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
