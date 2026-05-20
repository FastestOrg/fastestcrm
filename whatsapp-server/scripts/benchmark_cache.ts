import { supabase } from '../src/supabase';
import { performance } from 'perf_hooks';

async function benchmark() {
    const companyId = 'test-company-123'; // Some ID

    console.log('--- Baseline (No Cache) ---');
    let start = performance.now();
    for (let i = 0; i < 50; i++) {
        const { data: profiles } = await supabase.from('profiles').select('id').eq('company_id', companyId);
        const userIds = profiles?.map(p => p.id) || [];
    }
    let end = performance.now();
    const noCacheTime = end - start;
    console.log(`No cache: ${noCacheTime.toFixed(2)}ms`);


    console.log('--- With Cache ---');
    const cache = new Map();
    start = performance.now();
    for (let i = 0; i < 50; i++) {
        let userIds = [];
        const now = Date.now();
        const cached = cache.get(companyId);
        if (cached && cached.expiresAt > now) {
            userIds = cached.userIds;
        } else {
            const { data: profiles } = await supabase.from('profiles').select('id').eq('company_id', companyId);
            userIds = profiles?.map(p => p.id) || [];
            cache.set(companyId, { userIds, expiresAt: now + 5 * 60 * 1000 });
        }
    }
    end = performance.now();
    const withCacheTime = end - start;
    console.log(`With cache: ${withCacheTime.toFixed(2)}ms`);

    console.log(`Improvement: ${((noCacheTime - withCacheTime) / noCacheTime * 100).toFixed(2)}%`);
}

benchmark().catch(console.error);
