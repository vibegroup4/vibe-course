const roles = new Set(["resident", "lin", "chen"]);
const bagSupplies = new Set(["resident", "collector"]);
const elevators = new Set(["一樓取件", "有電梯", "無電梯"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const lifetime = 7 * 86400000;
const dateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" });

function seedJobs(now) {
  const date = (days) => dateFormat.format(new Date(now + days * 86400000));
  return [
    {
      id: "sample-1", city: "臺北市", district: "松山區", date: date(1),
      start: "19:00", end: "20:00", bags: 2, bagSupply: "collector",
      floor: "3 樓", elevator: "無電梯", address: "示範巷 12 號 3 樓",
      note: "垃圾放在住戶門旁，綁好的兩袋。", contact: "demo-resident", status: "open",
      offers: [
        { id: crypto.randomUUID(), collector: "lin", amount: 90, note: "步行順路，兩袋可一次帶走。", contact: "demo-lin", revision: 1 },
        { id: crypto.randomUUID(), collector: "chen", amount: 120, note: "需爬三樓，可配合 19:30 左右取件。", contact: "demo-chen", revision: 1 },
      ],
    },
    {
      id: "sample-2", city: "臺北市", district: "大安區", date: date(2),
      start: "18:30", end: "19:30", bags: 1, bagSupply: "resident",
      floor: "1 樓", elevator: "一樓取件", address: "示範路 8 號 1 樓",
      note: "放在入口內側的自家門邊。", contact: "demo-resident", status: "booked", offers: [],
      accepted: { collector: "lin", amount: 70, note: "18:45 左右到。", contact: "demo-lin" },
    },
    {
      id: "sample-3", city: "臺北市", district: "中山區", date: date(-1),
      start: "19:30", end: "20:00", bags: 2, bagSupply: "resident",
      floor: "2 樓", elevator: "有電梯", address: "示範街 21 號 2 樓",
      note: "兩袋放在門旁。", contact: "demo-resident", status: "done", offers: [],
      accepted: { collector: "chen", amount: 85, note: "", contact: "demo-chen" },
    },
  ];
}

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function field(fields, name, limit, required = false) {
  const value = fields?.[name] ?? "";
  if (typeof value !== "string" || value.length > limit || (required && !value.trim())) {
    throw new RequestError("請檢查必填欄位和字數限制。");
  }
  return value.trim();
}

function pickupTime(date, time) {
  return Date.parse(`${date}T${time}:00+08:00`);
}

function stage(job, now) {
  return job.status === "open" && pickupTime(job.date, job.end) <= now ? "expired" : job.status;
}

function jobsFor(jobs, role, now) {
  // shortcut: a shared demo link authorizes all fictional roles, use verified accounts before accepting real cases.
  return jobs.flatMap((job) => {
    if (role !== "resident" && job.accepted?.collector !== role) {
      if (stage(job, now) !== "open") return [];
      const { address, note, contact, offers, ...summary } = job;
      return [{ ...summary, offers: offers.filter((offer) => offer.collector === role) }];
    }
    if (role === "resident") {
      return [{ ...job, offers: job.offers.map(({ contact, ...offer }) => offer) }];
    }
    return [job];
  });
}

function newJob(fields, now) {
  const city = field(fields, "city", 12, true);
  const district = field(fields, "district", 16, true);
  const postalCode = Object.hasOwn(pickupDistricts, city) && Object.hasOwn(pickupDistricts[city], district)
    ? pickupDistricts[city][district] : "";
  if (!postalCode) throw new RequestError("請選擇有效的取件縣市和行政區。");
  const date = field(fields, "date", 10, true);
  const start = field(fields, "start", 5, true);
  const end = field(fields, "end", 5, true);
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const begins = pickupTime(date, start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time.test(start) || !time.test(end) ||
      !Number.isFinite(begins) || begins <= now || dateFormat.format(new Date(begins)) !== date || start >= end) {
    throw new RequestError("請填寫未來的取件日期與有效的開始、結束時間。");
  }
  const bags = Number(field(fields, "bags", 2, true));
  if (!Number.isInteger(bags) || bags < 1 || bags > 30) throw new RequestError("垃圾袋數須介於 1 至 30。");
  const bagSupply = city === "臺北市" || city === "新北市" ? field(fields, "bagSupply", 12) : "";
  if ((city === "臺北市" || city === "新北市") && !bagSupplies.has(bagSupply)) {
    throw new RequestError("請選擇由誰準備專用垃圾袋。");
  }
  const elevator = field(fields, "elevator", 12);
  if (!elevators.has(elevator)) throw new RequestError("請選擇電梯條件。");
  return {
    id: crypto.randomUUID(), city, district, postalCode, date, start, end, bags, bagSupply, elevator,
    floor: field(fields, "floor", 16, true), address: field(fields, "address", 100, true),
    note: field(fields, "note", 300), contact: field(fields, "contact", 70), difficulty: field(fields, "difficulty", 100),
    status: "open", offers: [],
  };
}

function applyAction(jobs, role, { action, jobId, fields, offerId, offerRevision }, now) {
  const resident = role === "resident";
  if (action === "reset") {
    if (!resident) throw new RequestError("請切換到住戶視角重設。", 403);
    jobs.splice(0, jobs.length, ...seedJobs(now));
    return {};
  }
  if (action === "new") {
    if (!resident) throw new RequestError("請切換到住戶視角發單。", 403);
    if (jobs.length >= 40) throw new RequestError("這組示範已達 40 筆案件上限。");
    const job = newJob(fields, now);
    jobs.unshift(job);
    return { jobId: job.id };
  }

  const job = jobs.find((item) => item.id === jobId);
  if (!job) throw new RequestError("找不到這筆案件，請重新整理。", 404);
  const current = stage(job, now);
  const assigned = job.accepted?.collector === role;
  if (!resident && !assigned && current !== "open") throw new RequestError("這筆案件已無法操作。", 403);

  switch (action) {
    case "offer": {
      if (resident || current !== "open") break;
      const amount = Number(field(fields, "amount", 6, true));
      if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
        throw new RequestError("報價須為 1 至 100,000 元的整數。");
      }
      const previous = job.offers.find((offer) => offer.collector === role);
      job.offers = job.offers.filter((offer) => offer.collector !== role);
      job.offers.push({
        id: previous?.id ?? crypto.randomUUID(), collector: role, amount,
        note: field(fields, "note", 300), contact: field(fields, "contact", 70),
        revision: (previous?.revision ?? 0) + 1,
      });
      return { jobId };
    }
    case "withdraw":
      if (resident || current !== "open") break;
      job.offers = job.offers.filter((offer) => offer.collector !== role);
      return { jobId };
    case "accept": {
      if (!resident || current !== "open") break;
      const offer = job.offers.find((item) => item.id === offerId && item.revision === offerRevision);
      if (!offer) throw new RequestError("報價已更新或撤回，請重新比較後再確認。", 409);
      job.accepted = offer;
      job.status = "booked";
      job.offers = [];
      return { jobId };
    }
    case "cancel-confirm":
      if (!(resident && current === "open") && !((resident || assigned) && current === "booked")) break;
      job.status = "cancelled";
      job.issue = "";
      return { jobId };
    case "picked":
    case "done":
      if (!assigned || current !== (action === "picked" ? "booked" : "picked")) break;
      job.status = action;
      job.issue = "";
      return { jobId };
    case "issue":
      if (!assigned || !["booked", "picked"].includes(current)) break;
      job.issue = field(fields, "reason", 300, true);
      return { jobId };
  }
  throw new RequestError("目前身分或案件狀態已無法執行此操作，請重新查看。", 409);
}

async function readBody(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json") || !request.body) {
    throw new RequestError("請使用 JSON 提交。", 415);
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new RequestError("輸入內容過長。", 413);
    }
    body += decoder.decode(value, { stream: true });
  }
  try {
    const input = JSON.parse(body + decoder.decode());
    if (input && typeof input === "object" && !Array.isArray(input)) return input;
  } catch {
    // Invalid JSON gets the same response as a non-object body.
  }
  throw new RequestError("無法讀取送出的資料。");
}

