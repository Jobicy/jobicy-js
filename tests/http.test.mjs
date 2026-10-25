import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { JobicyClient } from "../src/index.js";

test("installed HTTP client traverses pages and exposes upstream errors", async (t) => {
  const calls = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    calls.push(url);
    response.setHeader("Content-Type", "application/json");
    if (url.searchParams.get("tag") === "limited") {
      response.writeHead(429, { "Retry-After": "60" });
      return response.end('{"success":false}');
    }
    if (url.searchParams.get("tag") === "broken") {
      response.writeHead(503, { "Content-Type": "text/html" });
      return response.end("<html>Unavailable</html>");
    }
    const last = url.searchParams.has("cursor");
    response.end(JSON.stringify({
      success: true, jobs: [{ id: last ? 2 : 1, url: `https://jobicy.com/jobs/${last ? 2 : 1}` }],
      nextCursor: last ? null : "opaque+/= token", hasMore: !last
    }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const client = new JobicyClient({ apiUrl: `http://127.0.0.1:${server.address().port}/api/jobs` });
  assert.deepEqual((await client.getAllJobs({ geo: "usa" })).map((job) => job.id), [1, 2]);
  assert.equal(calls[1].searchParams.get("cursor"), "opaque+/= token");
  assert.equal(calls[1].searchParams.get("geo"), "usa");
  await assert.rejects(client.getJobs({ tag: "limited" }), (error) => error.status === 429 && error.retryAfterSeconds === 60);
  await assert.rejects(client.getJobs({ tag: "broken" }), (error) => error.status === 503);
  assert.equal(calls.length, 4);
});
