/**
 * Load-test script for the two most important read paths:
 *   1. GET /feed/public            (page 1 — Redis cache hit path)
 *   2. GET /feed/public?cursor=... (deep pagination — MongoDB index scan path)
 *   3. GET /posts/:id              (post detail — Redis cache hit path)
 *
 * Run the server first (npm run dev / npm start), then:
 *   npm run benchmark
 *
 * Requires the DB to already be seeded (npm run seed) so a real postId and
 * a real deep cursor are available to test against.
 */
// autocannon ships without official types; a minimal ambient declaration
// (see scripts/autocannon.d.ts) covers the surface this script uses.
import autocannon from "autocannon";
import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://localhost:4000/api/v1";
const prisma = new PrismaClient();

function run(opts: autocannon.Options): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err: Error | null, result: autocannon.Result) => (err ? reject(err) : resolve(result)));
  });
}

function printSummary(label: string, result: autocannon.Result): void {
  console.log(`\n=== ${label} ===`);
  console.log(`Requests/sec:  ${result.requests.average}`);
  console.log(`Latency (ms):  p50=${result.latency.p50} p99=${result.latency.p99} max=${result.latency.max}`);
  console.log(`Throughput:    ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
  console.log(`Errors:        ${result.errors}, Timeouts: ${result.timeouts}`);
}

async function main(): Promise<void> {
  const samplePost = await prisma.post.findFirst({ where: { visibility: "PUBLIC" } });
  if (!samplePost) {
    console.error("No public posts found — run `npm run seed` first.");
    process.exit(1);
  }

  const feedPage1 = await run({
    url: `${BASE_URL}/feed/public`,
    connections: 50,
    duration: 20,
    title: "public feed - page 1 (cached)",
  });
  printSummary("Public feed — page 1 (Redis cache)", feedPage1);

  // Fetch one real cursor so the "deep pagination" run hits a genuine index-scan query, not the cache.
  interface FeedResponse {
    pagination?: { nextCursor?: string | null };
  }
  const page1Body = (await (await fetch(`${BASE_URL}/feed/public`)).json()) as FeedResponse;
  const cursor: string | undefined = page1Body.pagination?.nextCursor ?? undefined;

  if (cursor) {
    const feedDeep = await run({
      url: `${BASE_URL}/feed/public?cursor=${encodeURIComponent(cursor)}`,
      connections: 50,
      duration: 20,
      title: "public feed - deep page (uncached, index scan)",
    });
    printSummary("Public feed — deep page (MongoDB index scan)", feedDeep);
  }

  const postDetail = await run({
    url: `${BASE_URL}/posts/${samplePost.id}`,
    connections: 50,
    duration: 20,
    title: "post detail (cached)",
  });
  printSummary("Post detail (Redis cache)", postDetail);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
