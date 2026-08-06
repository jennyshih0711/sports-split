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
let clockTimer = null;

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
    time: normalizeTimeRange(form.get("startTime"), form.get("endTime")),
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
    startClockRefresh();
  } catch (error) {
    renderError(`無法連線到共用資料庫：${error.message}`);
  }
}

function startClockRefresh() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(refreshTimeSensitiveViews, 60 * 1000);
  window.addEventListener("focus", refreshTimeSensitiveViews);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshTimeSensitiveViews();
  });
}

function refreshTimeSensitiveViews() {
  renderSettlement();
  if (!document.querySelector(".event-card.editing")) {
    renderHistory();
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

async function updateEvent(eventId, changes) {
  const { error } = await db.from("events").update(changes).eq("id", eventId);
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

async function renamePerson(oldName, newName) {
  const from = clean(oldName);
  const to = clean(newName);
  if (!from || !to || from === to) return;
  if (state.people.includes(to)) {
    throw new Error(`${to} 已存在，請使用不同名稱`);
  }

  const peopleUpdate = await db.from("people").update({ name: to }).eq("name", from);
  if (peopleUpdate.error) throw peopleUpdate.error;

  const affectedEvents = state.events
    .map((event) => {
      const payer = event.payer === from ? to : event.payer;
      const participants = event.participants.map((person) => (person.name === from ? { ...person, name: to } : person));
      const changed = payer !== event.payer || participants.some((person, index) => person.name !== event.participants[index].name);
      return changed ? { id: event.id, payer, participants } : null;
    })
    .filter(Boolean);

  const updates = await Promise.all(
    affectedEvents.map((event) => db.from("events").update({ payer: event.payer, participants: event.participants }).eq("id", event.id)),
  );
  const failedUpdate = updates.find((result) => result.error);
  if (failedUpdate) throw failedUpdate.error;
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

  fillHourSelect(elements.eventForm.elements.startTime, "18");
  fillHourSelect(elements.eventForm.elements.endTime, "20");

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

function fillHourSelect(select, fallbackHour) {
  if (!select) return;
  const selected = select.value || fallbackHour;
  select.innerHTML = hourOptions(selected);
}

function hourOptions(selectedHour) {
  const selected = Number(selectedHour);
  return Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour).padStart(2, "0");
    return `<option value="${value}" ${hour === selected ? "selected" : ""}>${hour}</option>`;
  }).join("");
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
            <div class="event-meta">全體抵銷後的最簡化轉帳</div>
          </div>
          <div class="amount">${money(transfer.amount)}</div>
          <details class="transfer-details">
            <summary>查看合併明細</summary>
            <p>此筆為全體淨額合併結果，可能不是單一場次的一對一付款。</p>
            <div class="detail-grid">
              <div>
                <h3>${escapeHtml(transfer.from)} 的未付款來源</h3>
                ${renderDetailList(transfer.fromDetails)}
              </div>
              <div>
                <h3>${escapeHtml(transfer.to)} 的代墊來源</h3>
                ${renderDetailList(transfer.toDetails)}
              </div>
            </div>
          </details>
        </article>
      `,
    )
    .join("");
}

function renderDetailList(items) {
  if (!items.length) return `<div class="detail-empty">沒有可列出的明細</div>`;
  return `
    <ul class="detail-list">
      ${items
        .map(
          (item) => `
            <li>
              <span>${escapeHtml(item.label)}</span>
              <strong>${money(item.amount)}</strong>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderPeople() {
  if (!state.people.length) {
    elements.peopleList.innerHTML = `<div class="empty-state">先新增常一起運動的人</div>`;
    return;
  }

  elements.peopleList.innerHTML = state.people
    .map(
      (name) => `
        <div class="person-chip" data-person-row="${escapeHtml(name)}">
          <span class="person-name">${escapeHtml(name)}</span>
          <input class="person-edit-input" value="${escapeHtml(name)}" data-person-input="${escapeHtml(name)}" aria-label="編輯 ${escapeHtml(name)}" hidden />
          <button class="edit-person-button" type="button" data-edit-person="${escapeHtml(name)}">編輯</button>
          <button class="save-person-button" type="button" data-save-person="${escapeHtml(name)}" hidden>儲存</button>
          <button class="cancel-person-button" type="button" data-cancel-person="${escapeHtml(name)}" hidden>取消</button>
          <button class="remove-person-button" type="button" data-remove-person="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}">刪除</button>
        </div>
      `,
    )
    .join("");

  elements.peopleList.querySelectorAll("[data-edit-person]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest(".person-chip");
      setPersonEditMode(row, true);
    });
  });

  elements.peopleList.querySelectorAll("[data-cancel-person]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest(".person-chip");
      const input = row?.querySelector("[data-person-input]");
      if (input) input.value = button.dataset.cancelPerson;
      setPersonEditMode(row, false);
    });
  });

  elements.peopleList.querySelectorAll("[data-save-person]").forEach((button) => {
    button.addEventListener("click", async () => {
      const oldName = button.dataset.savePerson;
      const input = button.closest(".person-chip")?.querySelector("[data-person-input]");
      const newName = clean(input?.value);
      if (!newName) {
        alert("姓名不能空白");
        return;
      }
      if (newName === oldName) return;
      try {
        button.disabled = true;
        await renamePerson(oldName, newName);
        await loadCloudData();
      } catch (error) {
        alert(`更新姓名失敗：${error.message}`);
        button.disabled = false;
      }
    });
  });

  elements.peopleList.querySelectorAll("[data-person-input]").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const button = input.closest(".person-chip")?.querySelector("[data-save-person]");
      button?.click();
    });
  });

  elements.peopleList.querySelectorAll("[data-remove-person]").forEach((button) => {
    button.addEventListener("click", async () => {
      const name = button.dataset.removePerson;
      const isUsed = state.events.some((event) => event.payer === name || event.participants.some((person) => person.name === name));
      const message = isUsed ? `${name} 已在場次紀錄中，刪除後歷史紀錄仍會保留姓名。確定要刪除嗎？` : "確定要刪除嗎？";
      if (!confirm(message)) return;
      try {
        await deletePerson(name);
        await loadCloudData();
      } catch (error) {
        alert(`移除人員失敗：${error.message}`);
      }
    });
  });
}

function setPersonEditMode(row, isEditing) {
  if (!row) return;
  row.classList.toggle("editing", isEditing);
  row.querySelector(".person-name").hidden = isEditing;
  row.querySelector(".person-edit-input").hidden = !isEditing;
  row.querySelector(".edit-person-button").hidden = isEditing;
  row.querySelector(".save-person-button").hidden = !isEditing;
  row.querySelector(".cancel-person-button").hidden = !isEditing;
  if (isEditing) row.querySelector(".person-edit-input").focus();
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
      const editorPeople = [...new Set(state.people.concat(event.payer, event.participants.map((person) => person.name)).filter(Boolean))];
      const isUpcoming = !isCompletedEvent(event);
      return `
        <article class="event-card ${isUpcoming ? "is-upcoming" : ""}" data-event-row="${event.id}">
          <div class="event-view">
            <div class="event-flag">
              ${isUpcoming ? `<span class="upcoming-tag">時間未到</span>` : ""}
            </div>
            <div class="event-main">
              <div class="event-title">
                <span class="event-date">${escapeHtml(formatEventDate(event.date))}</span>
                <span class="event-time">${escapeHtml(formatEventTime(event.time))}</span>
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
              <button class="edit-event-button" type="button" data-edit-event="${event.id}">編輯</button>
              <button type="button" data-remove-event="${event.id}">刪除</button>
            </div>
          </div>
          <div class="event-edit-panel" hidden>
            <div class="event-edit-fields">
              <label>日期<input type="date" data-edit-date value="${escapeHtml(normalizeDateInput(event.date))}" /></label>
              <label>開始時間<select data-edit-start-time>${hourOptions(timeRangeParts(event.time).startHour ?? 18)}</select></label>
              <label>結束時間<select data-edit-end-time>${hourOptions(timeRangeParts(event.time).endHour ?? 20)}</select></label>
              <label>項目<input data-edit-sport list="sportOptions" value="${escapeHtml(event.sport)}" /></label>
              <label>費用總計<input type="number" min="0" step="1" data-edit-total value="${escapeHtml(event.total)}" /></label>
              <label>付款人
                <select data-edit-payer>
                  ${editorPeople.map((name) => `<option value="${escapeHtml(name)}" ${name === event.payer ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
                </select>
              </label>
            </div>
            <div class="row-title">參加者與付款狀態</div>
            <div class="event-edit-participants">
              ${editorPeople
                .map((name) => {
                  const participant = event.participants.find((person) => person.name === name);
                  const checked = Boolean(participant);
                  const status = participant?.status || "unpaid";
                  return `
                    <div class="participant-row">
                      <label class="check-label">
                        <input type="checkbox" data-edit-participant="${escapeHtml(name)}" ${checked ? "checked" : ""} />
                        <span>${escapeHtml(name)}</span>
                      </label>
                      <select data-edit-status="${escapeHtml(name)}">
                        <option value="unpaid" ${status === "unpaid" ? "selected" : ""}>未付款</option>
                        <option value="paid" ${status === "paid" ? "selected" : ""}>已付款</option>
                      </select>
                    </div>
                  `;
                })
                .join("")}
            </div>
            <div class="event-edit-actions">
              <button class="save-event-button" type="button" data-save-event="${event.id}">儲存</button>
              <button class="cancel-event-button" type="button" data-cancel-event="${event.id}">取消</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  elements.historyList.querySelectorAll("[data-edit-event]").forEach((button) => {
    button.addEventListener("click", () => {
      setEventEditMode(button.closest(".event-card"), true);
    });
  });

  elements.historyList.querySelectorAll("[data-cancel-event]").forEach((button) => {
    button.addEventListener("click", () => {
      setEventEditMode(button.closest(".event-card"), false);
    });
  });

  elements.historyList.querySelectorAll("[data-edit-payer]").forEach((select) => {
    select.addEventListener("change", () => {
      const row = select.closest(".event-card");
      const checkbox = [...(row?.querySelectorAll("[data-edit-participant]") || [])].find((item) => item.dataset.editParticipant === select.value);
      const status = [...(row?.querySelectorAll("[data-edit-status]") || [])].find((item) => item.dataset.editStatus === select.value);
      if (checkbox) checkbox.checked = true;
      if (status) status.value = "paid";
    });
  });

  elements.historyList.querySelectorAll("[data-save-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest(".event-card");
      const payer = clean(row.querySelector("[data-edit-payer]")?.value);
      const participants = [...row.querySelectorAll("[data-edit-participant]")]
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => {
          const name = checkbox.dataset.editParticipant;
          const status = [...row.querySelectorAll("[data-edit-status]")].find((item) => item.dataset.editStatus === name)?.value || "unpaid";
          return { name, status: name === payer ? "paid" : status };
        });

      if (payer && !participants.some((person) => person.name === payer)) {
        participants.unshift({ name: payer, status: "paid" });
      }
      if (!participants.length) {
        alert("至少要選擇一位參加者");
        return;
      }

      const changes = {
        date: normalizeDateInput(row.querySelector("[data-edit-date]")?.value),
        time: normalizeTimeRange(row.querySelector("[data-edit-start-time]")?.value, row.querySelector("[data-edit-end-time]")?.value),
        sport: clean(row.querySelector("[data-edit-sport]")?.value),
        total: Number(row.querySelector("[data-edit-total]")?.value || 0),
        payer,
        participants,
      };
      if (!changes.date || !changes.time || !changes.sport || !changes.payer) {
        alert("日期、開始時間、結束時間、項目和付款人都要填寫");
        return;
      }

      try {
        button.disabled = true;
        await updateEvent(button.dataset.saveEvent, changes);
        await loadCloudData();
      } catch (error) {
        alert(`更新場次失敗：${error.message}`);
        button.disabled = false;
      }
    });
  });

  elements.historyList.querySelectorAll("[data-remove-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("確定要刪除嗎？")) return;
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

function setEventEditMode(row, isEditing) {
  if (!row) return;
  row.classList.toggle("editing", isEditing);
  row.querySelector(".event-view").hidden = isEditing;
  row.querySelector(".event-edit-panel").hidden = !isEditing;
}

function getSportType(sport) {
  if (String(sport).includes("羽球")) return { className: "badminton", icon: "🏸" };
  if (String(sport).includes("匹克球")) return { className: "pickleball", icon: "◉" };
  return { className: "other-sport", icon: "•" };
}

function calculateSettlement() {
  const balances = new Map();
  const payerEntries = new Map();
  const receiverEntries = new Map();
  state.events.filter(isCompletedEvent).forEach((event) => {
    const share = perPerson(event);
    event.participants
      .filter((person) => person.status === "unpaid" && person.name !== event.payer)
      .forEach((person) => {
        balances.set(person.name, roundMoney((balances.get(person.name) || 0) - share));
        balances.set(event.payer, roundMoney((balances.get(event.payer) || 0) + share));
        addDetailEntry(payerEntries, person.name, {
          amount: share,
          label: `${formatEventDate(event.date)} ${formatEventTime(event.time)} ${event.sport}，原付款人 ${event.payer}`,
        });
        addDetailEntry(receiverEntries, event.payer, {
          amount: share,
          label: `${formatEventDate(event.date)} ${formatEventTime(event.time)} ${event.sport}，${person.name} 未付款`,
        });
      });
  });

  const payers = [];
  const receivers = [];
  balances.forEach((amount, name) => {
    const rounded = roundMoney(amount);
    if (rounded < 0) payers.push({ name, amount: Math.abs(rounded), entries: cloneDetailEntries(payerEntries.get(name) || []) });
    if (rounded > 0) receivers.push({ name, amount: rounded, entries: cloneDetailEntries(receiverEntries.get(name) || []) });
  });

  payers.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "zh-Hant"));
  receivers.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "zh-Hant"));

  const transfers = [];
  let payerIndex = 0;
  let receiverIndex = 0;

  while (payerIndex < payers.length && receiverIndex < receivers.length) {
    const payer = payers[payerIndex];
    const receiver = receivers[receiverIndex];
    const amount = roundMoney(Math.min(payer.amount, receiver.amount));

    if (amount > 0) {
      transfers.push({
        from: payer.name,
        to: receiver.name,
        amount,
        fromDetails: consumeDetailEntries(payer.entries, amount),
        toDetails: consumeDetailEntries(receiver.entries, amount),
      });
      payer.amount = roundMoney(payer.amount - amount);
      receiver.amount = roundMoney(receiver.amount - amount);
    }

    if (payer.amount <= 0) payerIndex += 1;
    if (receiver.amount <= 0) receiverIndex += 1;
  }

  return transfers;
}

function addDetailEntry(map, name, entry) {
  if (!map.has(name)) map.set(name, []);
  map.get(name).push({ ...entry, remaining: entry.amount });
}

function cloneDetailEntries(entries) {
  return entries.map((entry) => ({ ...entry, remaining: entry.amount }));
}

function consumeDetailEntries(entries, targetAmount) {
  let remainingTarget = roundMoney(targetAmount);
  const consumed = [];

  for (const entry of entries) {
    if (remainingTarget <= 0) break;
    if (entry.remaining <= 0) continue;

    const amount = roundMoney(Math.min(entry.remaining, remainingTarget));
    if (amount <= 0) continue;

    consumed.push({ label: entry.label, amount });
    entry.remaining = roundMoney(entry.remaining - amount);
    remainingTarget = roundMoney(remainingTarget - amount);
  }

  return consumed;
}

function compareEventsByRecentDate(a, b) {
  const dateDiff = parseEventDate(b.date) - parseEventDate(a.date);
  if (dateDiff !== 0) return dateDiff;
  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

function isCompletedEvent(event) {
  const eventDate = parseEventDate(event.date);
  if (!eventDate) return true;
  const today = todayNumber();
  if (eventDate < today) return true;
  if (eventDate > today) return false;

  const endMinutes = timeRangeParts(event.time).endMinutes;
  if (endMinutes == null) return true;
  return currentMinutes() >= endMinutes;
}

function todayNumber() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return Number(`${year}${month}${day}`);
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
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

function normalizeTimeRange(start, end) {
  const startText = normalizeTime(start);
  const endText = normalizeTime(end);
  if (!startText || !endText) return "";
  return `${startText}-${endText}`;
}

function normalizeTime(value) {
  const text = clean(value);
  const match = text.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return text;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  return String(hour).padStart(2, "0");
}

function formatEventTime(value) {
  const range = timeRangeParts(value);
  if (range.start && range.end) return `${Number(range.start)}-${Number(range.end)}`;
  return clean(value);
}

function timeRangeParts(value) {
  const text = clean(value);
  const parts = text.match(/(\d{1,2})(?::?(\d{2}))?\s*[-~–—到至]\s*(\d{1,2})(?::?(\d{2}))?/);
  if (!parts) return { start: "", end: "", startHour: null, endHour: null, startMinutes: null, endMinutes: null };

  const start = normalizeTime(parts[1]);
  const end = normalizeTime(parts[3]);
  return {
    start,
    end,
    startHour: Number(start),
    endHour: Number(end),
    startMinutes: timeToMinutes(start),
    endMinutes: timeToMinutes(end),
  };
}

function timeToMinutes(value) {
  const match = clean(value).match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2] || 0);
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
