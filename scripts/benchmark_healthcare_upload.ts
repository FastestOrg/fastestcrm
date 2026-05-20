import { performance } from 'perf_hooks';

const MOCK_DELAY_MS = 10;
const BATCH_SIZE = 100;
const leads = Array.from({ length: 100 }, (_, i) => ({ id: i, data: `lead_${i}` }));

async function mockInsert(data: any) {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY_MS));
  return { error: null };
}

async function runBenchmark() {
  console.log("Benchmarking individual inserts vs bulk insert...");

  // Individual
  const startIndividual = performance.now();
  await Promise.all(leads.map(async (lead) => {
    await mockInsert(lead);
  }));
  const endIndividual = performance.now();
  console.log(`Individual inserts (Promise.all): ${(endIndividual - startIndividual).toFixed(2)} ms`);

  // Bulk
  const startBulk = performance.now();
  await mockInsert(leads);
  const endBulk = performance.now();
  console.log(`Bulk insert: ${(endBulk - startBulk).toFixed(2)} ms`);

  console.log(`Improvement: ${(((endIndividual - startIndividual) - (endBulk - startBulk)) / (endIndividual - startIndividual) * 100).toFixed(2)}%`);
}

runBenchmark();
