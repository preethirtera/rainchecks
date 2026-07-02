# RainCheck 🌧

**Live: https://preethirtera.github.io/raincheck/** — on your phone, open it
in Safari/Chrome and use "Add to Home Screen" to install.

An app for overcommitters. It lives in the gap between **being asked** and
**saying yes** — showing you what your week already costs before you spend
more of it, and helping you decline gracefully when the budget is blown.

Local-first PWA. Minimal permissions by design: asks come in via share
sheet / paste / email forwarding, commitments go out via an ICS feed your
real calendar subscribes to. No message access, no inbox OAuth, no
calendar write permission — ever.

## Stack

- Vite + React + TypeScript
- `vite-plugin-pwa` (installable, offline-ready)
- IndexedDB for storage (Phase 1) — no backend until Phase 3

## Develop

```sh
npm install
npm run dev
```

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Identity, design tokens, installable PWA shell | ✅ |
| 1 | MVP: quick-add asks with auto time parsing, yes-budget meter, sleep-on-it timer, 24-hour rule, decline screen | ✅ |
| 2 | Own calendar: week view, alone-time blocks, overload detection, ICS in/out, replies in your own words | ✅ |
| 3a | Zero-permission intake: Android share sheet (share_target), iOS Shortcut / #add= intake link, instant conflict heads-up | ✅ |
| 3b | Connector backend: Slack/Teams/Gmail OAuth, email forwarding, web push while closed | needs hosting + accounts |
| 4 | Saying-no toolkit: decline composer, reclaimed-hours stats, reflection | |
| 5 | Optional E2E-encrypted sync, multi-device, shareable raincheck links | |

## Design tokens

Defined in [src/tokens.css](src/tokens.css). Dark-only. Purple = brand and
interactive, cyan = free time and calm, yellow = overload — semantic colors
never double as decoration. Glow is reserved for the wordmark and the load
meter.
