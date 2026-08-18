# Google Calendar Invites

This project can call a Google Apps Script Web App after a sports event is created.

## Setup

1. Sign in as `jennyshih@geosense.tw`.
2. Open Google Apps Script and create a new project.
3. Copy `google-apps-script/calendar-invite-webhook.gs` into `Code.gs`.
4. Deploy as a Web App.
5. Set "Execute as" to yourself.
6. Set access to anyone with the link.
7. Copy the Web App URL.
8. Paste the URL into `calendarInviteWebhookUrl` in `app.js`.

## Behavior

- Badminton events are titled `打羽球` and use location `朝馬運動中心`.
- Pickleball events are titled `打匹克球` and use location `匹克王`.
- Events are created as private calendar events.
- Participants without Email are skipped.
- This first version sends invites only when a new event is created.
