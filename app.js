const supabaseUrl = "https://mpklydfhglclnebptjwv.supabase.co";
const supabaseKey = "sb_publishable_doUfmTRHBzXEMzGlBrmzNQ_1p495QJb";

const seedData = {
  people: ["elmo", "乃哥", "卡森", "施", "汪", "生哥", "秉樺", "芮瑜", "許", "高"],
  events: [
    makeEvent("7/2(四)", "18-20", "匹克球", 2500, "施", [
      ["施", "paid"],
      ["elmo", "paid"],
      ["生哥", "paid"],
      ["高", "paid"],
    ]),
    makeEvent("7/4(六)", "18-20", "匹克球", 1900, "卡森", [
      ["卡森", "paid"],
      ["許", "paid"],
      ["施", "paid"],
      ["elmo", "paid"],
      ["汪", "paid"],
    ]),
    makeEvent("7/9(四)", "18-20", "匹克球", 2200, "施", [
      ["施", "paid"],
      ["elmo", "paid"],
      ["高", "paid"],
      ["汪", "paid"],
      ["乃哥", "paid"],
    ]),
    makeEvent("7/26(日)", "18-20", "匹克球", 1900, "汪", [
      ["汪", "paid"],
      ["施", "paid"],
      ["elmo", "paid"],
      ["卡森", "paid"],
      ["乃哥", "unpaid"],
    ]),
    makeEvent("7/30(四)", "18-20", "匹克球", 2000, "施", [
      ["施", "paid"],
      ["高", "unpaid"],
      ["汪", "paid"],
      ["乃哥", "paid"],
    ]),
    makeEvent("7/13(一)", "18-19", "羽球", 350, "施", [
      ["施", "paid"],
      ["秉樺", "paid"],
      ["芮瑜", "paid"],
    ]),
    makeEvent("7/13(一)", "19-20", "羽球", 350, "elmo", [
      ["elmo", "paid"],
      ["生哥", "paid"],
    ]),
    makeEvent("7/27(一)", "18-20", "羽球", 700, "施", [
      ["施", "paid"],
      ["汪", "paid"],
      ["秉樺", "paid"],
      ["芮瑜", "paid"],
      ["elmo", "paid"],
    ]),
    makeEvent("8/3(一)", "18-19", "羽球", 350, "施", [
      ["施", "paid"],
      ["秉樺", "paid"],
      ["芮瑜", "paid"],
    ]),
    makeEvent("8/3(一)", "19-20", "羽球", 350, "elmo", [
      ["elmo", "paid"],
      ["生哥", "paid"],
    ]),
  ],
};

let state = { people: [], events: [] };
let db = null;

const elements = {
  totalEvents: document.querySelector("#totalEvents"),
  totalPeople: document.querySelector("#totalPeople"),
  openTransfers: document.querySelector("#openTransfers"),
  openAmount: document.querySelector("#openAmount"),
  settlementCount: document.querySelector("#settlementCount"),
  settlementList: document.querySelector("#settlementList"),
  eventForm: document.querySelector("#eventForm"),
  participantPicker: document.querySelector("#participantPicker"),
  participantTemplate: document.querySelector("#participantTemplate"),
  personForm: document.querySelector("#personForm"),
  peopleList: document.querySelector("#peopleList"),
  historyList: document.querySelector("#historyList"),
  sportFilter: document.querySelector("#sportFilter"),
  sportOptions: document.querySelector("#sportOptions"),
  resetDemoBtn: document.querySelector("#resetDemoBtn"),
  clearAllBtn: document.querySelector("#clearAllBtn"),
  tabButtons: document.querySelectorAll(".tab-button"),
  viewPanels: document.querySelectorAll(".view-panel"),
};

initApp();

elements.eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.eventForm);
  const participants = [...elements.participantPicker.querySelectorAll(".participant-row")]
    .map((row) => ({
      name: row.querySelector(".participant-check").dataset.name,
      checked: row.querySelector(".participant-check").checked,
      status: row.querySelector(".participant-status").value,
    }))
    .filter((person) => person.checked)
    .map((person) => ({
      name: person.name,
      status: person.name === form.get("payer") ? "paid" : person.status,
    }));

  const payer = String(form.get("payer"));
  if (!participants.some((person) => person.name === payer)) {
    participants.unshift({ name: payer, status: "paid" });
  }

  if (participants.length === 0) return;

  const newEvent = {
    date: normalizeDateInput(form.get("date")),
    time: clean(form.get("time")),
    sport: clean(form.get("sport")),
    total: Number(form.get("total")),
    payer,
    participants,
  };

  try {
    await upsertPeople(participants.map((person) => person.name).concat(payer));
    await insertEvent(newEvent);
    elements.eventForm.reset();
    await loadCloudData();
  } catch (error) {
    alert(`新增場次失敗：${error.message}`);
  }
});

