const BATCH_SIZE = 100;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockSupabase = {
  from: () => ({
    insert: async (data: any | any[]) => {
      await delay(10); // 10ms network delay

      if (Array.isArray(data)) {
        // Mock 1% chance of batch failing due to duplicates
        if (Math.random() < 0.01) {
          return { error: { code: '23505' } };
        }
        return { error: null, data: data.map(() => ({ id: 1 })) };
      }

      // individual insert
      if (Math.random() < 0.05) { // 5% duplicates
         return { error: { code: '23505' } };
      }
      return { error: null, data: { id: 1 } };
    }
  })
};

async function benchmark() {
  const leads = Array.from({ length: 500 }, (_, i) => ({ name: `Lead ${i}` }));

  console.log('--- Baseline: Promise.all with individual inserts ---');
  let start = Date.now();

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (lead) => {
      await mockSupabase.from().insert(lead);
    }));
  }

  let end = Date.now();
  console.log(`Baseline time: ${end - start}ms`);

  console.log('\n--- Optimized: Bulk insert with fallback ---');
  start = Date.now();

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);

    const { error } = await mockSupabase.from().insert(batch);
    if (error && error.code === '23505') {
       // fallback
       await Promise.all(batch.map(async (lead) => {
         await mockSupabase.from().insert(lead);
       }));
    }
  }

  end = Date.now();
  console.log(`Optimized time: ${end - start}ms`);
}

benchmark();
