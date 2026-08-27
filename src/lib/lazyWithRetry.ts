import { lazy, ComponentType } from "react";

/**
 * Enhanced React.lazy wrapper that gracefully handles chunk loading errors
 * (e.g. after a production deployment when chunk hashes have changed).
 *
 * If dynamic import fails due to a missing/mismatched chunk or network failure,
 * it automatically reloads the page once to retrieve the latest HTML and bundle hashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem("fcrm-page-chunk-refreshed") || "false"
    );

    try {
      const component = await factory();
      // Reset refresh state on successful load
      window.sessionStorage.setItem("fcrm-page-chunk-refreshed", "false");
      return component;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isChunkError =
        errorMessage.includes("Failed to fetch dynamically imported module") ||
        errorMessage.includes("Importing a module script failed") ||
        errorMessage.includes("Strict MIME type checking") ||
        errorMessage.includes("error loading dynamically imported module") ||
        error?.name === "ChunkLoadError";

      if (isChunkError && !pageHasBeenForceRefreshed) {
        console.warn(
          "[lazyWithRetry] Stale chunk detected after deployment. Auto-refreshing application...",
          error
        );
        window.sessionStorage.setItem("fcrm-page-chunk-refreshed", "true");
        // Force refresh from server bypassing browser cache
        window.location.reload();
        // Return a pending promise so React Suspense keeps showing loader while page reloads
        return new Promise<{ default: T }>(() => {});
      }

      window.sessionStorage.setItem("fcrm-page-chunk-refreshed", "false");
      throw error;
    }
  });
}