elements.personForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = clean(new FormData(elements.personForm).get("name"));
  if (!name) return;

  try {
    await upsertPeople([name]);
    elements.personForm.reset();
    await loadCloudData();
  } catch (error) {
    alert(`新增人員失敗：${error.message}`);
  }
});

elements.sportFilter.addEventListener("change", renderHistory);

elements.resetDemoBtn?.addEventListener("click", async () => {
  if (!confirm("確定要把雲端資料還原成範例資料嗎？")) return;
  try {
    await clearCloudData();
    await seedCloudData();
    await loadCloudData();
  } catch (error) {
    alert(`還原範例失敗：${error.message}`);
  }
});

elements.clearAllBtn?.addEventListener("click", async () => {
  if (!confirm("確定要清空所有雲端人員與場次紀錄嗎？")) return;
  try {
    await clearCloudData();
    await loadCloudData();
  } catch (error) {
    alert(`清空資料失敗：${error.message}`);
  }
});

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

async function initApp() {
  renderLoading();
  try {
    db = window.supabase.createClient(supabaseUrl, supabaseKey);
    await loadCloudData();
    if (state.people.length === 0 && state.events.length === 0) {
      await seedCloudData();
      await loadCloudData();
    }
    subscribeToChanges();
  } catch (error) {
    renderError(`無法連線到共用資料庫：${error.message}`);
  }
}

function makeEvent(date, time, sport, total, payer, rows) {
  return {
    date,
    time,
    sport,
    total,
    payer,
    participants: rows.map(([name, status]) => ({ name, status })),
  };
}

async function loadCloudData() {
  const [{ data: peopleRows, error: peopleError }, { data: eventRows, error: eventsError }] = await Promise.all([
    db.from("people").select("name").order("name", { ascending: true }),
    db.from("events").select("id,date,time,sport,total,payer,participants,created_at").order("created_at", { ascending: false }),
  ]);

  if (peopleError) throw peopleError;
  if (eventsError) throw eventsError;

  state = {
    people: (peopleRows || []).map((row) => row.name),
    events: (eventRows || []).map(fromEventRow),
  };
  render();
}

async function upsertPeople(names) {
  const rows = [...new Set(names.map(clean).filter(Boolean))].map((name) => ({ name }));
  if (!rows.length) return;
  const { error } = await db.from("people").upsert(rows, { onConflict: "name", ignoreDuplicates: true });
  if (error) throw error;
}

async function insertEvent(event) {
  const { error } = await db.from("events").insert({
    date: event.date,
    time: event.time,
    sport: event.sport,
    total: event.total,
    payer: event.payer,
    participants: event.participants,
  });
  if (error) throw error;
}

async function updateEventParticipants(eventId, participants) {
  const { error } = await db.from("events").update({ participants }).eq("id", eventId);
  if (error) throw error;
}

async function deleteEvent(eventId) {
  const { error } = await db.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

async function deletePerson(name) {
  const { error } = await db.from("people").delete().eq("name", name);
  if (error) throw error;
}

async function clearCloudData() {
  const eventDelete = await db.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (eventDelete.error) throw eventDelete.error;
  const peopleDelete = await db.from("people").delete().neq("name", "__never__");
  if (peopleDelete.error) throw peopleDelete.error;
}

async function seedCloudData() {
  await upsertPeople(seedData.people);
  const rows = seedData.events.map((event) => ({
    date: event.date,
    time: event.time,
    sport: event.sport,
    total: event.total,
    payer: event.payer,
    participants: event.participants,
  }));
  const { error } = await db.from("events").insert(rows);
  if (error) throw error;
}

function subscribeToChanges() {
  db.channel("sports-splitter-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "people" }, () => loadCloudData())
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => loadCloudData())
    .subscribe();
}

function fromEventRow(row) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    sport: row.sport,
    total: Number(row.total || 0),
    payer: row.payer,
    participants: Array.isArray(row.participants) ? row.participants : [],
    createdAt: row.created_at,
  };
}

function renderLoading() {
  elements.settlementList.innerHTML = `<div class="empty-state">正在載入共用資料...</div>`;
  elements.peopleList.innerHTML = `<div class="empty-state">正在載入共用資料...</div>`;
  elements.historyList.innerHTML = `<div class="empty-state">正在載入共用資料...</div>`;
}

function renderError(message) {
  elements.settlementList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  elements.peopleList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  elements.historyList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function render() {
  renderControls();
  renderSettlement();
  renderPeople();
  renderHistory();
}

function showView(viewId) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
  elements.viewPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === viewId);
  });
}

