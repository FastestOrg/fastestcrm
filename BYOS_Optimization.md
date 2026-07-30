# BYOS (Bring Your Own Supabase) — Optimization Plan

This document outlines architectural optimizations for FastestCRM when running on a customer's dedicated BYOS (Bring Your Own Supabase) database.

---

## 🔍 Core Question: Will Bypassing `company_id` Filter Optimize Queries?

### **Short Answer:**
**Yes! It provides measurable query planning and index efficiency gains.**

### **Technical Breakdown:**

1. **Multi-Tenant (Default Server) vs. Single-Tenant (BYOS)**:
   - **Default Server**: Multi-tenant database. Filtering by `.eq('company_id', companyId)` is **mandatory** for security and row isolation.
   - **BYOS Server**: Single-tenant dedicated database. 100% of all rows belong to one organization.

2. **Performance Impact of Bypassing `company_id` on BYOS**:
   - **Cleaner Index Lookups**: On BYOS, composite indexes like `(company_id, created_at DESC)` can be replaced with leaner single-column indexes `(created_at DESC)` or `(status)`.
   - **Faster Query Planner Execution**: PostgreSQL query planner doesn't need to evaluate redundant `company_id = 'xxx'` WHERE clause predicates across millions of rows.
   - **Shorter PostgREST Query URLs**: Omitting `&company_id=eq.xxxx` reduces URL string length, HTTP payload size, and PostgREST parsing time.

> [!NOTE]
> **Important Rule**: `company_id` must still be populated during `INSERT` / `UPDATE` operations to preserve data integrity and ensure 100% seamless migration compatibility if a customer ever switches between BYOS and Default platform.

---

## ⚡ Complete BYOS Optimization Strategy

### 1. **Conditional `company_id` Filter Injection**
In hooks utilizing `useOrgClient()`:
- **When `isBYOS` is `false`**: Append `.eq('company_id', companyId)` for strict multi-tenant security.
- **When `isBYOS` is `true`**: Skip `.eq('company_id', companyId)` on SELECT queries to let PostgreSQL hit direct column indexes (`created_at`, `status`, `sales_owner_id`).

```typescript
// Example Implementation Pattern in Custom Hooks
let query = orgClient.from('leads').select('*');

if (!isBYOS) {
  query = query.eq('company_id', companyId);
}

// Proceed with standard filters
if (status) query = query.eq('status', status);
```

---

### 2. **BYOS-Optimized Database Indexes (Single-Tenant Indexing)**
On multi-tenant systems, all indexes require `company_id` as the leading column. On BYOS, dedicated single-column indexes perform faster and consume less RAM:

```sql
-- Standard Multi-Tenant Index (Default Server)
CREATE INDEX idx_leads_company_status ON public.leads(company_id, status);

-- BYOS Optimized Index (Customer DB)
CREATE INDEX idx_byos_leads_status ON public.leads(status);
CREATE INDEX idx_byos_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_byos_leads_sales_owner ON public.leads(sales_owner_id);
```

---

### 3. **Simplified RLS Policies (`USING (true)`)**
On Default Supabase, RLS policies execute subqueries checking user roles and company IDs (`company_id IN (SELECT ...)`). On dedicated BYOS databases:
- Security is guaranteed at the connection/API key level.
- RLS policies use direct `USING (true) WITH CHECK (true)`, eliminating subquery evaluation overhead for every SQL query.

---

### 4. **Supabase Client Singleton Caching**
Ensure `createOrgSupabaseClient(url, key)` caches client instances in a global Map by `supabase_url`. This prevents re-instantiating JS client objects, auth sessions, and WebSocket channels on component re-renders.

```typescript
// Singleton Map in client.ts
const byosClientCache = new Map<string, SupabaseClient>();

export function createOrgSupabaseClient(url: string, key: string) {
  const cacheKey = `${url}_${key}`;
  if (!byosClientCache.has(cacheKey)) {
    byosClientCache.set(cacheKey, createClient(url, key, { ... }));
  }
  return byosClientCache.get(cacheKey)!;
}
```

---

### 5. **Session-Level Missing Table Caching**
Avoid 404 HTTP roundtrips when querying legacy/fallback tables (e.g. `lead_statuses` vs `company_lead_statuses` or `calendar_bookings` vs `calendar_events`):
- Maintain an in-memory `Set<string>` of non-existent endpoints for the active host URL.
- Skip querying missing legacy tables once a 404 response has been recorded.

---

## 📋 Implementation Roadmap

| Optimization | Priority | Complexity | Expected Impact |
| :--- | :--- | :--- | :--- |
| **Conditional `company_id` filter bypassing on SELECTs** | High | Low | Faster queries, smaller HTTP payloads |
| **Single-column BYOS indexes** | Medium | Medium | Reduced RAM usage, faster sorting |
| **Client Instance Singleton Caching** | High | Low | Reduced JS heap allocations & re-renders |
| **Missing Table 404 Caching** | Completed | Low | Zero duplicate 404 console errors |
