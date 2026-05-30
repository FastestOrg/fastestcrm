import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import ErrorBoundary from "./components/common/ErrorBoundary.tsx";
import { logger } from "./lib/logger.ts";
import "./index.css";

// Global safety net for unhandled promise rejections — prevents silent failures
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Global unhandled promise rejection', {
    details: event.reason instanceof Error ? {
      name: event.reason.name,
      message: event.reason.message,
      stack: event.reason.stack
    } : String(event.reason)
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