function renderControls() {
  const payerSelect = elements.eventForm.elements.payer;
  payerSelect.innerHTML = state.people.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");

  elements.sportOptions.innerHTML = getSports()
    .map((sport) => `<option value="${escapeHtml(sport)}"></option>`)
    .join("");

  const selectedFilter = elements.sportFilter.value || "all";
  elements.sportFilter.innerHTML = `<option value="all">全部項目</option>${getSports()
    .map((sport) => `<option value="${escapeHtml(sport)}">${escapeHtml(sport)}</option>`)
    .join("")}`;
  elements.sportFilter.value = getSports().includes(selectedFilter) ? selectedFilter : "all";

  elements.participantPicker.innerHTML = "";
  state.people.forEach((name) => {
    const row = elements.participantTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = row.querySelector(".participant-check");
    checkbox.dataset.name = name;
    row.querySelector("span").textContent = name;
    elements.participantPicker.appendChild(row);
  });
}

function renderSettlement() {
  const transfers = calculateSettlement();
  const totalAmount = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);

  if (elements.totalEvents) elements.totalEvents.textContent = state.events.length;
  if (elements.totalPeople) elements.totalPeople.textContent = state.people.length;
  elements.openTransfers.textContent = transfers.length;
  elements.openAmount.textContent = money(totalAmount);
  elements.settlementCount.textContent = `${transfers.length} 筆`;

  if (!transfers.length) {
    elements.settlementList.innerHTML = `<div class="empty-state">目前沒有待付款項</div>`;
    return;
  }

  elements.settlementList.innerHTML = transfers
    .map(
      (transfer) => `
        <article class="transfer-card">
          <div>
            <div class="transfer-route">
              <span>${escapeHtml(transfer.from)}</span>
              <span class="arrow">→</span>
              <span>${escapeHtml(transfer.to)}</span>
            </div>
            <div class="event-meta">抵銷彼此互欠後的實際轉帳</div>
          </div>
          <div class="amount">${money(transfer.amount)}</div>
        </article>
      `,
    )
    .join("");
}

function renderPeople() {
  if (!state.people.length) {
    elements.peopleList.innerHTML = `<div class="empty-state">先新增常一起運動的人</div>`;
    return;
  }

  elements.peopleList.innerHTML = state.people
    .map(
      (name) => `
        <div class="person-chip">
          <span>${escapeHtml(name)}</span>
          <button type="button" data-remove-person="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}">×</button>
        </div>
      `,
    )
    .join("");

  elements.peopleList.querySelectorAll("[data-remove-person]").forEach((button) => {
    button.addEventListener("click", async () => {
      const name = button.dataset.removePerson;
      const isUsed = state.events.some((event) => event.payer === name || event.participants.some((person) => person.name === name));
      if (isUsed && !confirm(`${name} 已在場次紀錄中，移除後歷史紀錄仍會保留姓名。確定移除？`)) return;
      try {
        await deletePerson(name);
        await loadCloudData();
      } catch (error) {
        alert(`移除人員失敗：${error.message}`);
      }
    });
  });
}

