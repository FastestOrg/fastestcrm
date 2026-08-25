/**
 * Executes a Supabase batch operation (e.g., delete or update) on an array of items by
 * splitting them into smaller chunks to prevent HTTP 414 Request-URI Too Large errors
 * and database query statement timeouts.
 *
 * @param items Array of items (e.g., lead IDs) to operate on
 * @param operation Function performing the Supabase query for a chunk of items
 * @param chunkSize Maximum number of items per chunk (default: 100 to stay safely under 4KB URL limits)
 * @param concurrency Maximum number of concurrent chunk operations (default: 5)
 */
export async function executeInChunks<T>(
    items: T[],
    operation: (chunk: T[]) => Promise<{ error: any }>,
    chunkSize: number = 100,
    concurrency: number = 5
): Promise<{ error: any }> {
    if (!items || items.length === 0) return { error: null };

    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }

    for (let i = 0; i < chunks.length; i += concurrency) {
        const currentBatch = chunks.slice(i, i + concurrency);
        const results = await Promise.all(currentBatch.map(chunk => operation(chunk)));
        const failedResult = results.find(res => res.error);
        if (failedResult) {
            return { error: failedResult.error };
        }
    }
    return { error: null };
}
