async function simulateNetworkDelay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Simulating browser connection pooling by limiting concurrent connections to 6 (HTTP/1.1 limit per domain)
async function simulatePromiseAllWithConnectionLimit(tasks: (() => Promise<any>)[], limit: number) {
  const executing = new Set();
  const results = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);

    const clean = p.then(() => executing.delete(p));

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

async function runBenchmark() {
  const BATCH_SIZE = 100;
  const batch = Array(BATCH_SIZE).fill({ name: 'Test' });
  const NETWORK_LATENCY = 100; // ms per request
  const CONNECTIONS = 6; // Typical browser limit

  console.log(`Running benchmark for BATCH_SIZE=${BATCH_SIZE} with ${NETWORK_LATENCY}ms latency and ${CONNECTIONS} connections max...`);

  // Baseline: individual inserts (what Promise.all actually does in a browser env)
  const startBaseline = performance.now();
  await simulatePromiseAllWithConnectionLimit(batch.map(() => async () => {
    await simulateNetworkDelay(NETWORK_LATENCY);
    return { error: null };
  }), CONNECTIONS);
  const endBaseline = performance.now();
  const baselineTime = endBaseline - startBaseline;
  console.log(`Baseline (individual inserts): ${baselineTime.toFixed(2)}ms`);

  // Optimized: bulk insert
  const startOptimized = performance.now();
  // One request for the entire batch
  await simulateNetworkDelay(NETWORK_LATENCY);
  const endOptimized = performance.now();
  const optimizedTime = endOptimized - startOptimized;
  console.log(`Optimized (bulk insert): ${optimizedTime.toFixed(2)}ms`);

  console.log(`Performance improvement: ${((baselineTime - optimizedTime) / baselineTime * 100).toFixed(2)}%`);
}

runBenchmark();
