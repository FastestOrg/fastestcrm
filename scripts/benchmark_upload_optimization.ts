const BATCH_SIZE = 100;
const BROWSER_CONNECTION_LIMIT = 6;

async function simulateNetworkRequest(latencyMs: number) {
    return new Promise(resolve => setTimeout(resolve, latencyMs));
}

class ConnectionPool {
    private activeCount = 0;
    private queue: (() => void)[] = [];
    private maxConnections: number;

    constructor(maxConnections: number) {
        this.maxConnections = maxConnections;
    }

    async acquire() {
        if (this.activeCount < this.maxConnections) {
            this.activeCount++;
            return;
        }
        return new Promise<void>(resolve => {
            this.queue.push(resolve);
        });
    }

    release() {
        if (this.queue.length > 0) {
            const resolve = this.queue.shift()!;
            resolve();
        } else {
            this.activeCount--;
        }
    }
}

async function benchmark() {
    const leadsCount = 100;
    const leads = Array.from({ length: leadsCount }, (_, i) => ({ id: i }));
    const baseLatency = 50; // ms

    console.log(`Simulating insertion of ${leadsCount} leads (Batch Size: ${BATCH_SIZE})`);
    console.log(`Browser concurrent connection limit: ${BROWSER_CONNECTION_LIMIT}`);
    console.log(`Base network latency: ${baseLatency}ms\n`);

    // --- Benchmark 1: Current Approach (Promise.all with individual inserts) ---
    const pool = new ConnectionPool(BROWSER_CONNECTION_LIMIT);
    const startConcurrent = performance.now();

    await Promise.all(leads.map(async () => {
        await pool.acquire();
        await simulateNetworkRequest(baseLatency);
        pool.release();
    }));

    const endConcurrent = performance.now();
    const concurrentTime = endConcurrent - startConcurrent;
    console.log(`N+1 Query (Promise.all individual inserts): ${concurrentTime.toFixed(2)}ms`);

    // --- Benchmark 2: Optimized Approach (Bulk Insert) ---
    const startBulk = performance.now();

    // Simulate one request per batch, with slight overhead for larger payload
    const batchOverheadMs = (leadsCount / 100) * 10;
    await simulateNetworkRequest(baseLatency + batchOverheadMs);

    const endBulk = performance.now();
    const bulkTime = endBulk - startBulk;
    console.log(`Bulk Insert (.insert(batch)): ${bulkTime.toFixed(2)}ms`);

    // --- Results ---
    const improvement = ((concurrentTime - bulkTime) / concurrentTime) * 100;
    console.log(`\nPerformance Improvement: ${improvement.toFixed(2)}%`);
}

benchmark();
