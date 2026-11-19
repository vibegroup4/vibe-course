(function () {
  "use strict";

  const icons = {
    brand: '<path d="M3 14.5 5.4 13H7l2.2-3.6a1.8 1.8 0 0 1 3 .1l2 3.2h2.4l1.3-5.5 2.5-1.5 1.6 1.4-.3 2-1.8.5-1.4 5.8H7L5.7 19m4.7-3.6-.2 3.6m5-3.6.6 3.6m2.6-3.6 1.1 3.6"/>',
    user: '<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    route: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    refresh: '<path d="M20 7v5h-5m5 0a8 8 0 1 0-2 6"/>',
    bag: '<path d="m9 7-2-4h10l-2 4m-6 0h6m-6 0c-1 2-5 5-5 9a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4c0-4-4-7-5-9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M20 10c0 5-8 10-8 10s-8-5-8-10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    message: '<path d="M4 5h16v11H9l-5 4V5Zm4 5h8"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };

  const people = { resident: "住戶", lin: "林小安", chen: "陳宇晴" };
  const collectors = { lin: "demo-lin", chen: "demo-chen" };
  const statusNames = { open: "待報價", booked: "已約定", picked: "已取件", done: "已完成", cancelled: "已取消", abandoned: "代收者已棄單", expired: "已逾期" };
  const bagSupplyLabels = {
    resident: "住戶已用專用垃圾袋裝好",
    collector: "需要代收者準備專用垃圾袋"
  };
  const modal = document.querySelector("#modal");
  const personaSelect = document.querySelector("#persona");
  const list = document.querySelector("#case-list");
  const filters = document.querySelector("#filters");
  const statistics = document.querySelector("#statistics");
  const statisticsPeriod = document.querySelector("#statistics-period");
  const calendar = document.querySelector("#calendar");
  const calendarFilters = document.querySelector("#calendar-filters");
  const calendarLabels = { confirmed: "已確認", done: "已完成", abandoned: "已棄單" };
  const calendarMonthFormat = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", timeZone: "UTC" });
  let calendarMonth;
  const casesTitle = document.querySelector("#cases-title");
  const toast = document.querySelector("#toast");
  const money = new Intl.NumberFormat("zh-TW");
  const defaultGuide = document.querySelector("#guide-steps").innerHTML;
  const sessionStatus = document.querySelector("#session-status");
  let session = new URLSearchParams(location.hash.slice(1)).get("demo");
  let revision;
  let busy = false;
  const state = { persona: "resident", jobs: [] };
  let filter = "all";
  let modalOrigin;
  let toastTimer;

  function icon(name) {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  }

  function addIcons(container = document) {
    container.querySelectorAll("[data-icon]:empty").forEach((element) => {
      element.innerHTML = icon(element.dataset.icon);
    });
  }

  function escapeHtml(value) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
  }

  const taipeiDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" });

  function dateKey(offset = 0, from = Date.now()) {
    return taipeiDate.format(new Date(Number(from) + offset * 86400000));
  }

  function calendarDate(offset = 0, from) {
    return new Date(Number(from) + offset * 86400000).toISOString().slice(0, 10);
  }

  function currentMonth() {
    return new Date(dateKey().slice(0, 7) + "-01T00:00:00Z");
  }

  calendarMonth = currentMonth();

  async function api(input, role = state.persona, token = session) {
    const headers = token ? { Authorization: "Bearer " + token } : {};
    if (input) headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await fetch("/api/demo?role=" + role, {
        method: input ? "POST" : "GET", headers, signal: AbortSignal.timeout(10000),
        body: input ? JSON.stringify({ ...input, revision, role }) : undefined,
      });
    } catch (error) {
      throw new Error(error.name === "TimeoutError" ? "連線逾時。先更新資料確認結果，再決定是否重送。" : "無法連線，請檢查網路後再試。");
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      throw Object.assign(new Error(result?.error || "目前無法讀取示範資料。"), { status: response.status });
    }
    return result;
  }

  function showSession(result, role) {
    if (role !== state.persona && modal.open) modal.close();
    revision = result.revision;
    state.persona = role;
    state.jobs = result.jobs;
    sessionStatus.textContent = "示範連結可跨裝置使用，有效 7 天。請只填寫虛構資料。";
    render();
  }

  function setBusy(value) {
    busy = value;
    personaSelect.disabled = value || revision === undefined;
    list.setAttribute("aria-busy", String(value));
  }

  async function refresh(role = state.persona, startNew = false) {
    if (busy) return;
    setBusy(true);
    try {
      if (startNew || !session) {
        const result = await api({ action: "create" }, "resident", null);
        session = result.id;
        history.replaceState(null, "", location.pathname + location.search + "#demo=" + session);
        filter = "all";
        if (modal.open) modal.close();
        showSession(result, "resident");
      } else {
        showSession(await api(undefined, role), role);
      }
    } catch (error) {
      personaSelect.value = state.persona;
      if (error.status === 401 || error.status === 404) {
        revision = undefined;
        state.jobs = [];
        render();
      }
      sessionStatus.textContent = error.message;
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(action, message, jobId, fields, offer, form) {
    if (busy || revision === undefined) return;
    setBusy(true);
    const submitter = form?.querySelector("button[type=submit]");
    if (submitter) submitter.disabled = true;
    try {
      const result = await api({ action, jobId, fields, ...offer });
      if (action === "reset" || action === "new") filter = "all";
      showSession(result, state.persona);
      const job = state.jobs.find((item) => item.id === result.jobId);
      if (job) showDetail(job);
      else if (modal.open) modal.close();
      notify(message);
    } catch (error) {
      if (error.status === 409 || error.status === 404) {
        if (!form && modal.open) modal.close();
        setBusy(false);
        await refresh();
        if (form?.isConnected) formError(form, error.message + " 已更新案件，表單內容已保留。");
      } else if (form) {
        formError(form, error.message);
      }
      notify(error.message);
    } finally {
      if (submitter) submitter.disabled = false;
      setBusy(false);
    }
  }

  function price(amount) {
    return `NT$ ${money.format(amount)}`;
  }

  const pickupDateFormat = new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", weekday: "short" });

  function pickupDateLabel(date) {
    return pickupDateFormat.format(new Date(`${date}T00:00:00`));
  }

  function timeRange(job) {
    return `${job.start}–${job.end}`;
  }

  function windowLabel(job) {
    return `${pickupDateLabel(job.date)} ${timeRange(job)}`;
  }

  function postalCodeFor(city, district) {
    if (!Object.hasOwn(pickupDistricts, city)) return "";
    const districts = pickupDistricts[city];
    return Object.hasOwn(districts, district) ? districts[district] : "";
  }

  function formatCaseTitle(district, bags) {
    return `${district}｜${bags} 袋垃圾代收`;
  }

  function caseTitle(job) {
    const savedTitle = job.id.startsWith("sample-") ? "" : job.title;
    return savedTitle || formatCaseTitle(job.district, job.bags);
  }

  function pickupCity(job) {
    return job.city ?? (job.id.startsWith("sample-") ? "臺北市" : "");
  }

  function asksAboutBagSupply(city) {
    return city === "臺北市" || city === "新北市";
  }

  function bagSupplyLabel(job) {
    if (!asksAboutBagSupply(pickupCity(job))) return "";
    return bagSupplyLabels[job.bagSupply] ?? "住戶尚未填寫";
  }

  function pickupAreaLabel(job) {
    const city = pickupCity(job);
    const code = job.postalCode || postalCodeFor(city, job.district);
    return `${code ? `${code} ` : ""}${city}${job.district}`;
  }

  function expired(job) {
    return Date.now() >= new Date(`${job.date}T${job.end}:00+08:00`).getTime();
  }

  function stage(job) {
    return job.status === "open" && expired(job) ? "expired" : job.status;
  }

  function badge(job) {
    const current = stage(job);
    if (job.issue && ["booked", "picked"].includes(current)) {
      return `<span class="status issue">${current === "picked" ? "處理遇到問題" : "取件遇到問題"}</span>`;
    }
    if (current === "booked" && expired(job)) {
      return '<span class="status issue">已逾取件時間</span>';
    }
    return `<span class="status ${current}">${statusNames[current]}</span>`;
  }

  function visibleToCollector(job) {
    return stage(job) === "open" || job.accepted?.collector === state.persona;
  }

  function assigned(job) {
    return job.accepted?.collector === state.persona;
  }

  function isResident() {
    return state.persona === "resident";
  }

  function hasJobAccess(job) {
    return Boolean(job && (isResident() || visibleToCollector(job)));
  }

  function renderCases() {
    const jobs = state.jobs.filter((job) => hasJobAccess(job));
    const sets = {
      all: jobs,
      open: jobs.filter((job) => stage(job) === "open"),
      quoted: jobs.filter((job) => !isResident() && stage(job) === "open" && job.offers.some((offer) => offer.collector === state.persona)),
      active: jobs.filter((job) => ["booked", "picked"].includes(stage(job))),
      done: jobs.filter((job) => stage(job) === "done"),
      ended: jobs.filter((job) => ["cancelled", "abandoned", "expired"].includes(stage(job)))
    };
    const labels = { all: "全部", open: "待報價", quoted: "已報價", active: "進行中", done: "已完成", ended: "已結束" };
    filters.innerHTML = Object.entries(labels)
      .filter(([key]) => (key !== "quoted" || !isResident()) && (key !== "ended" || sets.ended.length > 0 || filter === "ended"))
      .map(([key, label]) => `
        <button class="filter" type="button" data-action="filter" data-key="${key}" aria-pressed="${filter === key}">
          ${label}<span class="filter-count">${sets[key].length}</span>
        </button>`).join("");

    list.innerHTML = sets[filter].length
      ? sets[filter].map(caseCard).join("")
      : `<p class="empty">${filter === "all" && isResident() ? "目前沒有案件。你可以先發布一筆代收需求。" : "目前沒有符合此篩選的案件。"}</p>`;
  }

  function caseCard(job) {
    const title = caseTitle(job);
    const bagSupply = bagSupplyLabel(job);
    const ownOffer = job.offers.find((offer) => offer.collector === state.persona);
    let summary = "";
    if (job.accepted) {
      summary = price(job.accepted.amount);
    } else if (stage(job) === "open" && isResident()) {
      summary = `${job.offers.length} 份報價`;
    } else if (stage(job) === "open" && ownOffer) {
      summary = `已報價 ${price(ownOffer.amount)}`;
    }
    return `
      <article class="case-card">
        <div class="case-main">
          <span class="case-icon" data-icon="bag"></span>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(pickupAreaLabel(job))}｜${pickupDateLabel(job.date)} <span class="time-range">${timeRange(job)}</span></p>
            <div class="case-tags">
              ${title === job.title ? `<span>${job.bags} 袋</span>` : ""}<span>${escapeHtml(job.floor)}・${escapeHtml(job.elevator)}</span>
              ${bagSupply ? `<span>${escapeHtml(bagSupply)}</span>` : ""}
              ${summary ? `<span>${icon("message")}${summary}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="case-side">
          ${badge(job)}
          <button class="button button-quiet case-link" type="button" data-action="detail" data-id="${job.id}" aria-label="查看 ${escapeHtml(title)}">${stage(job) === "open" && isResident() && job.offers.length ? "查看報價" : "查看詳情"}${icon("arrow")}</button>
        </div>
      </article>`;
  }

  function statisticsBounds(period, now = new Date()) {
    now = new Date(dateKey(0, now) + "T00:00:00Z");
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    if (period === "week") {
      const monday = now.getUTCDate() - (now.getUTCDay() + 6) % 7;
      return [new Date(Date.UTC(year, month, monday)), new Date(Date.UTC(year, month, monday + 7))];
    }
    const months = { month: 1, quarter: 3, year: 12 }[period];
    const first = Math.floor(month / months) * months;
    return [new Date(Date.UTC(year, first, 1)), new Date(Date.UTC(year, first + months, 1))];
  }

  function renderStatistics() {
    const [start, end] = statisticsBounds(statisticsPeriod.value);
    const inPeriod = (time) => Number.isFinite(time) && dateKey(0, time) >= calendarDate(0, start) && dateKey(0, time) < calendarDate(0, end);
    let bookings = 0;
    let abandonments = 0;
    let revenue = 0;
    for (const job of state.jobs.filter(assigned)) {
      const pickup = Date.parse(job.date + "T" + job.start + ":00+08:00");
      if (inPeriod(job.bookedAt ?? pickup)) bookings++;
      if (inPeriod(job.abandonedAt)) abandonments++;
      if (job.status === "done" && inPeriod(job.completedAt ?? pickup)) revenue += job.accepted.amount;
    }
    document.querySelector("#statistics-range").textContent = `${calendarDate(0, start).replaceAll("-", "/")} ～ ${calendarDate(-1, end).replaceAll("-", "/")}`;
    document.querySelector("#statistics-values").innerHTML = detail("接單數", money.format(bookings)) + detail("棄單數", money.format(abandonments)) + detail("完成成交金額", price(revenue));
  }

  function renderCalendar() {
    const selected = new Set([...calendarFilters.querySelectorAll("input:checked")].map((input) => input.value));
    const year = calendarMonth.getUTCFullYear();
    const month = calendarMonth.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const start = calendarDate(0, first);
    const end = calendarDate(0, new Date(Date.UTC(year, month + 1, 1)));
    const today = dateKey();
    const events = new Map();
    for (const job of state.jobs) {
      if (!assigned(job) || job.date < start || job.date >= end) continue;
      const category = ["booked", "picked"].includes(job.status) ? "confirmed" : job.status;
      if (!selected.has(category)) continue;
      if (!events.has(job.date)) events.set(job.date, []);
      events.get(job.date).push({ job, category });
    }

    document.querySelector("#calendar-month").textContent = calendarMonthFormat.format(first);
    const empty = document.querySelector("#calendar-empty");
    empty.textContent = selected.size ? "本月沒有符合勾選狀態的案件。" : "勾選案件狀態即可顯示。";
    empty.hidden = events.size > 0;
    const blanks = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const padding = '<div class="calendar-padding" aria-hidden="true"></div>';
    const cells = Array.from({ length: days }, (_, offset) => {
      const date = calendarDate(offset, first);
      const entries = events.get(date) ?? [];
      entries.sort((a, b) => a.job.start.localeCompare(b.job.start));
      return `<div class="calendar-day${entries.length ? " has-events" : ""}">
        <time datetime="${date}"${date === today ? ' aria-current="date"' : ""}>
          <span class="calendar-day-number">${offset + 1}</span><span class="calendar-date-label">${pickupDateLabel(date)}</span>
        </time>
        ${entries.map(({ job, category }) => `<button class="calendar-event calendar-${category}" type="button" data-action="detail" data-id="${escapeHtml(job.id)}"
          aria-label="${escapeHtml(`${windowLabel(job)} ${caseTitle(job)}，${calendarLabels[category]}，查看詳情`)}">
          <b>${escapeHtml(job.district)}・${job.bags} 袋</b><span>${escapeHtml(job.start)} ${calendarLabels[category]}</span>
        </button>`).join("")}
      </div>`;
    });
    document.querySelector("#calendar-days").innerHTML = padding.repeat(blanks) + cells.join("") + padding.repeat((7 - (blanks + days) % 7) % 7);
  }

  function render() {
    const resident = isResident();
    personaSelect.value = state.persona;
    statistics.hidden = resident || revision === undefined;
    calendar.hidden = statistics.hidden;
    document.querySelector("#statistics-link").hidden = statistics.hidden;
    document.querySelector("#calendar-link").hidden = calendar.hidden;
    if (!statistics.hidden) {
      renderStatistics();
      renderCalendar();
    }
    casesTitle.textContent = resident ? "我的代收案件" : "附近代收案件";
    document.querySelector("#cases-description").textContent = resident
      ? "查看報價、確認代收者，掌握每一單的進度。"
      : "查看取件時間和搬運條件，為合適的案件報價。";
    document.querySelector("#new-case").hidden = !resident;
    document.querySelector("[data-action=reset]").hidden = !resident || revision === undefined;
    document.querySelector("[data-action=share]").hidden = revision === undefined;
    const heroAction = document.querySelector("#hero-action");
    heroAction.dataset.action = resident ? "new" : "browse";
    heroAction.disabled = revision === undefined;
    document.querySelector("#new-case").disabled = revision === undefined;
    heroAction.innerHTML = resident ? `${icon("plus")}發布代收需求` : `${icon("pin")}查看附近案件`;
    document.querySelector("#guide-steps").innerHTML = resident ? defaultGuide : `
      <li><span class="step">1</span><div><h3>查看案件</h3><p>確認區域、取件時段和搬運條件。</p></div></li>
      <li><span class="step">2</span><div><h3>提出報價</h3><p>按案件難度出價，等住戶選定。</p></div></li>
      <li><span class="step">3</span><div><h3>依約取件</h3><p>倒完後更新狀態，讓住戶知道結果。</p></div></li>`;
    renderCases();
    addIcons();
  }

  function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toastTimer = setTimeout(() => { toast.textContent = ""; }, 3600);
  }

  function showModal(title, body, subtitle = "") {
    if (!modal.open) modalOrigin = document.activeElement;
    modal.innerHTML = `
      <header class="modal-head">
        <div><h2 id="modal-title" tabindex="-1">${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div>
        <button class="close-button" type="button" data-action="close" aria-label="關閉">${icon("close")}</button>
      </header>
      <div class="modal-body">${body}</div>`;
    if (!modal.open) modal.showModal();
    const target = modal.querySelector("[data-initial-focus]") || modal.querySelector("#modal-title");
    target.focus();
  }

  function actionButton(label, action, jobId, style = "quiet", attributes = "") {
    return `<button class="button button-${style}" type="button" data-action="${action}"${jobId ? ` data-id="${jobId}"` : ""}${attributes}>${label}</button>`;
  }

  function formButtons(label, back = actionButton("取消", "close")) {
    return `<p class="form-error" role="alert" hidden></p>
      <div class="modal-actions">${back}<button class="button button-primary" type="submit">${label}</button></div>`;
  }

  function showNew() {
    showModal("發布代收需求", `
      <form data-form="new">
        <div class="form-grid">
          <label class="pickup-area-field">取件縣市
            <select id="new-city" name="city" required data-initial-focus>
              <option value="">選擇縣市</option>
              ${Object.keys(pickupDistricts).map((city) => `<option>${escapeHtml(city)}</option>`).join("")}
            </select>
          </label>
          <label class="pickup-area-field">取件行政區
            <select id="new-district" name="district" aria-describedby="postal-code-help" required disabled>
              <option value="">先選擇縣市</option>
            </select>
            <small id="postal-code-help">行政區前方是郵遞區號前 3 碼。</small>
          </label>
          <label>取件日期<input name="date" type="date" min="${dateKey()}" value="${dateKey(1)}" required></label>
          <label>垃圾袋數<input id="new-bags" name="bags" type="number" min="1" max="30" step="1" value="1" required></label>
          <div class="case-name-preview full">
            <span id="new-case-title-label">案件名稱</span>
            <output aria-labelledby="new-case-title-label" for="new-district new-bags">依行政區和袋數自動產生</output>
          </div>
          <label class="full" id="bag-supply-field" hidden>是否自備專用垃圾袋
            <select name="bagSupply" aria-describedby="bag-supply-help" disabled>
              <option value="">選擇由誰準備</option>
              ${Object.entries(bagSupplyLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
            </select>
            <small id="bag-supply-help">若請代收者準備，對方可將袋費計入報價。</small>
          </label>
          <label>開始時間<input name="start" type="time" value="19:00" required></label>
          <label>結束時間<input name="end" type="time" value="20:00" required></label>
          <label>搬運樓層<input name="floor" maxlength="16" value="1 樓" required></label>
          <label>電梯<select name="elevator"><option>一樓取件</option><option>有電梯</option><option>無電梯</option></select></label>
          <label class="full">聯絡方式（選填）<input name="contact" maxlength="70" placeholder="示範電話或通訊帳號"></label>
          <label class="full">確切取件地點<input name="address" maxlength="100" placeholder="例如：示範巷 12 號 3 樓" required></label>
          <label class="full">取件說明（選填）<textarea name="note" maxlength="300" placeholder="例如：放在自家門邊，袋子已綁好。"></textarea><small>確切地點、交接說明和聯絡方式只會在成交後顯示給接單者。</small></label>
          <label class="full">搬運補充（選填）<input name="difficulty" maxlength="100" placeholder="例如：有一袋比較重，可供代收者估價"></label>
        </div>
        ${formButtons("發布需求")}
      </form>`, "請使用虛構的地址和聯絡資訊進行示範。");

    const form = modal.querySelector("form");
    const { city, district, bags, bagSupply } = form.elements;
    const bagSupplyField = form.querySelector("#bag-supply-field");
    const preview = form.querySelector("output");
    function updateTitle() {
      preview.textContent = district.value && bags.validity.valid
        ? formatCaseTitle(district.value, bags.valueAsNumber)
        : "依行政區和袋數自動產生";
    }
    city.addEventListener("change", () => {
      const areas = Object.entries(pickupDistricts[city.value] ?? {});
      district.replaceChildren(
        new Option(city.value ? "選擇行政區" : "先選擇縣市", ""),
        ...areas.map(([name, code]) => new Option(`${code} ${name}`, name))
      );
      district.disabled = !city.value;
      const showBagSupply = asksAboutBagSupply(city.value);
      bagSupplyField.hidden = !showBagSupply;
      bagSupply.disabled = !showBagSupply;
      bagSupply.required = showBagSupply;
      if (!showBagSupply) bagSupply.value = "";
      updateTitle();
    });
    district.addEventListener("change", updateTitle);
    bags.addEventListener("input", updateTitle);
  }

  function detail(label, value, full = false) {
    return `<div${full ? ' class="full"' : ""}><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function reviewTarget(job, author = state.persona) {
    return people[author === "resident" ? job.accepted.collector : "resident"];
  }

  function canReview(job) {
    return job?.status === "done" && job.accepted && (isResident() || assigned(job)) && !job.reviews?.[state.persona];
  }

  function showReview(job) {
    if (!canReview(job)) return;
    showModal(`評價${reviewTarget(job)}`, `
      <form data-form="review" data-id="${job.id}">
        <div class="form-grid">
          <label class="full">星等
            <select name="stars" required data-initial-focus>
              <option value="">選擇 1 至 5 顆星</option>
              ${[5, 4, 3, 2, 1].map((stars) => `<option value="${stars}">${"★".repeat(stars)} ${stars} 顆星</option>`).join("")}
            </select>
          </label>
          <label class="full">服務評價（選填）<textarea name="comment" maxlength="300"></textarea></label>
        </div>
        ${formButtons("送出評價", actionButton("返回", "detail", job.id))}
      </form>`, "評價送出後，雙方都可在案件詳情查看。");
  }

  function showDetail(job) {
    if (!hasJobAccess(job)) return;
    const current = stage(job);
    const ownOffer = job.offers.find((offer) => offer.collector === state.persona);
    const canSeeLocation = isResident() || (assigned(job) && current !== "abandoned");
    const agreedContact = isResident() ? job.accepted?.contact : job.contact;
    const bagSupply = bagSupplyLabel(job);
    let quoteSection = "";
    const actions = [];

    if (job.accepted) {
      quoteSection = `<h3 class="offer-heading">成交報價</h3>
        <div class="offer-row"><div><b>${people[job.accepted.collector]}</b>${job.accepted.note ? `<p>${escapeHtml(job.accepted.note)}</p>` : ""}</div><strong>${price(job.accepted.amount)}</strong></div>`;
    } else if (isResident() && current === "open") {
      quoteSection = `<h3 class="offer-heading">收到的報價（${job.offers.length}）</h3>`;
      quoteSection += job.offers.length ? job.offers.map((offer) => `
        <div class="offer-row">
          <div><b>${people[offer.collector]}</b>　<strong>${price(offer.amount)}</strong>
            ${offer.note ? `<p>${escapeHtml(offer.note)}</p>` : ""}</div>
          ${actionButton("選定報價", "choose", job.id, "quiet", ` data-offer="${offer.id}" data-revision="${offer.revision}"`)}
        </div>`).join("") : '<p class="notice">目前還沒有報價。可切換到代收者視角，為這筆案件報價。</p>';
    } else if (current === "open") {
      if (ownOffer) {
        quoteSection = `<h3 class="offer-heading">我的報價</h3>
          <div class="offer-row"><div><strong>${price(ownOffer.amount)}</strong>${ownOffer.note ? `<p>${escapeHtml(ownOffer.note)}</p>` : ""}</div></div>`;
        actions.push(actionButton("撤回報價", "withdraw", job.id));
      }
      actions.push(actionButton(ownOffer ? "修改報價" : "提出報價", "offer", job.id, "primary"));
    }

    if ((isResident() && current === "open") || ((isResident() || assigned(job)) && current === "booked")) {
      actions.unshift(actionButton(isResident() ? "取消案件" : "棄單", "cancel", job.id, "danger"));
    }
    if (canReview(job)) actions.push(actionButton("評價" + reviewTarget(job), "review", job.id, "primary"));
    const reviews = Object.entries(job.reviews ?? {});
    if (assigned(job) && ["booked", "picked"].includes(current)) {
      actions.push(actionButton("回報問題", "issue", job.id));
      actions.push(current === "booked"
        ? actionButton("標為已取件", "picked", job.id, "primary")
        : actionButton("標為已完成", "done", job.id, "primary"));
    }

    showModal(caseTitle(job), `
      ${badge(job)}
      <dl class="detail-grid">
        ${detail("取件區域", pickupAreaLabel(job))}
        ${detail("取件時段", windowLabel(job))}
        ${detail("垃圾袋數", `${job.bags} 袋`)}
        ${detail("搬運條件", `${job.floor}・${job.elevator}`)}
        ${bagSupply ? detail("專用垃圾袋", bagSupply, true) : ""}
        ${job.difficulty ? detail("搬運補充", job.difficulty, true) : ""}
        ${canSeeLocation ? detail("確切取件地點", job.address, true) : ""}
        ${canSeeLocation && job.note ? detail("交接說明", job.note, true) : ""}
        ${canSeeLocation && job.accepted && agreedContact ? detail(isResident() ? "代收者聯絡方式" : "住戶聯絡方式", agreedContact, true) : ""}
      </dl>
      ${canSeeLocation || current === "abandoned" ? "" : '<p class="notice">住戶選定你的報價後，這裡會顯示確切地點和交接說明。</p>'}
      ${job.issue ? `<p class="notice problem">問題回報｜${escapeHtml(job.issue)}</p>` : ""}
      ${quoteSection}
      ${reviews.length ? `<section class="review-list"><h3 class="offer-heading">服務評價</h3>${reviews.map(([author, review]) => `
        <div class="offer-row"><div><b>${people[author]}給${reviewTarget(job, author)}的評價</b>
          <p><span class="review-stars" aria-hidden="true">${"★".repeat(review.stars)}${"☆".repeat(5 - review.stars)}</span> ${review.stars}／5 顆星</p>
          ${review.comment ? `<p>${escapeHtml(review.comment)}</p>` : ""}
        </div></div>`).join("")}</section>` : ""}
      ${actions.length ? `<div class="modal-actions">${actions.join("")}</div>` : ""}`);
  }

  function showOffer(job) {
    const previous = job.offers.find((offer) => offer.collector === state.persona);
    const bagSupply = bagSupplyLabel(job);
    const bagCostHint = job.bagSupply === "collector" ? "。請將袋費納入報價總額。" : "";
    showModal(previous ? "修改報價" : "提出報價", `
      ${bagSupply ? `<p class="notice quote-bag-note">專用垃圾袋｜${escapeHtml(bagSupply)}${bagCostHint}</p>` : ""}
      <form data-form="offer" data-id="${job.id}">
        <div class="form-grid">
          <label>報價總額（新台幣）<input name="amount" type="number" min="1" max="100000" step="1" value="${previous?.amount ?? ""}" required data-initial-focus></label>
          <label>聯絡方式（選填）<input name="contact" maxlength="70" value="${escapeHtml(previous?.contact ?? collectors[state.persona])}"><small>成交後會提供給發單住戶。</small></label>
          <label class="full">報價說明（選填）<textarea name="note" maxlength="300" placeholder="例如：無電梯，需搬運兩袋。">${escapeHtml(previous?.note)}</textarea></label>
        </div>
        ${formButtons(previous ? "儲存報價" : "送出報價", actionButton("返回", "detail", job.id))}
      </form>`, "請使用虛構的聯絡方式。");
  }

  function confirm(title, body, label, data, job, danger = false) {
    showModal(title, `
      <p>${escapeHtml(body)}</p>
      <div class="modal-actions">
        ${job ? actionButton("返回", "detail", job.id) : actionButton("返回", "close")}
        ${actionButton(label, data.action, job?.id, danger ? "danger" : "primary", data.attributes || "")}
      </div>`);
  }

  function formError(form, message) {
    const error = form.querySelector(".form-error");
    error.textContent = message;
    error.hidden = false;
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form.dataset.form) return;
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    const messages = { new: "已發布代收需求", offer: "已儲存報價", issue: "已回報問題", review: "已送出評價" };
    save(form.dataset.form, messages[form.dataset.form], form.dataset.id, fields, undefined, form);
  });

  const simpleActions = {
    new() { if (isResident()) showNew(); },
    browse() { casesTitle.focus(); },
    close() { modal.close(); },
    filter(button) {
      filter = button.dataset.key;
      renderCases();
      addIcons(list);
      filters.querySelector(`[data-key="${filter}"]`).focus({ preventScroll: true });
    },
    "calendar-month"(button) {
      calendarMonth = new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() + Number(button.dataset.offset), 1));
      renderCalendar();
    },
    "calendar-today"() { calendarMonth = currentMonth(); renderCalendar(); },
    refresh() { refresh(); },
    "new-demo"() { refresh("resident", true); },
    share() {
      if (revision !== undefined) {
        showModal("示範連結", '<p>拿到連結的人都能操作這組虛構案件。</p><label>複製網址<input readonly value="' + escapeHtml(location.origin + location.pathname + "#demo=" + session) + '" data-initial-focus></label>');
        modal.querySelector("input").select();
      }
    },
    reset() {
      confirm("重設示範資料", "這會清除這組示範新增的案件、報價和評價。同一連結的其他裝置也會看到重設結果。", "重設資料", { action: "reset-confirm" }, null, true);
    },
    "reset-confirm"() {
      save("reset", "已還原示範資料");
    }
  };

  const jobActions = {
    detail(job) { showDetail(job); },
    review(job) { showReview(job); },
    offer(job) { if (!isResident() && stage(job) === "open") showOffer(job); },
    withdraw(job) {
      if (isResident() || stage(job) !== "open") return;
      save("withdraw", "已撤回報價", job.id);
    },
    choose(job, button) {
      if (!isResident() || stage(job) !== "open") return;
      const offer = currentOffer(job, button);
      if (!offer) return staleOffer(job);
      confirm("確認代收報價", `選定 ${people[offer.collector]} 的 ${price(offer.amount)} 報價後，取件地點與交接說明會提供給這位代收者。`, "確認成交", {
        action: "accept", attributes: ` data-offer="${offer.id}" data-revision="${offer.revision}"`
      }, job);
    },
    accept(job, button) {
      if (!isResident() || stage(job) !== "open") return staleOffer(job);
      const offer = currentOffer(job, button);
      if (!offer) return staleOffer(job);
      save("accept", "已確認代收者", job.id, undefined, { offerId: offer.id, offerRevision: offer.revision });
    },
    cancel(job) {
      if (!canCancel(job)) return;
      confirm(isResident() ? "取消代收案件" : "確認棄單", isResident() ? "取消後保留案件與成交紀錄。" : "棄單後保留紀錄，交接資訊將隱藏。住戶如有需要可重新發單。", isResident() ? "確認取消" : "確認棄單", { action: "cancel-confirm" }, job, true);
    },
    "cancel-confirm"(job) {
      if (!canCancel(job)) return;
      save("cancel-confirm", isResident() ? "案件已取消" : "已記錄棄單", job.id);
    },
    picked(job) {
      if (!assigned(job) || job.status !== "booked") return;
      save("picked", "已更新為已取件", job.id);
    },
    done(job) {
      if (!assigned(job) || job.status !== "picked") return;
      save("done", "代收已完成", job.id);
    },
    issue(job) {
      if (!assigned(job) || !["booked", "picked"].includes(job.status)) return;
      showModal("回報取件或處理問題", `
        <form data-form="issue" data-id="${job.id}">
          <div class="form-grid">
            <label class="full">問題說明<textarea name="reason" maxlength="300" required data-initial-focus>${escapeHtml(job.issue)}</textarea></label>
          </div>
          ${formButtons("送出回報", actionButton("返回", "detail", job.id))}
        </form>`, "住戶可以在案件詳情看到這則說明。");
    }
  };

  function currentOffer(job, button) {
    return job.offers.find((offer) => offer.id === button.dataset.offer && offer.revision === Number(button.dataset.revision));
  }

  function staleOffer(job) {
    showDetail(job);
    const body = modal.querySelector(".modal-body");
    body.insertAdjacentHTML("afterbegin", '<p class="notice problem" role="alert">報價或取件時段已變更，請查看目前的案件資訊。</p>');
  }

  function canCancel(job) {
    const current = stage(job);
    return (current === "open" && isResident()) || (current === "booked" && (isResident() || assigned(job)));
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || (busy && button.dataset.action !== "close")) return;
    const action = button.dataset.action;
    if (Object.hasOwn(simpleActions, action)) {
      simpleActions[action](button);
      return;
    }
    const job = state.jobs.find((item) => item.id === button.dataset.id);
    if (hasJobAccess(job) && Object.hasOwn(jobActions, action)) jobActions[action](job, button);
  });

  personaSelect.addEventListener("change", () => {
    filter = "all";
    refresh(personaSelect.value);
  });

  statisticsPeriod.addEventListener("change", renderStatistics);
  calendarFilters.addEventListener("change", renderCalendar);

  modal.addEventListener("close", () => {
    if (modalOrigin?.isConnected) modalOrigin.focus({ preventScroll: true });
    else casesTitle.focus({ preventScroll: true });
  });

  window.addEventListener("focus", () => {
    if (!modal.open && revision !== undefined) refresh();
  });
  window.addEventListener("hashchange", () => {
    const linkedSession = new URLSearchParams(location.hash.slice(1)).get("demo");
    if (linkedSession && linkedSession !== session) {
      location.reload();
    } else if (!linkedSession && session) {
      history.replaceState(null, "", "#demo=" + session);
    }
  });

  render();
  refresh();
})();
