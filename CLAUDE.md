# LegaSea beach-house website — guide for Claude

This is the website for **LegaSea**, the Ellison family's vacation rental on Oak Island, NC.
Live at **https://legaseaoakisland.com**. Anyone editing here is usually Jeff or Shelby Ellison
asking for plain-English changes — keep explanations simple and non-technical.

## How edits go live (important)
- This repo **auto-deploys to Netlify** on every push to `main`. Push → the live site updates in ~1 minute.
- There is **no build step** — the HTML files in the repo root ARE the site. Edit them directly.
- After a change, commit and push to `main`. That's all it takes to publish.
- **One editor at a time.** Jeff and Shelby share the same GitHub login. If both push at once the
  changes collide. Before starting, assume the other may be editing; keep changes quick and pushed.

## The pages
- `index.html` — landing page (hero photo, quote, big buttons to the other pages)
- `our-home.html` — about the house (bedrooms, baths, amenities, photos)
- `availability.html` — calendar of open/booked weeks (pulls live from VRBO — see below)
- `explore.html` — local Oak Island attractions, restaurants, things to do
- `beach-day.html` — live beach conditions (weather, UV, tides, flags)
- `house-rules.html` — **public, read-only** house rules (check-in/out, no-pets, house care, golf cart)
- `guest-agreement.html` — the **signable** version with checkboxes; sent to guests ~1 week before a stay
- `dashboard.html` — private owner dashboard (not part of the guest site)

## Guardrails — please follow these
1. **Never put the WiFi password, network name, lockbox/garage code, or specific arrival details on
   any public page** (index, our-home, availability, explore, beach-day, house-rules). Those secrets
   belong **only** in `guest-agreement.html`, which is unlocked after a guest signs. If asked to add
   arrival info to a public page, put it on the guest agreement instead and explain why.
2. **The guest agreement is intentionally unlisted.** It stays live at its URL (so it can be emailed
   to guests) and is `noindex`, but it is **not** linked in the nav or footers. `house-rules.html` is
   the public read-only version. Don't add nav/footer links back to `guest-agreement.html`. (There is
   one deliberately faint fallback link in the House Rules footer — leave it faint.)
3. **Contact info is obfuscated on purpose.** The email and phone are injected at runtime by
   `/contact.js` so spam bots can't scrape them. Do **not** hardcode the email address or phone number
   in plain text. Reuse the existing pattern: an element with `data-eml data-eml-text` (email) or
   `data-tel data-tel-text` / `data-tel` (phone), left empty — `contact.js` fills it in.
4. **No "card on file."** The Ellisons don't keep a card on file. Word fees/damages as "you're
   responsible for / agree to pay any fees you incur," never "we'll charge the card on file."
5. **Availability comes from VRBO automatically.** `availability.html` + `netlify/functions/availability.js`
   read the booked dates from a VRBO calendar link stored in the Netlify env var `VRBO_ICAL_URL`.
   Don't hardcode booked dates — they update on their own.

## Design system (match this for a consistent look)
- Fonts: **Cormorant Garamond** (headings, italic accents) + **DM Sans** (body).
- Colors (CSS variables at the top of each file): `--sand #f5efe6`, `--dune #e8d9c5`,
  `--ocean #2c6b7a`, `--deep #1a3f4a`, `--foam #c9e8ee`, `--coral #d4705a`, `--text #1e2a2d`,
  `--light #f9f5f0`.
- Content sits in a centered column; section items use the `.item` pattern (emoji icon + bold lead-in
  + text). Important warnings use the `.fine-banner` coral callout (e.g. the $500 no-pets rule and the
  golf-cart resident-parking rule).

## Key facts (so copy stays consistent)
- 4 bedrooms · 3 baths · sleeps 12 · an easy 2-block walk to the beach · elevator · golf cart · private apartment.
- Check-in **4:00 PM**, check-out **10:00 AM**. No pets — **$500 fine**.
- Golf cart: park **only in Town of Oak Island resident spaces**; tickets are the guest's responsibility.