function renderHistory() {
  const filter = elements.sportFilter.value || "all";
  const events = (filter === "all" ? state.events : state.events.filter((event) => event.sport === filter))
    .slice()
    .sort(compareEventsByRecentDate);

  if (!events.length) {
    elements.historyList.innerHTML = `<div class="empty-state">沒有符合的場次紀錄</div>`;
    return;
  }

  elements.historyList.innerHTML = events
    .map((event) => {
      const paidCount = event.participants.filter((person) => person.status === "paid").length;
      const unpaidCount = event.participants.length - paidCount;
      const sportType = getSportType(event.sport);
      return `
        <article class="event-card">
          <div class="event-main">
            <div class="event-title">
              <span class="event-date">${escapeHtml(formatEventDate(event.date))}</span>
              <span class="event-time">${escapeHtml(event.time)}</span>
              <span class="sport-tag ${sportType.className}"><span aria-hidden="true">${sportType.icon}</span>${escapeHtml(event.sport)}</span>
            </div>
            <div class="event-meta">
              總費用 ${money(event.total)} · ${event.participants.length} 人 · 每人 ${money(perPerson(event))} · 付款人 ${escapeHtml(event.payer)}
            </div>
          </div>
          <div class="event-status-summary">
            <span class="status-count paid">${paidCount} 已付款</span>
            <span class="status-count unpaid">${unpaidCount} 未付款</span>
          </div>
          <div class="participant-editor">
            ${event.participants
              .map(
                (person) => `
                  <label class="status-control ${person.status === "paid" ? "is-paid" : "is-unpaid"} ${person.name === event.payer ? "is-payer" : ""}">
                    <span>${escapeHtml(person.name)}</span>
                    <select data-event-id="${event.id}" data-person-name="${escapeHtml(person.name)}" ${person.name === event.payer ? "disabled" : ""}>
                      <option value="paid" ${person.status === "paid" ? "selected" : ""}>已付款</option>
                      <option value="unpaid" ${person.status === "unpaid" ? "selected" : ""}>未付款</option>
                    </select>
                  </label>
                `,
              )
              .join("")}
          </div>
          <div class="event-actions">
            <button type="button" data-remove-event="${event.id}">刪除</button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.historyList.querySelectorAll("[data-remove-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await deleteEvent(button.dataset.removeEvent);
        await loadCloudData();
      } catch (error) {
        alert(`刪除場次失敗：${error.message}`);
      }
    });
  });

  elements.historyList.querySelectorAll("[data-person-name]").forEach((select) => {
    select.addEventListener("change", async () => {
      const eventItem = state.events.find((event) => event.id === select.dataset.eventId);
      if (!eventItem) return;
      const participants = eventItem.participants.map((person) =>
        person.name === select.dataset.personName ? { ...person, status: select.value } : person,
      );
      try {
        await updateEventParticipants(eventItem.id, participants);
        await loadCloudData();
      } catch (error) {
        alert(`更新付款狀態失敗：${error.message}`);
      }
    });
  });
}

function getSportType(sport) {
  if (String(sport).includes("羽球")) return { className: "badminton", icon: "🏸" };
  if (String(sport).includes("匹克球")) return { className: "pickleball", icon: "◉" };
  return { className: "other-sport", icon: "•" };
}

function calculateSettlement() {
  const debts = new Map();
  state.events.forEach((event) => {
    const share = perPerson(event);
    event.participants
      .filter((person) => person.status === "unpaid" && person.name !== event.payer)
      .forEach((person) => {
        const key = `${person.name}|||${event.payer}`;
        debts.set(key, (debts.get(key) || 0) + share);
      });
  });

  const people = [...new Set(state.people.concat(state.events.flatMap((event) => [event.payer, ...event.participants.map((person) => person.name)])))];
  const transfers = [];

  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const a = people[i];
      const b = people[j];
      const aOwesB = debts.get(`${a}|||${b}`) || 0;
      const bOwesA = debts.get(`${b}|||${a}`) || 0;
      const diff = roundMoney(Math.abs(aOwesB - bOwesA));
      if (diff <= 0) continue;
      transfers.push(aOwesB > bOwesA ? { from: a, to: b, amount: diff } : { from: b, to: a, amount: diff });
    }
  }

  return transfers.sort((a, b) => b.amount - a.amount || a.from.localeCompare(b.from, "zh-Hant"));
}

function compareEventsByRecentDate(a, b) {
  const dateDiff = parseEventDate(b.date) - parseEventDate(a.date);
  if (dateDiff !== 0) return dateDiff;
  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

function parseEventDate(value) {
  const text = String(value || "");
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return Number(`${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`);

  const slashMatch = text.match(/(?:(\d{4})\s*[/-]\s*)?(\d{1,2})\s*[/-]\s*(\d{1,2})/);
  if (!slashMatch) return 0;
  const year = Number(slashMatch[1] || new Date().getFullYear());
  const month = Number(slashMatch[2]);
  const day = Number(slashMatch[3]);
  return Number(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`);
}

function normalizeDateInput(value) {
  const text = clean(value);
  const parsed = dateParts(text);
  if (!parsed) return text;
  return `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
}

function formatEventDate(value) {
  const parsed = dateParts(value);
  if (!parsed) return clean(value);
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `${parsed.year}/${String(parsed.month).padStart(2, "0")}/${String(parsed.day).padStart(2, "0")}（週${weekday}）`;
}

function dateParts(value) {
  const text = clean(value);
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
  }

  const slashMatch = text.match(/(?:(\d{4})\s*[/-]\s*)?(\d{1,2})\s*[/-]\s*(\d{1,2})/);
  if (!slashMatch) return null;
  return {
    year: Number(slashMatch[1] || new Date().getFullYear()),
    month: Number(slashMatch[2]),
    day: Number(slashMatch[3]),
  };
}

function perPerson(event) {
  if (!event.participants.length) return 0;
  return roundMoney(Number(event.total || 0) / event.participants.length);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return `$${roundMoney(value).toLocaleString("zh-Hant", { maximumFractionDigits: 2 })}`;
}

function getSports() {
  return [...new Set(state.events.map((event) => event.sport).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
