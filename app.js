const supabaseUrl = "https://mpklydfhglclnebptjwv.supabase.co";
const supabaseKey = "sb_publishable_doUfmTRHBzXEMzGlBrmzNQ_1p495QJb";
const PENDING_PAYER = "待確認";
const SETTLEMENT_BATCH_OPEN = "open";
const SETTLEMENT_BATCH_COMPLETED = "completed";
const PAYMENT_HISTORY_PAGE_SIZE = 20;
const calendarInviteWebhookUrl = "https://script.google.com/macros/s/AKfycbyIAmaN4JA1CUropSrBlRhdVfH-Xu8VCE5mULFk5GMy9eEgROCexuTODdxVMZA9vlaoTA/exec";
const calendarInviteToken = "sports-split-calendar-invite-v1";
const calendarOwnerEmail = "jennyshih@geosense.tw";

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

let state = {
  people: [],
  events: [],
  paymentHistory: [],
  settlementBatches: [],
  activeSettlementBatch: null,
  paymentHistoryError: "",
  settlementBatchError: "",
};
let db = null;
let clockTimer = null;
let calendarMonth = monthStart(new Date());
let selectedCalendarDate = dateKey(new Date());
let paymentHistoryPage = 1;
let selectedSettlementEventIds = new Set();

const elements = {
  totalEvents: document.querySelector("#totalEvents"),
  totalPeople: document.querySelector("#totalPeople"),
  appNotice: document.querySelector("#appNotice"),
  openTransfers: document.querySelector("#openTransfers"),
  openAmount: document.querySelector("#openAmount"),
  settlementCount: document.querySelector("#settlementCount"),
  settlementList: document.querySelector("#settlementList"),
  paymentHistoryList: document.querySelector("#paymentHistoryList"),
  eventForm: document.querySelector("#eventForm"),
  participantPicker: document.querySelector("#participantPicker"),
  participantTemplate: document.querySelector("#participantTemplate"),
  personForm: document.querySelector("#personForm"),
  peopleList: document.querySelector("#peopleList"),
  historyList: document.querySelector("#historyList"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarDayDetails: document.querySelector("#calendarDayDetails"),
  prevMonthBtn: document.querySelector("#prevMonthBtn"),
  todayMonthBtn: document.querySelector("#todayMonthBtn"),
  nextMonthBtn: document.querySelector("#nextMonthBtn"),
  eventModal: document.querySelector("#eventModal"),
  eventModalBusy: document.querySelector("#eventModalBusy"),
  openEventModalBtn: document.querySelector("#openEventModalBtn"),
  closeEventModalBtn: document.querySelector("#closeEventModalBtn"),
  cancelEventModalBtn: document.querySelector("#cancelEventModalBtn"),
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
  if (!isPendingPayer(payer) && !participants.some((person) => person.name === payer)) {
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
    setEventFormBusy(true);
    await upsertPeople(participants.map((person) => person.name).concat(isPendingPayer(payer) ? [] : payer));
    await insertEvent(newEvent);
    const inviteResult = await sendCalendarInvite(newEvent);
    elements.eventForm.reset();
    closeEventModal();
    await loadCloudData();
    showCalendarInviteResult(inviteResult);
  } catch (error) {
    alert(`新增場次失敗：${error.message}`);
  } finally {
    setEventFormBusy(false);
  }
});

elements.personForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.personForm);
  const name = clean(form.get("name"));
  const email = clean(form.get("email"));
  if (!name) return;

  try {
    await upsertPeople([{ name, email }]);
    elements.personForm.reset();
    await loadCloudData();
  } catch (error) {
    alert(`新增人員失敗：${error.message}`);
  }
});

elements.sportFilter.addEventListener("change", renderHistory);

elements.openEventModalBtn?.addEventListener("click", openEventModal);
elements.closeEventModalBtn?.addEventListener("click", closeEventModal);
elements.cancelEventModalBtn?.addEventListener("click", closeEventModal);
elements.eventModal?.addEventListener("click", (event) => {
  if (event.target === elements.eventModal) closeEventModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.eventModal && !elements.eventModal.hidden) {
    closeEventModal();
  }
});

elements.prevMonthBtn?.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  selectedCalendarDate = "";
  renderCalendar();
});

elements.todayMonthBtn?.addEventListener("click", () => {
  const today = new Date();
  calendarMonth = monthStart(today);
  selectedCalendarDate = dateKey(today);
  renderCalendar();
});

