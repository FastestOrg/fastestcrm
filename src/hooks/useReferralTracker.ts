import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { supabase } from '@/integrations/supabase/client';

const REFERRAL_KEY = 'fastestcrm_partner_ref';
const COOKIE_DAYS = 90;

export function setReferralCode(code: string) {
  if (!code) return;
  const cleanCode = code.trim().toUpperCase();
  try {
    localStorage.setItem(REFERRAL_KEY, cleanCode);
    Cookies.set(REFERRAL_KEY, cleanCode, {
      expires: COOKIE_DAYS,
      path: '/',
      sameSite: 'Lax',
    });

    // Track click count on backend (deduped per browser session)
    const sessionKey = `fastestcrm_clicked_${cleanCode}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      supabase.rpc('track_partner_click', { p_code: cleanCode }).then(({ error }) => {
        if (error) console.error('Error logging partner click:', error);
      });
    }
  } catch (err) {
    console.error('Failed to persist referral code:', err);
  }
}

export function getReferralCode(): string | null {
  try {
    const fromStorage = localStorage.getItem(REFERRAL_KEY);
    if (fromStorage) return fromStorage.trim().toUpperCase();
    const fromCookie = Cookies.get(REFERRAL_KEY);
    if (fromCookie) return fromCookie.trim().toUpperCase();
  } catch (err) {
    console.error('Failed to get referral code:', err);
  }
  return null;
}

export function clearReferralCode() {
  try {
    localStorage.removeItem(REFERRAL_KEY);
    Cookies.remove(REFERRAL_KEY, { path: '/' });
  } catch (err) {
    console.error('Failed to clear referral code:', err);
  }
}

/**
 * Hook to automatically capture and sync ?ref= parameter from URL
 */
export function useReferralTracker() {
  const [referralCode, setCode] = useState<string | null>(getReferralCode());

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refFromUrl = urlParams.get('ref') || urlParams.get('partner') || urlParams.get('r');

      if (refFromUrl) {
        const clean = refFromUrl.trim().toUpperCase();
        setReferralCode(clean);
        setCode(clean);
      } else {
        setCode(getReferralCode());
      }
    } catch (e) {
      console.error('Error tracking referral:', e);
    }
  }, []);

  return referralCode;
}
