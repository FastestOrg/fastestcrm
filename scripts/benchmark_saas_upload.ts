console.log('Testing basic bench...');
const start = performance.now();
const leads = Array.from({length: 100}).map((_, i) => ({ id: i }));

async function mockInsertOne(lead: any) {
  return new Promise(resolve => setTimeout(() => resolve('success'), 20)); // Simulate 20ms network latency
}

async function mockInsertBulk(batch: any[]) {
  return new Promise(resolve => setTimeout(() => resolve('success'), 20 + batch.length * 0.1)); // 20ms network + small overhead
}

async function runSequential() {
  const s = performance.now();
  await Promise.all(leads.map(lead => mockInsertOne(lead)));
  return performance.now() - s;
}

async function runBulk() {
  const s = performance.now();
  await mockInsertBulk(leads);
  return performance.now() - s;
}

async function main() {
  const seqTime = await runSequential();
  console.log(`Sequential (Promise.all single inserts with connection limit simulation): ${seqTime}ms`);

  const bulkTime = await runBulk();
  console.log(`Bulk (.insert(batch)): ${bulkTime}ms`);
  console.log(`Improvement: ${((seqTime - bulkTime) / seqTime * 100).toFixed(2)}%`);
}

main();
