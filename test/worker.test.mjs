import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDemoDatabase } from "../server/local-db.mjs";
import "../scripts/build.mjs";

const { default: worker } = await import("../dist/server/index.js");

function client(db, token) {
  return async (input, role = "resident", headers = {}) => {
    const result = await worker.fetch(new Request("https://demo.example/api/demo?role=" + role, {
      method: input ? "POST" : "GET",
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(input ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: input ? JSON.stringify(input) : undefined,
    }), { DB: db });
    return { status: result.status, ...await result.json() };
  };
}

test("shared demo persists, hides handoff details, and accepts exactly one concurrent offer", async () => {
  const directory = await mkdtemp(join(tmpdir(), "trash-camal-"));
  const filename = join(directory, "demo.sqlite");
  let db = openDemoDatabase(filename);
  try {
    const seeded = await client(db)({ action: "create" });
    assert.equal(seeded.status, 201);
    const separate = await client(db)({ action: "create" });
    assert.notEqual(separate.id, seeded.id);
    const initial = client(db, seeded.id);
    const tomorrow = seeded.jobs[0].date;
    const fields = {
      city: "臺北市", district: "松山區", date: tomorrow, start: "19:00", end: "20:00",
      bags: "2", bagSupply: "resident", floor: "3 樓", elevator: "無電梯",
      address: "測試巷 1 號", note: "測試交接", contact: "test-resident",
    };
    const invalid = await initial({ action: "new", revision: 0, fields: { ...fields, address: " " } });
    assert.equal(invalid.status, 400);
    const forgedOrigin = await initial({ action: "new", revision: 0, fields }, "resident", { Origin: "https://other.example" });
    assert.equal(forgedOrigin.status, 403);
    const posted = await initial({ action: "new", revision: 0, fields });
    assert.equal(posted.status, 200);

    db.close();
    db = openDemoDatabase(filename);
    const user = client(db, seeded.id);
    const jobId = posted.jobId;
    const collectorView = await user(null, "lin");
    const job = collectorView.jobs.find((item) => item.id === jobId);
    assert.ok(job);
    for (const key of ["address", "note", "contact"]) assert.equal(Object.hasOwn(job, key), false);
    assert.equal((await client(db, separate.id)()).jobs.some((item) => item.id === jobId), false);

    const lin = await user({ action: "offer", revision: 1, jobId, fields: { amount: "90", contact: "test-lin" } }, "lin");
    assert.equal(lin.status, 200);
    const chen = await user({ action: "offer", revision: 2, jobId, fields: { amount: "120" } }, "chen");
    assert.equal(chen.status, 200);
    const before = (await user()).jobs.find((item) => item.id === jobId);
    const oldOffer = before.offers[0];
    assert.equal(Object.hasOwn(oldOffer, "contact"), false);
    const revised = await user({ action: "offer", revision: 3, jobId, fields: { amount: "95", contact: "test-lin" } }, "lin");
    assert.equal(revised.status, 200);
    const accept = (offer) => user({ action: "accept", revision: 4, jobId, offerId: offer.id, offerRevision: offer.revision });
    assert.equal((await accept(oldOffer)).status, 409);
    const latest = (await user()).jobs.find((item) => item.id === jobId);
    const results = await Promise.all(latest.offers.map(accept));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const booked = (await user()).jobs.find((item) => item.id === jobId);
    const winner = booked.accepted.collector;
    const loser = winner === "lin" ? "chen" : "lin";
    assert.equal((await user(null, loser)).jobs.some((item) => item.id === jobId), false);
    assert.equal((await user(null, winner)).jobs.find((item) => item.id === jobId).address, fields.address);
    assert.equal((await user({ action: "picked", revision: 5, jobId }, loser)).status, 403);
    assert.equal((await user({ action: "picked", revision: 5, jobId }, winner)).status, 200);
    assert.equal((await user({ action: "done", revision: 6, jobId }, winner)).status, 200);
    assert.equal((await user()).jobs.find((item) => item.id === jobId).status, "done");
  } finally {
    db.close();
    await rm(directory, { recursive: true });
  }
});
