import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { JobicyClient, JobicyError } from "../src/index.js";

const job = (id, extra = {}) => ({ id, url: `https://jobicy.com/jobs/${id}`, jobTitle: "Python engineer", ...extra });
const page = (jobs, nextCursor = null) => ({ jobs, nextCursor, hasMore: nextCursor !== null });
const jsonResponse = (body, options) => new Response(JSON.stringify(body), options);

test("Node client preserves filters and opaque cursors through empty pages", async (t) => {
  const requests = [];
  const pages = [page([job(1), job(1)], "opaque+/= token"), page([], "second"), page([job(1), job(2)])];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(new URL(url));
    return jsonResponse(pages.shift());
  });
  const jobs = await new JobicyClient().getAllJobs({ count: 200, geo: "usa", industry: "engineering", tag: "python" });
  assert.deepEqual(jobs.map(({ id }) => id), [1, 2]);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].searchParams.has("cursor"), false);
  assert.equal(requests[1].searchParams.get("cursor"), "opaque+/= token");
  for (const url of requests) {
    assert.equal(url.searchParams.get("count"), "200");
    assert.equal(url.searchParams.get("geo"), "usa");
    assert.equal(url.searchParams.get("industry"), "engineering");
    assert.equal(url.searchParams.get("tag"), "python");
  }
});

test("Node page metadata and array method remain distinct", async (t) => {
  t.mock.method(globalThis, "fetch", async () => jsonResponse(page([job(1), job(2, { url: "https://example.com/job" })], "next")));
  const client = new JobicyClient();
  assert.deepEqual((await client.getJobs()).map(({ id }) => id), [1]);
  const result = await client.getJobsPage();
  assert.equal(result.nextCursor, "next");
  assert.equal(result.hasMore, true);
  await assert.rejects(client.getJobs({ count: 201 }), RangeError);
});

test("Node rejects cursor cycles and inconsistent metadata", async (t) => {
  t.mock.method(globalThis, "fetch", async () => jsonResponse(page([], "repeat")));
  await assert.rejects(new JobicyClient().getAllJobs(), /repeated cursor/);
  globalThis.fetch = async () => jsonResponse({ jobs: [], nextCursor: null, hasMore: true });
  await assert.rejects(new JobicyClient().getJobsPage(), /pagination metadata/);
});

test("Node propagates expired cursors and rate limits without automatic loops", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return jsonResponse({ error: "expired" }, { status: 400 });
  });
  await assert.rejects(new JobicyClient().getAllJobs({ cursor: "expired" }), (error) => error instanceof JobicyError && error.status === 400);
  assert.equal(calls, 1);
  globalThis.fetch = async () => jsonResponse({}, { status: 429, headers: { "Retry-After": "7200" } });
  await assert.rejects(new JobicyClient().getJobsPage(), (error) => error.status === 429 && error.retryAfterSeconds === 7200);
});

