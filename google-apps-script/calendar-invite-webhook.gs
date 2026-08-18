const INVITE_TOKEN = "sports-split-calendar-invite-v1";
const TIME_ZONE = "Asia/Taipei";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    if (payload.token !== INVITE_TOKEN) {
      return jsonResponse({ ok: false, error: "Invalid token" });
    }

    const action = payload.action || "invite";
    const eventData = payload.event || {};
    const date = parseDate(eventData.date);
    const time = parseTimeRange(eventData.time);
    const start = new Date(date.year, date.month - 1, date.day, time.startHour, time.startMinute);
    const end = new Date(date.year, date.month - 1, date.day, time.endHour, time.endMinute);
    if (end <= start) end.setDate(end.getDate() + 1);

    const title = calendarTitle(eventData.sport);
    const calendar = CalendarApp.getDefaultCalendar();
    const existingEvent = findExistingEvent(calendar, title, start, end);

    if (action === "cancel") {
      if (!existingEvent) {
        return jsonResponse({ ok: true, skipped: true, reason: "Calendar event not found", action: "not_found" });
      }

      existingEvent.deleteEvent();
      return jsonResponse({ ok: true, id: existingEvent.getId(), title, action: "deleted" });
    }

    const attendees = Array.isArray(eventData.attendees) ? eventData.attendees : [];
    const guestEmails = attendees.map((person) => person.email).filter(Boolean);

    if (!guestEmails.length) {
      return jsonResponse({ ok: true, skipped: true, reason: "No attendee emails" });
    }

    const location = eventLocation(eventData.sport);
    const description = [
      `項目：${eventData.sport || ""}`,
      `時間：${eventData.time || ""}`,
      `費用總計：${eventData.total || 0}`,
      `付款人：${eventData.payer || ""}`,
      `參加者：${(eventData.participants || []).join("、")}`,
      "",
      "此活動由運動分帳網站自動建立。",
    ].join("\n");

    const calendarEvent = existingEvent || calendar.createEvent(title, start, end, {
      location,
      description,
      guests: guestEmails.join(","),
      sendInvites: true,
    });

    if (existingEvent) {
      addMissingGuests(calendarEvent, guestEmails);
    } else {
      calendarEvent.setVisibility(CalendarApp.Visibility.PRIVATE);
      calendarEvent.setGuestsCanSeeGuests(false);
    }

    return jsonResponse({
      ok: true,
      id: calendarEvent.getId(),
      title,
      location,
      attendeeCount: guestEmails.length,
      action: existingEvent ? "updated" : "created",
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function findExistingEvent(calendar, title, start, end) {
  const events = calendar.getEvents(start, end, { search: title });
  return events.find((event) =>
    event.getTitle() === title &&
    event.getStartTime().getTime() === start.getTime() &&
    event.getEndTime().getTime() === end.getTime()
  ) || null;
}

function addMissingGuests(calendarEvent, guestEmails) {
  const existingEmails = calendarEvent.getGuestList()
    .map((guest) => String(guest.getEmail() || "").toLowerCase());

  guestEmails.forEach((email) => {
    if (!existingEmails.includes(String(email).toLowerCase())) {
      calendarEvent.addGuest(email);
    }
  });
}

function calendarTitle(sport) {
  const text = String(sport || "");
  if (text.includes("羽球")) return "打羽球";
  if (text.includes("匹克球")) return "打匹克球";
  return `打${text || "運動"}`;
}

function eventLocation(sport) {
  const text = String(sport || "");
  if (text.includes("羽球")) return "朝馬運動中心";
  if (text.includes("匹克球")) return "匹克王";
  return "";
}

function parseDate(value) {
  const text = String(value || "");
  const match = text.match(/(?:(\d{4})\s*[/-]\s*)?(\d{1,2})\s*[/-]\s*(\d{1,2})/);
  if (!match) throw new Error(`Invalid date: ${text}`);
  return {
    year: Number(match[1] || Utilities.formatDate(new Date(), TIME_ZONE, "yyyy")),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTimeRange(value) {
  const text = String(value || "");
  const match = text.match(/(\d{1,2})(?::?(\d{2}))?\s*[-~–—到至]\s*(\d{1,2})(?::?(\d{2}))?/);
  if (!match) throw new Error(`Invalid time: ${text}`);
  return {
    startHour: Number(match[1]),
    startMinute: Number(match[2] || 0),
    endHour: Number(match[3]),
    endMinute: Number(match[4] || 0),
  };
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
