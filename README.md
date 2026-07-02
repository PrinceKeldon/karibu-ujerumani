# Karibu Ujerumani MVP0.1

PWA-ready MVP shell for housing, official services, emergency support, community workflows, and Karibu Chat.

## Run

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## App Routes

- `/#home` - dashboard and quick access
- `/#search` - housing search
- `/#detail` - listing detail
- `/#assistant` - Karibu Chat
- `/#checklist` - arrival checklist
- `/#community` - community feed
- `/#messages` - inbox
- `/#bookings` - bookings
- `/#profile` - profile
- `/#rathaus` - Rathaus/Bürgeramt finder
- `/#emergency` - emergency community outreach

## Pitch Flow

1. Start on Home and show the core loop: housing, checklist, community, emergency help.
2. Open Housing, save a listing, view detail, then request to book.
3. Open Rathaus Finder and show address/postcode lookup with nearby authority pins.
4. Open Emergency Help and show mental health, care and support, emergency short stay, embassy, and admin/document support.
5. Open Assistant and use quick chips to show guided relocation support.
6. Open Profile and show verification, saved searches, payments, and support surfaces.

Core controls navigate, update state, open a bottom sheet, show a toast, filter content, or start a case/booking flow.
