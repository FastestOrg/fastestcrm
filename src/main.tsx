import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import ErrorBoundary from "./components/common/ErrorBoundary.tsx";
import { logger } from "./lib/logger.ts";
import "./index.css";

// Global safety net for Vite dynamic preload/chunk loading errors (triggered when a new version is deployed)
window.addEventListener('vite:preloadError', (event) => {
  const reloadKey = 'fcrm-vite-preload-reloaded';
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, 'true');
    console.warn('[Vite] Preload error detected. Auto-refreshing to latest build...', event);
    window.location.reload();
  } else {
    sessionStorage.removeItem(reloadKey);
    logger.error('Vite preload dynamic import failed even after reload', {
      details: String(event)
    });
  }
});

// Global safety net for unhandled promise rejections — prevents silent failures
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);

  // If this rejection is a chunk import failure and wasn't caught by vite:preloadError
  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Strict MIME type checking') ||
    message.includes('Importing a module script failed')
  ) {
    const reloadKey = 'fcrm-vite-preload-reloaded';
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, 'true');
      console.warn('[ChunkImport] Dynamic import error detected. Auto-refreshing application...');
      window.location.reload();
      return;
    }
  }

  logger.error('Global unhandled promise rejection', {
    details: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    } : String(reason)
  });
});

// Global safety net for uncaught synchronous errors
window.addEventListener('error', (event) => {
  logger.error('Global uncaught exception', {
    details: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      errorStack: event.error?.stack
    }
  });
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </ErrorBoundary>
);
