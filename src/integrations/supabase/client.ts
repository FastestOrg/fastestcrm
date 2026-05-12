import { createClient } from '@supabase/supabase-js';
import Cookies from 'js-cookie';
import type { Database } from './types';

// ─── Environment ─────────────────────────────────────────────────────────────
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// ─── Standard Auth configuration ──────────────────────────────────────────────

// ─── Cookie Storage for Cross-Subdomain Auth ──────────────────────────────────
// localStorage is bound to exactly the origin (e.g. app.fastestcrm.com is isolated
// from fastestcrm.com). To make auth survive subdomain hops, we use cookies set
// on the root domain (.fastestcrm.com). Custom domains will receive standard cookies.
// Browsers limit cookies to 4KB. Supabase sessions often exceed this, so we MUST chunk them.
const MAX_COOKIE_SIZE = 3000;

const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    let value = '';
    let i = 0;
    while (true) {
      const chunk = Cookies.get(`${key}_${i}`);
      if (chunk) {
        value += chunk;
        i++;
      } else {
        break;
      }
    }
    // Fallback for legacy un-chunked cookies
    if (!value) {
      value = Cookies.get(key) || '';
    }
    return value || null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname;
    const cookieOptions: Cookies.CookieAttributes = {
      expires: 365,
      path: '/',
      secure: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
      sameSite: 'None', // Critical for cross-subdomain auth in strict browsers like Safari/Brave
    };

    if (hostname.endsWith('fastestcrm.com')) {
      cookieOptions.domain = '.fastestcrm.com';
    }

    // Clean legacy un-chunked
    Cookies.remove(key, { path: '/' });
    if (cookieOptions.domain) Cookies.remove(key, { path: '/', domain: cookieOptions.domain });

    // Split value into chunks safely under 4KB
    const chunks = [];
    for (let c = 0; c < value.length; c += MAX_COOKIE_SIZE) {
      chunks.push(value.slice(c, c + MAX_COOKIE_SIZE));
    }

    // Set new chunks
    chunks.forEach((chunk, index) => {
      Cookies.set(`${key}_${index}`, chunk, cookieOptions);
    });

    // Remove any trailing chunks from a previously larger session
    let cleanupIndex = chunks.length;
    while (Cookies.get(`${key}_${cleanupIndex}`)) {
      Cookies.remove(`${key}_${cleanupIndex}`, { path: '/' });
      if (cookieOptions.domain) Cookies.remove(`${key}_${cleanupIndex}`, { path: '/', domain: cookieOptions.domain });
      cleanupIndex++;
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname;
    const domain = hostname.endsWith('fastestcrm.com') ? '.fastestcrm.com' : undefined;

    // Remove legacy un-chunked
    Cookies.remove(key, { path: '/' });
    if (domain) Cookies.remove(key, { path: '/', domain });

    // Remove chunks
    let i = 0;
    let hasChunk = true;
    while (hasChunk || i < 10) { // Check up to 10 chunks to be completely safe
      const exists = Cookies.get(`${key}_${i}`);
      if (!exists && i > 5) hasChunk = false;

      Cookies.remove(`${key}_${i}`, { path: '/' });
      if (domain) Cookies.remove(`${key}_${i}`, { path: '/', domain });

      i++;
    }
  },
};

// ─── Supabase client ──────────────────────────────────────────────────────────
const DIRECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROXY_URL = "https://api.fastestcrm.com";

const customFetch: typeof fetch = (url, options) => {
  const urlStr = typeof url === 'string' ? url : url.toString();
  // Proxy REST, Auth, and Storage through our custom domain
  // We don't proxy WebSockets because Vercel has limits/issues with them
  const proxiedUrl = urlStr.replace(DIRECT_URL, PROXY_URL);
  return fetch(proxiedUrl, options);
};

export const supabase = createClient<Database>(DIRECT_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: customFetch,
  },
  auth: {
    storage: cookieStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-auth-token',
  },
});

// A lightweight, unauthenticated client strictly used for fast public lookups (e.g. subdomains)
// It deliberately ignores the session so requests are not delayed by session hydration.
export const anonSupabase = createClient<Database>(DIRECT_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: customFetch,
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-anon-auth-token', // Unique key to avoid conflict with main client
  },
});