async function demoApi(request, env, url) {
  if (!["GET", "POST"].includes(request.method)) return reply({ error: "不支援的操作。" }, 405);
  if (request.method === "POST" && request.headers.has("origin") && request.headers.get("origin") !== url.origin) {
    return reply({ error: "此來源無法修改示範資料。" }, 403);
  }
  const now = Date.now();
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const input = request.method === "POST" ? await readBody(request) : null;
  if (input?.action === "create" && !token) {
    const id = crypto.randomUUID();
    const jobs = seedJobs(now);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM demo_sessions WHERE id IN (SELECT id FROM demo_sessions WHERE expires_at <= ? LIMIT 30)").bind(now),
      env.DB.prepare("INSERT INTO demo_sessions (id, jobs, expires_at) VALUES (?, ?, ?)").bind(id, JSON.stringify(jobs), now + lifetime),
    ]);
    return reply({ id, revision: 0, jobs: jobsFor(jobs, "resident", now) }, 201);
  }

  if (!token || !uuid.test(token)) throw new RequestError("請開啟有效的示範連結。", 401);
  const role = input?.role ?? url.searchParams.get("role") ?? "resident";
  if (!roles.has(role)) throw new RequestError("無效的示範身分。");
  const row = await env.DB.prepare("SELECT revision, jobs FROM demo_sessions WHERE id = ? AND expires_at > ?")
    .bind(token, now).first();
  if (!row) throw new RequestError("這組示範已過期或不存在，請開始新的示範。", 404);

  const jobs = JSON.parse(row.jobs);
  if (!input) return reply({ revision: row.revision, jobs: jobsFor(jobs, role, now) });
  if (input.revision !== row.revision) throw new RequestError("另一台裝置已更新資料，請重新確認後再操作。", 409);
  const { jobId } = applyAction(jobs, role, input, now);
  const result = await env.DB.prepare("UPDATE demo_sessions SET jobs = ?, revision = revision + 1 WHERE id = ? AND revision = ?")
    .bind(JSON.stringify(jobs), token, row.revision).run();
  if (result.meta.changes !== 1) throw new RequestError("另一台裝置已更新資料，請重新確認後再操作。", 409);
  return reply({ revision: row.revision + 1, jobs: jobsFor(jobs, role, now), jobId });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/demo") {
      try {
        return await demoApi(request, env, url);
      } catch (error) {
        if (error instanceof RequestError) return reply({ error: error.message }, error.status);
        console.error("Demo database request failed", error.name);
        return reply({ error: "目前無法連線到示範資料庫，請稍後再試。" }, 503);
      }
    }

    const asset = assets[url.pathname === "/index.html" ? "/" : url.pathname];
    if (!asset || !["GET", "HEAD"].includes(request.method)) return new Response("Not found", { status: 404 });
    const [type, base64] = asset;
    return new Response(request.method === "HEAD" ? null : Uint8Array.from(atob(base64), (byte) => byte.charCodeAt(0)), {
      headers: { "Content-Type": type, "Cache-Control": "no-cache", "Referrer-Policy": "no-referrer" },
    });
  },
};
