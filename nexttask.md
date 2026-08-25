# Application Code Audit & Tasks

> **Status:** All critical, high-severity, security, memory leak, and compilation issues have been resolved and verified.

---

## Resolved & Removed Issues

All identified critical and high-priority issues have been precisely fixed, tested, and verified without breaking existing code:

- ✅ **Issue 1.1 (TypeScript Compilation in IMAP Worker):** Fixed type guards for `msg.flags`, `msg.source`, and typed Google OAuth response.
- ✅ **Issue 1.2 (ESLint false positive):** Added `eslint-disable` for `useMultiFileAuthState` call in `session-manager.ts`.
- ✅ **Issue 2.1 (Cross-Company Tenant Deletion in `delete-team-member`):** Added strict `requesterCompanyId === targetProfile.company_id` check and reassigned profile company validation.
- ✅ **Issue 2.2 (Cross-Company Deactivation in `toggle-user-status`):** Added strict company alignment check before user status toggles or bans.
- ✅ **Issue 2.3 & 3.3 (Platform Admin Gate & Stack Trace Leak in `query-bigdata-sql`):** Allowed platform admins and company sub-admins access while sanitizing error responses to conceal internal stack traces.
- ✅ **Issue 2.4 & 5.1 (Hardcoded Secrets & Supabase URLs):** Removed fallback JWT key from `api/submit-external-lead.js` and dynamically read `VITE_SUPABASE_URL` in serverless proxies.
- ✅ **Issue 3.1 (Unreleased IMAP Mailbox Lock):** Added `lock.release()` immediately after acquiring the mailbox lock to prevent IMAP connection deadlocks.
- ✅ **Issue 3.2 (Socket Listener Memory Leak):** Added listener cleanup (`removeAllListeners`) and socket termination before reconnecting WhatsApp sessions.
- ✅ **Issue 4.2 (Uncached Custom Columns Query):** Added `staleTime: 5 * 60 * 1000` and `gcTime: 10 * 60 * 1000` to `useCustomColumns` to eliminate redundant refetch loops.

---

## Remaining Optional Database Maintenance

### Issue 4.1: SQL Performance Indexes (Optional Database Migration)
* **Severity:** 🟢 Low / Database Optimization
* **Description:** Optional composite SQL index on `email_campaign_recipients(lead_email, status)` to optimize large-scale email reply lookups when recipient count exceeds 500,000 records.