elements.nextMonthBtn?.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  selectedCalendarDate = "";
  renderCalendar();
});

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
  const [
    { data: peopleRows, error: peopleError },
    { data: eventRows, error: eventsError },
    { data: paymentRows, error: paymentsError },
    { data: batchRows, error: batchError },
  ] = await Promise.all([
    db.from("people").select("name,email").order("name", { ascending: true }),
    db.from("events").select("id,date,time,sport,total,payer,participants,created_at").order("created_at", { ascending: false }),
    db
      .from("settlement_payments")
      .select("id,from_person,to_person,amount,details,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("settlement_batches")
      .select("*")
      .eq("status", SETTLEMENT_BATCH_OPEN)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (peopleError) throw peopleError;
  if (eventsError) throw eventsError;

  state = {
    people: (peopleRows || []).map((row) => ({ name: row.name, email: row.email || "" })),
    events: (eventRows || []).map(fromEventRow),
    paymentHistory: paymentsError ? [] : (paymentRows || []).map(fromPaymentRow),
    settlementBatches: batchError ? [] : (batchRows || []).map(fromSettlementBatchRow),
    activeSettlementBatch: batchError ? null : (batchRows || []).map(fromSettlementBatchRow)[0] || null,
    paymentHistoryError: paymentsError ? paymentsError.message : "",
    settlementBatchError: batchError ? batchError.message : "",
  };
  render();
}

async function upsertPeople(people) {
  const rowsByName = new Map();
  people.forEach((person) => {
    const item = typeof person === "string" ? { name: person, email: "" } : person;
    const name = clean(item.name);
    if (!name) return;
    rowsByName.set(name, { name, email: clean(item.email) });
  });
  const rows = [...rowsByName.values()];
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

async function sendCalendarInvite(event, attendeeRows = null, action = "invite") {
  if (!calendarInviteWebhookUrl) return { status: "disabled" };

  const inviteRows =
    attendeeRows ||
    event.participants.map((participant) => {
      const person = state.people.find((item) => item.name === participant.name);
      return {
        name: participant.name,
        email: clean(person?.email),
      };
    });
  const attendees = inviteRows.filter((person) => person.email);
  const skipped = inviteRows.filter((person) => !person.email).map((person) => person.name);

  if (!attendees.length) return { status: "skipped", skipped };

  const payload = {
    token: calendarInviteToken,
    ownerEmail: calendarOwnerEmail,
    action,
    event: {
      date: event.date,
      time: event.time,
      sport: event.sport,
      total: event.total,
      payer: event.payer,
      participants: event.participants.map((participant) => participant.name),
      attendees,
    },
  };

  try {
    await fetch(calendarInviteWebhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
    return { status: "sent", count: attendees.length, skipped };
  } catch (error) {
    console.warn("Calendar invite request failed", error);
    return { status: "failed", message: error.message, skipped };
  }
}

async function sendAddedParticipantInvites(event, addedNames) {
  const attendeeRows = addedNames.map((name) => {
    const person = state.people.find((item) => item.name === name);
    return {
      name,
      email: clean(person?.email),
    };
  });

  return sendCalendarInvite(event, attendeeRows, "addGuests");
}

function showAddedParticipantInviteResult(result, addedNames) {
  if (!addedNames.length || !result || result.status === "disabled") return;
  if (result.status === "sent") {
    const skippedText = result.skipped.length ? `，未設定 Email 略過：${result.skipped.join("、")}` : "";
    showNotice(`場次已更新，已補寄邀請給新增參加者 ${result.count} 人${skippedText}`, "success");
    return;
  }
  if (result.status === "skipped") {
    showNotice(`場次已更新；新增參加者沒有可補寄的 Email。略過：${result.skipped.join("、")}`, "warning");
    return;
  }
  if (result.status === "failed") {
    showNotice(`場次已更新，但新增參加者邀請補寄失敗：${result.message}`, "warning");
  }
}

async function cancelCalendarInvite(event) {
  if (!calendarInviteWebhookUrl) return { status: "disabled" };

  const payload = {
    token: calendarInviteToken,
    ownerEmail: calendarOwnerEmail,
    action: "cancel",
    event: {
      date: event.date,
      time: event.time,
      sport: event.sport,
      total: event.total,
      payer: event.payer,
      participants: event.participants.map((participant) => participant.name),
    },
  };

  try {
    await fetch(calendarInviteWebhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
    return { status: "sent" };
  } catch (error) {
    console.warn("Calendar cancel request failed", error);
    return { status: "failed", message: error.message };
  }
}

function showCalendarCancelResult(result) {
  if (!result || result.status === "disabled") return;
  if (result.status === "sent") {
    showNotice("場次已刪除，並已送出行事曆取消請求。", "success");
    return;
  }
  if (result.status === "failed") {
    showNotice(`場次已刪除，但行事曆取消請求失敗：${result.message}`, "warning");
  }
}

function showCalendarInviteResult(result) {
  if (!result || result.status === "disabled") return;
  if (result.status === "sent") {
    const skippedText = result.skipped.length ? `，未設定 Email 略過：${result.skipped.join("、")}` : "";
    showNotice(`已送出行事曆邀請給 ${result.count} 人${skippedText}`, "success");
    alert(`已送出行事曆邀請給 ${result.count} 人${skippedText}`);
    return;
  }
  if (result.status === "skipped") {
    showNotice(`這次沒有送出行事曆邀請，因為參加者都沒有設定 Email。略過：${result.skipped.join("、")}`, "warning");
    alert(`這次沒有送出行事曆邀請，因為參加者都沒有設定 Email。略過：${result.skipped.join("、")}`);
    return;
  }
  if (result.status === "failed") {
    showNotice(`場次已新增，但行事曆邀請送出失敗：${result.message}`, "error");
    alert(`場次已新增，但行事曆邀請送出失敗：${result.message}`);
  }
}

function showNotice(message, type = "info") {
  if (!elements.appNotice) return;
  elements.appNotice.textContent = message;
  elements.appNotice.className = `app-notice ${type}`;
  elements.appNotice.hidden = false;
}

async function updateEventParticipants(eventId, participants) {
  const { error } = await db.from("events").update({ participants }).eq("id", eventId);
  if (error) throw error;
}

async function insertSettlementPayment(transfer) {
  const { error } = await db.from("settlement_payments").insert(paymentRowFromTransfer(transfer));
  if (error) throw error;
}

async function insertSettlementPayments(transfers) {
  const rows = transfers.map(paymentRowFromTransfer);
  if (!rows.length) return;
  const { error } = await db.from("settlement_payments").insert(rows);
  if (error) throw error;
}

async function createSettlementBatch(transfers, sourceEventIds, excludedDetailKeys = new Set()) {
  const rows = normalizeTransfersForStorage(transfers);
  const { error } = await db.from("settlement_batches").insert({
    status: SETTLEMENT_BATCH_OPEN,
    transfers: rows,
    paid_transfer_ids: [],
    source_detail_keys: [...collectSettlementDetailKeys(excludedDetailKeys, sourceEventIds)],
    source_event_ids: [...sourceEventIds],
  });
  if (error) throw error;
}

async function updateSettlementBatchPaidIds(batchId, paidIds) {
  const { error } = await db.from("settlement_batches").update({ paid_transfer_ids: paidIds }).eq("id", batchId);
  if (error) throw error;
}

async function completeSettlementBatch(batch) {
  const transfers = normalizeTransfersForStorage(batch.transfers);
  if (!transfers.length) throw new Error("這個付款批次沒有可結清的轉帳");

  await insertSettlementPayments(transfers);
  if (Array.isArray(batch.sourceDetailKeys) && batch.sourceDetailKeys.length) {
    await markSettlementDetailKeysPaid(batch.sourceDetailKeys);
  } else {
    await markTransfersDetailsPaid(transfers);
  }

  const { error } = await db
    .from("settlement_batches")
    .update({
      status: SETTLEMENT_BATCH_COMPLETED,
      paid_transfer_ids: transfers.map((transfer) => transfer.id),
      finalized_at: new Date().toISOString(),
    })
    .eq("id", batch.id);
  if (error) throw error;
}

async function voidSettlementBatch(batchId) {
  const { error } = await db
    .from("settlement_batches")
    .update({ status: "voided", finalized_at: new Date().toISOString() })
    .eq("id", batchId);
  if (error) throw error;
}

function paymentRowFromTransfer(transfer) {
  return {
    from_person: transfer.from,
    to_person: transfer.to,
    amount: transfer.amount,
    details: {
      fromDetails: transfer.fromDetails,
      toDetails: transfer.toDetails,
    },
  };
}

function normalizeTransfersForStorage(transfers) {
  return transfers.map((transfer, index) => ({
    id: transfer.id || `${transfer.from}->${transfer.to}-${index}`,
    from: transfer.from,
    to: transfer.to,
    amount: Number(transfer.amount || 0),
    fromDetails: Array.isArray(transfer.fromDetails) ? transfer.fromDetails : [],
    toDetails: Array.isArray(transfer.toDetails) ? transfer.toDetails : [],
  }));
}

function batchDetailKeys(batch) {
  if (Array.isArray(batch)) {
    const keys = new Set();
    batch.forEach((item) => {
      batchDetailKeys(item).forEach((key) => keys.add(key));
    });
    return keys;
  }

  if (Array.isArray(batch?.sourceDetailKeys) && batch.sourceDetailKeys.length) {
    return new Set(batch.sourceDetailKeys);
  }

  const keys = new Set();
  (batch?.transfers || []).forEach((transfer) => {
    [...(transfer.fromDetails || []), ...(transfer.toDetails || [])].forEach((detail) => {
      const key = settlementDetailKey(detail.eventId, detail.personName);
      if (key) keys.add(key);
    });
  });
  return keys;
}

function settlementDetailKey(eventId, personName) {
  if (!eventId || !personName) return "";
  return `${eventId}::${personName}`;
}

function collectSettlementDetailKeys(excludedDetailKeys = new Set(), includedEventIds = null) {
  const keys = new Set();
  state.events.filter((event) => isSettlementEventIncluded(event, includedEventIds)).forEach((event) => {
    event.participants
      .filter((person) => person.status === "unpaid" && person.name !== event.payer)
      .forEach((person) => {
        const key = settlementDetailKey(event.id, person.name);
        if (key && !excludedDetailKeys.has(key)) keys.add(key);
      });
  });
  return keys;
}

function hasUnlockedSettlementDetails(event, excludedDetailKeys = new Set()) {
  return event.participants.some((person) => {
    if (person.status !== "unpaid" || person.name === event.payer) return false;
    return !excludedDetailKeys.has(settlementDetailKey(event.id, person.name));
  });
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

async function updatePerson(oldName, newName, email) {
  const from = clean(oldName);
  const to = clean(newName);
  const newEmail = clean(email);
  const oldPerson = state.people.find((person) => person.name === from);
  const shouldSendSupplementalInvites = Boolean(newEmail) && clean(oldPerson?.email) !== newEmail;
  if (!from || !to) return;
  if (from !== to && personNames().includes(to)) {
    throw new Error(`${to} 已存在，請使用不同名稱`);
  }

  const peopleUpdate = await db.from("people").update({ name: to, email: newEmail }).eq("name", from);
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

  if (!shouldSendSupplementalInvites) return { supplementalInvites: { status: "unchanged" } };
  const eventsForInvite = state.events.map((event) => ({
    ...event,
    payer: event.payer === from ? to : event.payer,
    participants: event.participants.map((person) => (person.name === from ? { ...person, name: to } : person)),
  }));
  return { supplementalInvites: await sendSupplementalCalendarInvites(eventsForInvite, to, newEmail) };
}

async function sendSupplementalCalendarInvites(events, personName, email) {
  const targetEvents = events.filter(
    (event) => !isCompletedEvent(event) && event.participants.some((participant) => participant.name === personName),
  );

  if (!targetEvents.length) return { status: "none" };

  const results = await Promise.all(targetEvents.map((event) => sendCalendarInvite(event, [{ name: personName, email }], "addGuests")));
  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.filter((result) => result.status === "failed");

  if (failed.length) {
    return {
      status: sent ? "partial" : "failed",
      sent,
      total: targetEvents.length,
      message: failed.map((result) => result.message).filter(Boolean).join("、"),
    };
  }

  return { status: "sent", sent, total: targetEvents.length };
}

function showSupplementalInviteResult(result, personName) {
  if (!result || result.status === "unchanged") return;
  if (result.status === "none") {
    showNotice(`${personName} 的 Email 已更新；沒有需要補寄的未來場次。`, "success");
    return;
  }
  if (result.status === "sent") {
    showNotice(`${personName} 的 Email 已更新，並已補寄 ${result.sent} 場未來場次邀請。`, "success");
    alert(`${personName} 的 Email 已更新，並已補寄 ${result.sent} 場未來場次邀請。`);
    return;
  }
  if (result.status === "partial") {
    showNotice(`${personName} 的 Email 已更新，已補寄 ${result.sent}/${result.total} 場；部分邀請失敗：${result.message}`, "warning");
    alert(`${personName} 的 Email 已更新，已補寄 ${result.sent}/${result.total} 場；部分邀請失敗：${result.message}`);
    return;
  }
  if (result.status === "failed") {
    showNotice(`${personName} 的 Email 已更新，但補寄行事曆邀請失敗：${result.message}`, "error");
    alert(`${personName} 的 Email 已更新，但補寄行事曆邀請失敗：${result.message}`);
  }
}

async function clearCloudData() {
  const eventDelete = await db.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (eventDelete.error) throw eventDelete.error;
  const peopleDelete = await db.from("people").delete().neq("name", "__never__");
  if (peopleDelete.error) throw peopleDelete.error;
  const paymentDelete = await db.from("settlement_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (paymentDelete.error) throw paymentDelete.error;
  const batchDelete = await db.from("settlement_batches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (batchDelete.error) throw batchDelete.error;
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
    .on("postgres_changes", { event: "*", schema: "public", table: "settlement_payments" }, () => loadCloudData())
    .on("postgres_changes", { event: "*", schema: "public", table: "settlement_batches" }, () => loadCloudData())
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

function fromPaymentRow(row) {
  const details = row.details || {};
  return {
    id: row.id,
    from: row.from_person,
    to: row.to_person,
    amount: Number(row.amount || 0),
    fromDetails: Array.isArray(details.fromDetails) ? details.fromDetails : [],
    toDetails: Array.isArray(details.toDetails) ? details.toDetails : [],
    createdAt: row.created_at,
  };
}

function fromSettlementBatchRow(row) {
  return {
    id: row.id,
    status: row.status,
    transfers: normalizeTransfersForStorage(Array.isArray(row.transfers) ? row.transfers : []),
    paidTransferIds: Array.isArray(row.paid_transfer_ids) ? row.paid_transfer_ids : [],
    sourceDetailKeys: Array.isArray(row.source_detail_keys) ? row.source_detail_keys : [],
    sourceEventIds: Array.isArray(row.source_event_ids) ? row.source_event_ids : [],
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
  };
}

function renderLoading() {
  elements.settlementList.innerHTML = `<div class="empty-state">正在載入共用資料...</div>`;
  if (elements.paymentHistoryList) elements.paymentHistoryList.innerHTML = `<div class="empty-state">正在載入付款紀錄...</div>`;
  elements.peopleList.innerHTML = `<div class="empty-state">正在載入共用資料...</div>`;
  elements.historyList.innerHTML = `<div class="empty-state">正在載入共用資料...</div>`;
}

function renderError(message) {
  elements.settlementList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  if (elements.paymentHistoryList) elements.paymentHistoryList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  elements.peopleList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  elements.historyList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function isPendingPayer(name) {
  return clean(name) === PENDING_PAYER;
}

function personNames() {
  return state.people.map((person) => person.name);
}

function render() {
  renderControls();
  renderSettlement();
  renderPaymentHistory();
  renderPeople();
  renderCalendar();
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

function openEventModal() {
  if (!elements.eventModal) return;
  elements.eventModal.hidden = false;
  elements.eventForm.elements.date?.focus();
}

function closeEventModal() {
  if (!elements.eventModal) return;
  setEventFormBusy(false);
  elements.eventModal.hidden = true;
}

function setEventFormBusy(isBusy) {
  if (elements.eventModalBusy) elements.eventModalBusy.hidden = !isBusy;
  elements.eventForm?.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = isBusy;
  });
  if (elements.closeEventModalBtn) elements.closeEventModalBtn.disabled = isBusy;
  if (elements.cancelEventModalBtn) elements.cancelEventModalBtn.disabled = isBusy;
}

function renderControls() {
  const payerSelect = elements.eventForm.elements.payer;
  payerSelect.innerHTML = [
    `<option value="${escapeHtml(PENDING_PAYER)}">${escapeHtml(PENDING_PAYER)}</option>`,
    ...personNames().map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`),
  ].join("");

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
  personNames().forEach((name) => {
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
  const openBatches = state.settlementBatches || [];
  const lockedKeys = batchDetailKeys(openBatches);
  const selectableEvents = getSelectableSettlementEvents(lockedKeys);
  syncSelectedSettlementEvents(selectableEvents);
  const previewTransfers = calculateSettlement(lockedKeys, selectedSettlementEventIds);
  const openBatchTransfers = openBatches.flatMap((batch) =>
    batch.transfers.filter((transfer) => !new Set(batch.paidTransferIds || []).has(transfer.id)),
  );
  const openTransfers = [...openBatchTransfers, ...previewTransfers];
  const openAmount = openTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);

  if (elements.totalEvents) elements.totalEvents.textContent = state.events.length;
  if (elements.totalPeople) elements.totalPeople.textContent = state.people.length;
  elements.openTransfers.textContent = openTransfers.length;
  elements.openAmount.textContent = money(openAmount);
  elements.settlementCount.textContent = `${openTransfers.length} 筆`;

  if (state.settlementBatchError) {
    elements.settlementList.innerHTML = `
      <div class="empty-state">付款批次資料表尚未建立，請先執行 database/create-settlement-batches.sql</div>
    `;
    return;
  }

  if (!openBatches.length && !selectableEvents.length) {
    elements.settlementList.innerHTML = `<div class="empty-state">目前沒有待付款項</div>`;
    return;
  }

  elements.settlementList.innerHTML =
    openBatches.map((batch, index) => renderActiveSettlementBatch(batch, index)).join("") +
    (selectableEvents.length ? renderSettlementPreview(previewTransfers, selectableEvents, openBatches.length) : "");

  bindSettlementControls(previewTransfers, openBatches, selectableEvents);
}

function renderSettlementPreview(transfers, selectableEvents, existingBatchCount = 0) {
  return (
    `
      ${renderSettlementEventPicker(selectableEvents, transfers, existingBatchCount)}
    ` +
    (transfers.length ? renderTransferCards(transfers) : `<div class="empty-state">請至少選擇一場有待付款的場次</div>`)
  );
}

function getSelectableSettlementEvents(excludedDetailKeys = new Set()) {
  return state.events
    .filter((event) => isSettlementEventIncluded(event) && hasUnlockedSettlementDetails(event, excludedDetailKeys))
    .sort(compareEventsByRecentDate);
}

function syncSelectedSettlementEvents(events) {
  const availableIds = new Set(events.map((event) => event.id));
  const selectedIds = [...selectedSettlementEventIds].filter((id) => availableIds.has(id));
  selectedSettlementEventIds = selectedIds.length ? new Set(selectedIds) : new Set(availableIds);
}

function renderSettlementEventPicker(events, transfers, existingBatchCount = 0) {
  const selectedCount = events.filter((event) => selectedSettlementEventIds.has(event.id)).length;
  const actionTitle = existingBatchCount ? "建立另一個付款批次" : "建立付款批次";
  return `
    <section class="settlement-event-picker">
      <div class="settlement-event-picker-header">
        <div>
          <strong>選擇這批要結算的場次</strong>
          <span>已選 ${selectedCount}/${events.length} 場，只會用這些場次計算本批帳款。</span>
        </div>
        <div class="settlement-event-picker-actions">
          <button class="ghost-button compact" type="button" data-select-settlement-events="all">全選</button>
          <button class="ghost-button compact" type="button" data-select-settlement-events="none">清除</button>
        </div>
      </div>
      <div class="settlement-event-options">
        ${events.map(renderSettlementEventOption).join("")}
      </div>
      <div class="settlement-event-picker-footer">
        <span>目前選了 ${selectedCount} 場，會算成 ${transfers.length} 筆轉帳；完成後只回寫這些場次。</span>
        <button class="settlement-action-button settlement-action-primary" type="button" data-create-settlement-batch ${!transfers.length ? "disabled" : ""}>
          <span>${actionTitle}</span>
        </button>
      </div>
    </section>
  `;
}

function renderSettlementEventOption(event) {
  const unpaidRows = event.participants.filter((person) => person.status === "unpaid" && person.name !== event.payer);
  return `
    <label class="settlement-event-option">
      <input type="checkbox" data-settlement-event="${escapeHtml(event.id)}" ${selectedSettlementEventIds.has(event.id) ? "checked" : ""}>
      <span class="check-box" aria-hidden="true"></span>
      <span>
        <strong>${escapeHtml(formatEventDate(event.date))} ${escapeHtml(formatEventTime(event.time))} ${escapeHtml(event.sport)}</strong>
        <small>付款人 ${escapeHtml(event.payer)} · ${unpaidRows.length} 人未付款 · 每人 ${money(perPerson(event))}</small>
      </span>
    </label>
  `;
}

function renderActiveSettlementBatch(batch, batchIndex = 0) {
  const paidIds = new Set(batch.paidTransferIds || []);
  const remaining = batch.transfers.length - paidIds.size;
  const paidAmount = batch.transfers
    .filter((transfer) => paidIds.has(transfer.id))
    .reduce((sum, transfer) => sum + transfer.amount, 0);
  const isAllDone = batch.transfers.length > 0 && paidIds.size === batch.transfers.length;
  const sourceEvents = getBatchSourceEvents(batch);
  return (
    `
      <section class="settlement-batch-group batch-color-${batchIndex % 3}">
      <div class="settlement-batch-header">
        <div class="settlement-batch-title">
          <strong>${escapeHtml(formatPaymentDate(batch.createdAt))} 建立的批次付款</strong>
          <span>付款批次進行中 · 剩下 ${remaining} 筆未完成</span>
        </div>
        ${renderBatchSourceEvents(batch, sourceEvents)}
        <div class="batch-settlement-actions compact-settlement-actions">
          <div>
            <strong data-batch-selection-title="${escapeHtml(batch.id)}">付款狀態</strong>
            <span data-batch-selection-summary="${escapeHtml(batch.id)}">已付款 ${paidIds.size}/${batch.transfers.length} 筆，合計 ${money(paidAmount)}。${
              isAllDone ? "可完成批次並更新場次。" : ""
            }</span>
          </div>
          ${
            isAllDone
              ? `<button class="settlement-action-button settlement-action-primary" type="button" data-complete-settlement-batch="${escapeHtml(batch.id)}">
                  <span>完成批次並更新場次</span>
                </button>`
              : ""
          }
        </div>
        <button class="settlement-action-button settlement-action-secondary settlement-batch-reset" type="button" data-void-settlement-batch="${escapeHtml(batch.id)}">重新計算</button>
      </div>
    ` +
    renderTransferCards(batch.transfers, paidIds, batch.id) +
    `</section>`
  );
}

function getBatchSourceEvents(batch) {
  const eventIds = batchSourceEventIds(batch);
  const events = eventIds
    .map((eventId) => state.events.find((event) => event.id === eventId))
    .filter(Boolean);
  return events;
}

function renderBatchSourceEvents(batch, events = getBatchSourceEvents(batch)) {
  const eventIds = batchSourceEventIds(batch);
  const missingCount = eventIds.length - events.length;
  if (!eventIds.length) {
    return `<div class="batch-source-event-strip">本批場次未保存，可從付款明細查看來源。</div>`;
  }

  return `
    <div class="batch-source-event-strip">
      ${events.map(renderBatchSourceEvent).join("")}
      ${missingCount ? `<span class="batch-source-missing">另有 ${missingCount} 場已不存在</span>` : ""}
    </div>
  `;
}

function batchSourceEventIds(batch) {
  if (Array.isArray(batch?.sourceEventIds) && batch.sourceEventIds.length) {
    return batch.sourceEventIds;
  }

  return [
    ...new Set(
      (batch?.sourceDetailKeys || [])
        .map((key) => String(key).split("::")[0])
        .filter(Boolean),
    ),
  ];
}

function renderBatchSourceEvent(event) {
  const unpaidRows = event.participants.filter((person) => person.status === "unpaid" && person.name !== event.payer);
  return `
    <span class="batch-source-event">
      <strong>${escapeHtml(formatEventDate(event.date))} ${escapeHtml(formatEventTime(event.time))} ${escapeHtml(event.sport)}</strong>
      <small>付款人 ${escapeHtml(event.payer)} · ${unpaidRows.length} 人未付款 · 每人 ${money(perPerson(event))}</small>
    </span>
  `;
}

function renderExtraSettlementTransfers(transfers, totalAmount) {
  if (!transfers.length) return "";
  return `
    <section class="extra-settlement-section">
      <div class="extra-settlement-header">
        <div>
          <strong>批次外新增帳款</strong>
          <span>這些是建立本批後新增或變動的未付款，會留到下一批處理。</span>
        </div>
        <span class="pill">${transfers.length} 筆 · ${money(totalAmount)}</span>
      </div>
      ${renderTransferCards(transfers)}
    </section>
  `;
}

function renderTransferCards(transfers, paidIds = null, batchId = "") {
  return transfers
    .map(
      (transfer) => `
        <article class="transfer-card ${paidIds ? "has-select" : ""} ${paidIds?.has(transfer.id) ? "is-settled" : ""}">
          ${
            paidIds
              ? `<label class="transfer-select" title="標記這筆轉帳已完成">
                  <input type="checkbox" data-batch-transfer="${escapeHtml(transfer.id)}" data-batch-id="${escapeHtml(batchId)}" ${paidIds.has(transfer.id) ? "checked" : ""}>
                  <span class="check-box" aria-hidden="true"></span>
                  <span class="transfer-select-text">已付款</span>
                </label>`
              : ""
          }
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
            <summary>明細</summary>
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

function bindSettlementControls(transfers, openBatches = [], selectableEvents = []) {
  elements.settlementList.querySelectorAll("[data-settlement-event]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedSettlementEventIds.add(checkbox.dataset.settlementEvent);
      } else {
        selectedSettlementEventIds.delete(checkbox.dataset.settlementEvent);
      }
      renderSettlement();
    });
  });

  elements.settlementList.querySelectorAll("[data-select-settlement-events]").forEach((button) => {
    button.addEventListener("click", () => {
      const ids = selectableEvents.map((event) => event.id);
      selectedSettlementEventIds = button.dataset.selectSettlementEvents === "all" ? new Set(ids) : new Set();
      renderSettlement();
    });
  });

  elements.settlementList.querySelector("[data-create-settlement-batch]")?.addEventListener("click", async (event) => {
    if (!selectedSettlementEventIds.size || !transfers.length) return;
    if (
      !confirm(
        `要用目前選取的 ${selectedSettlementEventIds.size} 場建立付款批次嗎？會固定成 ${transfers.length} 筆轉帳，直到整批完成或重新計算。`,
      )
    ) {
      return;
    }

    try {
      event.currentTarget.disabled = true;
      await createSettlementBatch(transfers, selectedSettlementEventIds, batchDetailKeys(openBatches));
      await loadCloudData();
      showNotice("付款批次已建立，可以開始勾選已完成的轉帳。", "success");
    } catch (error) {
      alert(`建立付款批次失敗：${error.message}。如果尚未建立批次資料表，請先執行 database/create-settlement-batches.sql。`);
      event.currentTarget.disabled = false;
    }
  });

  openBatches.forEach((batch) => {
    const checkboxes = [...elements.settlementList.querySelectorAll(`[data-batch-id="${cssEscape(batch.id)}"]`)];
    const completeButton = elements.settlementList.querySelector(`[data-complete-settlement-batch="${cssEscape(batch.id)}"]`);
    const voidButton = elements.settlementList.querySelector(`[data-void-settlement-batch="${cssEscape(batch.id)}"]`);

    const refreshBatchActionText = () => {
      const selectedIds = getSelectedBatchTransferIds(batch.id);
      const selectedAmount = batch.transfers
        .filter((transfer) => selectedIds.includes(transfer.id))
        .reduce((sum, transfer) => sum + transfer.amount, 0);
      const title = elements.settlementList.querySelector(`[data-batch-selection-title="${cssEscape(batch.id)}"]`);
      const summary = elements.settlementList.querySelector(`[data-batch-selection-summary="${cssEscape(batch.id)}"]`);
      const isAllDone = selectedIds.length === batch.transfers.length;

      if (title) title.textContent = "付款狀態";
      if (summary) {
        summary.textContent = `已付款 ${selectedIds.length}/${batch.transfers.length} 筆，合計 ${money(selectedAmount)}。${
          isAllDone ? "可完成批次並更新場次。" : ""
        }`;
      }
    };

    checkboxes.forEach((checkbox) =>
      checkbox.addEventListener("change", async (event) => {
        const transfer = batch.transfers.find((item) => item.id === checkbox.dataset.batchTransfer);
        const selectedIds = getSelectedBatchTransferIds(batch.id);
        const confirmText = checkbox.checked
          ? `請確認 ${transfer?.from || ""} → ${transfer?.to || ""} ${transfer ? money(transfer.amount) : ""} 已完成付款？`
          : `要取消這筆 ${transfer?.from || ""} → ${transfer?.to || ""} 的已付款標記嗎？`;

        if (!confirm(confirmText)) {
          checkbox.checked = !checkbox.checked;
          refreshBatchActionText();
          return;
        }

        try {
          event.currentTarget.disabled = true;
          await updateSettlementBatchPaidIds(batch.id, selectedIds);
          await loadCloudData();
          const isAllDone = selectedIds.length === batch.transfers.length;
          showNotice(isAllDone ? "本批已全數付款，可以完成批次並更新場次。" : "已更新付款狀態。", "success");
        } catch (error) {
          alert(`更新付款狀態失敗：${error.message}`);
          event.currentTarget.disabled = false;
          checkbox.checked = !checkbox.checked;
          refreshBatchActionText();
        }
      }),
    );
    refreshBatchActionText();

    completeButton?.addEventListener("click", async (event) => {
      if (!confirm(`確定這批 ${batch.transfers.length} 筆轉帳都已完成了嗎？場次付款狀態會一次更新。`)) return;

      try {
        event.currentTarget.disabled = true;
        await completeSettlementBatch(batch);
        await loadCloudData();
        showNotice("本批轉帳已全部結清，付款紀錄已保存，場次狀態已更新。", "success");
      } catch (error) {
        alert(`完成付款批次失敗：${error.message}`);
        event.currentTarget.disabled = false;
      }
    });

    voidButton?.addEventListener("click", async (event) => {
      if (!confirm("確定要放棄這個付款批次並重新計算嗎？已勾選的完成狀態會被清除，場次紀錄不會變更。")) return;
      try {
        event.currentTarget.disabled = true;
        await voidSettlementBatch(batch.id);
        await loadCloudData();
        showNotice("已放棄付款批次，剩餘場次可重新建立批次。", "success");
      } catch (error) {
        alert(`重新計算失敗：${error.message}`);
        event.currentTarget.disabled = false;
      }
    });
  });
}

function getSelectedBatchTransferIds(batchId) {
  return [...elements.settlementList.querySelectorAll(`[data-batch-id="${cssEscape(batchId)}"]:checked`)].map(
    (checkbox) => checkbox.dataset.batchTransfer,
  );
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(String(value));
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function renderPaymentHistory() {
  if (!elements.paymentHistoryList) return;
  if (state.paymentHistoryError) {
    elements.paymentHistoryList.innerHTML = `
      <div class="empty-state">付款紀錄資料表尚未建立，請先執行 database/create-settlement-payments.sql</div>
    `;
    return;
  }
  if (!state.paymentHistory.length) {
    elements.paymentHistoryList.innerHTML = `<div class="empty-state">目前還沒有付款紀錄</div>`;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(state.paymentHistory.length / PAYMENT_HISTORY_PAGE_SIZE));
  paymentHistoryPage = Math.min(Math.max(1, paymentHistoryPage), totalPages);
  const startIndex = (paymentHistoryPage - 1) * PAYMENT_HISTORY_PAGE_SIZE;
  const pagePayments = state.paymentHistory.slice(startIndex, startIndex + PAYMENT_HISTORY_PAGE_SIZE);

  elements.paymentHistoryList.innerHTML =
    pagePayments
    .map(
      (payment) => `
        <article class="payment-record-card">
          <div class="payment-record-main">
            <div class="transfer-route">
              <span>${escapeHtml(payment.from)}</span>
              <span class="arrow">→</span>
              <span>${escapeHtml(payment.to)}</span>
            </div>
            <div class="event-meta">${escapeHtml(formatPaymentDate(payment.createdAt))}</div>
          </div>
          <div class="amount">${money(payment.amount)}</div>
          <details class="transfer-details">
            <summary>查看付款明細</summary>
            <div class="detail-grid">
              <div>
                <h3>${escapeHtml(payment.from)} 的未付款來源</h3>
                ${renderDetailList(payment.fromDetails)}
              </div>
              <div>
                <h3>${escapeHtml(payment.to)} 的代墊來源</h3>
                ${renderDetailList(payment.toDetails)}
              </div>
            </div>
          </details>
        </article>
      `,
    )
      .join("") +
    renderPaymentHistoryPagination(totalPages);

  bindPaymentHistoryPagination(totalPages);
}

function renderPaymentHistoryPagination(totalPages) {
  if (totalPages <= 1) return "";
  const start = (paymentHistoryPage - 1) * PAYMENT_HISTORY_PAGE_SIZE + 1;
  const end = Math.min(paymentHistoryPage * PAYMENT_HISTORY_PAGE_SIZE, state.paymentHistory.length);
  return `
    <nav class="payment-history-pagination" aria-label="付款紀錄分頁">
      <span>第 ${paymentHistoryPage} / ${totalPages} 頁，顯示 ${start}-${end} 筆，共 ${state.paymentHistory.length} 筆</span>
      <div>
        <button class="ghost-button compact" type="button" data-payment-page="prev" ${paymentHistoryPage <= 1 ? "disabled" : ""}>上一頁</button>
        <button class="ghost-button compact" type="button" data-payment-page="next" ${paymentHistoryPage >= totalPages ? "disabled" : ""}>下一頁</button>
      </div>
    </nav>
  `;
}

function bindPaymentHistoryPagination(totalPages) {
  elements.paymentHistoryList.querySelectorAll("[data-payment-page]").forEach((button) => {
    button.addEventListener("click", () => {
      paymentHistoryPage += button.dataset.paymentPage === "next" ? 1 : -1;
      paymentHistoryPage = Math.min(Math.max(1, paymentHistoryPage), totalPages);
      renderPaymentHistory();
    });
  });
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

async function markTransferDetailsPaid(transfer) {
  await markTransfersDetailsPaid([transfer]);
}

async function markTransfersDetailsPaid(transfers) {
  const grouped = new Map();
  transfers.forEach((transfer) => {
    transfer.fromDetails.forEach((detail) => {
      if (!detail.eventId || !detail.personName) return;
      addGroupedSettlementDetail(grouped, detail.eventId, detail.personName);
    });
  });

  await updateGroupedSettlementDetails(grouped, "這批轉帳沒有可回寫的場次明細");
}

async function markSettlementDetailKeysPaid(detailKeys) {
  const grouped = new Map();
  detailKeys.forEach((key) => {
    const [eventId, personName] = String(key).split("::");
    addGroupedSettlementDetail(grouped, eventId, personName);
  });

  await updateGroupedSettlementDetails(grouped, "這個付款批次沒有可回寫的場次明細");
}

function addGroupedSettlementDetail(grouped, eventId, personName) {
  if (!eventId || !personName) return;
  if (!grouped.has(eventId)) grouped.set(eventId, new Set());
  grouped.get(eventId).add(personName);
}

async function updateGroupedSettlementDetails(grouped, emptyMessage) {
  if (!grouped.size) {
    throw new Error(emptyMessage);
  }

  const updates = [];
  grouped.forEach((names, eventId) => {
    const eventItem = state.events.find((event) => event.id === eventId);
    if (!eventItem) return;
    const participants = eventItem.participants.map((person) => (names.has(person.name) ? { ...person, status: "paid" } : person));
    updates.push(updateEventParticipants(eventId, participants));
  });

  await Promise.all(updates);
}

function renderPeople() {
  if (!state.people.length) {
    elements.peopleList.innerHTML = `<div class="empty-state">先新增常一起運動的人</div>`;
    return;
  }

  elements.peopleList.innerHTML = state.people
    .map(
      (person) => `
        <div class="person-chip" data-person-row="${escapeHtml(person.name)}">
          <div class="person-field">
            <span class="person-field-label">姓名</span>
            <span class="person-name">${escapeHtml(person.name)}</span>
            <input class="person-edit-input" value="${escapeHtml(person.name)}" data-person-input="${escapeHtml(person.name)}" aria-label="編輯 ${escapeHtml(person.name)}" hidden />
          </div>
          <div class="person-field">
            <span class="person-field-label">Email</span>
            <span class="person-email" title="${escapeHtml(person.email || "未設定 Email")}">${escapeHtml(person.email || "未設定 Email")}</span>
            <input class="person-email-input" type="email" value="${escapeHtml(person.email || "")}" data-person-email-input="${escapeHtml(person.name)}" aria-label="編輯 ${escapeHtml(person.name)} Email" hidden />
          </div>
          <div class="person-actions">
            <button class="edit-person-button" type="button" data-edit-person="${escapeHtml(person.name)}">編輯</button>
            <button class="save-person-button" type="button" data-save-person="${escapeHtml(person.name)}" hidden>儲存</button>
            <button class="cancel-person-button" type="button" data-cancel-person="${escapeHtml(person.name)}" data-cancel-email="${escapeHtml(person.email)}" hidden>取消</button>
            <button class="remove-person-button" type="button" data-remove-person="${escapeHtml(person.name)}" aria-label="移除 ${escapeHtml(person.name)}">刪除</button>
          </div>
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
      const emailInput = row?.querySelector("[data-person-email-input]");
      if (input) input.value = button.dataset.cancelPerson;
      if (emailInput) emailInput.value = button.dataset.cancelEmail || "";
      setPersonEditMode(row, false);
    });
  });

  elements.peopleList.querySelectorAll("[data-save-person]").forEach((button) => {
    button.addEventListener("click", async () => {
      const oldName = button.dataset.savePerson;
      const input = button.closest(".person-chip")?.querySelector("[data-person-input]");
      const emailInput = button.closest(".person-chip")?.querySelector("[data-person-email-input]");
      const newName = clean(input?.value);
      const email = clean(emailInput?.value);
      if (!newName) {
        alert("姓名不能空白");
        return;
      }
      try {
        button.disabled = true;
        const result = await updatePerson(oldName, newName, email);
        await loadCloudData();
        showSupplementalInviteResult(result?.supplementalInvites, newName);
      } catch (error) {
        alert(`更新人員失敗：${error.message}`);
        button.disabled = false;
      }
    });
  });

  elements.peopleList.querySelectorAll("[data-person-input], [data-person-email-input]").forEach((input) => {
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
  row.querySelector(".person-email").hidden = isEditing;
  row.querySelector(".person-edit-input").hidden = !isEditing;
  row.querySelector(".person-email-input").hidden = !isEditing;
  row.querySelector(".edit-person-button").hidden = isEditing;
  row.querySelector(".save-person-button").hidden = !isEditing;
  row.querySelector(".cancel-person-button").hidden = !isEditing;
  if (isEditing) row.querySelector(".person-edit-input").focus();
}

function renderCalendar() {
  if (!elements.calendarGrid || !elements.calendarTitle) return;

  const monthYear = calendarMonth.getFullYear();
  const monthIndex = calendarMonth.getMonth();
  const todayKey = dateKey(new Date());
  const eventMap = eventsByDateKey();
  const days = calendarDays(calendarMonth);

  elements.calendarTitle.textContent = `${monthYear} 年 ${monthIndex + 1} 月場次`;
  elements.calendarGrid.innerHTML = days
    .map((day) => {
      const key = dateKey(day);
      const events = eventMap.get(key) || [];
      const isCurrentMonth = day.getMonth() === monthIndex;
      return `
        <button class="calendar-day ${isCurrentMonth ? "" : "is-muted"} ${events.length ? "has-events" : ""} ${key === todayKey ? "is-today" : ""} ${key === selectedCalendarDate ? "is-selected" : ""}" type="button" data-calendar-date="${key}">
          <span class="calendar-date-number">${day.getDate()}</span>
          ${renderCalendarEventMarkers(events)}
        </button>
      `;
    })
    .join("");

  elements.calendarGrid.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCalendarDate = button.dataset.calendarDate;
      renderCalendar();
    });
  });

  renderCalendarDayDetails(eventMap);
}

function renderCalendarEventMarkers(events) {
  if (!events.length) return "";
  const visibleEvents = events.slice().sort(compareCalendarEventTime).slice(0, 3);
  const extraCount = events.length - visibleEvents.length;
  return `
    <span class="calendar-event-stack">
      ${visibleEvents.map(renderCalendarEventMarker).join("")}
      ${extraCount > 0 ? `<span class="calendar-more-events">另有 ${extraCount} 場</span>` : ""}
    </span>
  `;
}

function renderCalendarEventMarker(event) {
  const sportType = getSportType(event.sport);
  return `
    <span class="calendar-event-marker ${sportType.className}">
      <span class="calendar-event-main">
        <span aria-hidden="true">${sportType.icon}</span>
        <strong>${escapeHtml(formatEventTime(event.time))}</strong>
        <span>${escapeHtml(event.sport)}</span>
      </span>
      <span class="calendar-event-people">${event.participants.length} 人</span>
    </span>
  `;
}

function participantNamesText(participants) {
  const names = participants.map((person) => person.name).filter(Boolean);
  return names.length ? names.join("、") : "尚未選人";
}

function compareCalendarEventTime(a, b) {
  const aMinutes = timeRangeParts(a.time).startMinutes ?? 0;
  const bMinutes = timeRangeParts(b.time).startMinutes ?? 0;
  return aMinutes - bMinutes || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
}

function renderCalendarDayDetails(eventMap) {
  if (!elements.calendarDayDetails) return;
  const selectedDate = selectedCalendarDate || dateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
  const events = (eventMap.get(selectedDate) || []).slice().sort(compareEventsByRecentDate);
  const label = formatEventDate(selectedDate);

  if (!events.length) {
    elements.calendarDayDetails.innerHTML = `
      <div class="calendar-detail-title">${escapeHtml(label)}</div>
      <div class="detail-empty">這天目前沒有安排場次</div>
    `;
    return;
  }

  elements.calendarDayDetails.innerHTML = `
    <div class="calendar-detail-title">${escapeHtml(label)}</div>
    <ul class="calendar-detail-list">
      ${events
        .map(
          (event) => `
            <li>
              <strong>${escapeHtml(formatEventTime(event.time))}</strong>
              <span class="sport-tag ${getSportType(event.sport).className}"><span aria-hidden="true">${getSportType(event.sport).icon}</span>${escapeHtml(event.sport)}</span>
              <span>${event.participants.length} 人 · 付款人 ${escapeHtml(event.payer)}</span>
              <span class="calendar-detail-people">參加者：${escapeHtml(participantNamesText(event.participants))}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function eventsByDateKey() {
  const map = new Map();
  state.events.forEach((event) => {
    const parsed = dateParts(event.date);
    if (!parsed) return;
    const key = dateKey(new Date(parsed.year, parsed.month - 1, parsed.day));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  });
  return map;
}

function calendarDays(monthDate) {
  const first = monthStart(monthDate);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function monthStart(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
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
      const editorPeople = [
        ...new Set(personNames().concat(event.participants.map((person) => person.name), isPendingPayer(event.payer) ? [] : event.payer).filter(Boolean)),
      ];
      const payerOptions = [PENDING_PAYER, ...editorPeople.filter((name) => !isPendingPayer(name))];
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
                  ${payerOptions.map((name) => `<option value="${escapeHtml(name)}" ${name === event.payer ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
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
      if (isPendingPayer(select.value)) return;
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
          return { name, status: !isPendingPayer(payer) && name === payer ? "paid" : status };
        });

      if (payer && !isPendingPayer(payer) && !participants.some((person) => person.name === payer)) {
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
        const originalEvent = state.events.find((event) => event.id === button.dataset.saveEvent);
        const originalParticipantNames = new Set((originalEvent?.participants || []).map((person) => person.name));
        const addedParticipantNames = participants.map((person) => person.name).filter((name) => !originalParticipantNames.has(name));
        await updateEvent(button.dataset.saveEvent, changes);
        const inviteResult = addedParticipantNames.length ? await sendAddedParticipantInvites(changes, addedParticipantNames) : null;
        await loadCloudData();
        showAddedParticipantInviteResult(inviteResult, addedParticipantNames);
      } catch (error) {
        alert(`更新場次失敗：${error.message}`);
        button.disabled = false;
      }
    });
  });

  elements.historyList.querySelectorAll("[data-remove-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("確定要刪除嗎？")) return;
      const eventItem = state.events.find((event) => event.id === button.dataset.removeEvent);
      try {
        button.disabled = true;
        const cancelResult = eventItem ? await cancelCalendarInvite(eventItem) : { status: "disabled" };
        await deleteEvent(button.dataset.removeEvent);
        await loadCloudData();
        showCalendarCancelResult(cancelResult);
      } catch (error) {
        alert(`刪除場次失敗：${error.message}`);
        button.disabled = false;
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

function calculateSettlement(excludedDetailKeys = new Set(), includedEventIds = null) {
  const balances = new Map();
  const payerEntries = new Map();
  const receiverEntries = new Map();
  state.events.filter((event) => isSettlementEventIncluded(event, includedEventIds)).forEach((event) => {
    const share = perPerson(event);
    event.participants
      .filter((person) => person.status === "unpaid" && person.name !== event.payer)
      .forEach((person) => {
        if (excludedDetailKeys.has(settlementDetailKey(event.id, person.name))) return;
        balances.set(person.name, roundMoney((balances.get(person.name) || 0) - share));
        balances.set(event.payer, roundMoney((balances.get(event.payer) || 0) + share));
        addDetailEntry(payerEntries, person.name, {
          amount: share,
          eventId: event.id,
          personName: person.name,
          label: `${formatEventDate(event.date)} ${formatEventTime(event.time)} ${event.sport}，原付款人 ${event.payer}`,
        });
        addDetailEntry(receiverEntries, event.payer, {
          amount: share,
          eventId: event.id,
          personName: person.name,
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
        id: `${payer.name}->${receiver.name}-${transfers.length}`,
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

function isSettlementEventIncluded(event, includedEventIds = null) {
  if (!isCompletedEvent(event) || isPendingPayer(event.payer)) return false;
  if (includedEventIds && !includedEventIds.has(event.id)) return false;
  return event.participants.some((person) => person.status === "unpaid" && person.name !== event.payer);
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

    consumed.push({ label: entry.label, amount, eventId: entry.eventId, personName: entry.personName });
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

function dateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function formatPaymentDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
