# Lumen — Records System Plan & Ethics Notes

*Working notes for Jeff. Lumen is the home-built session-notes review app for Ellison
Psychological (a local browser app + Claude API, notes stored as plain files in a
`session-notes` folder). This doc captures the migration plan and the ethical/HIPAA
reasoning behind it. No passwords, codes, or patient information belong in this file.*

---

## The plan in one paragraph

Keep running Lumen on the MacBook for now. About **one month before the virtual
assistant starts** (~6 months out), move it to an always-on **Mac mini at home**,
wired to the router, reachable only through **Tailscale** — never exposed to the
internet. The VA reaches Lumen from any browser (Windows is fine) once invited to
the Tailscale network. Transcription runs **locally on the mini** (Whisper on Apple
Silicon) so session audio never leaves the house. Records back up two ways: the
`session-notes` folder syncs to **Google Drive on the practice Workspace account**
(with Google's BAA accepted), and **Time Machine** runs to an encrypted ~1TB external
SSD plugged into the mini.

## Do now (doesn't need the mini)

- [ ] Sync `session-notes` to Drive on **jeff@ellisonpsychological.com** (accept the
      BAA in Workspace admin first — never the personal Gmail account)
- [ ] Time Machine on the MacBook to an encrypted external SSD (Samsung T7 / Crucial
      X9 / SanDisk Extreme, 1TB — say **yes** to the encryption checkbox)
- [ ] Confirm FileVault is on
- [ ] Write the professional-will access page (see Ethics below — highest-value item)

## Do in the month before the VA starts

- [ ] Buy base M-series Mac mini; set up headless next to the router on Ethernet
- [ ] System Settings: prevent sleep; start up automatically after power failure;
      automatic updates on; its own login only Jeff knows
- [ ] Move Lumen over; run it as an auto-starting service (launchd) instead of the
      `.command` script
- [ ] Install Tailscale on the mini + Jeff's devices; later invite the VA (revocable
      with one click)
- [ ] **Add a login to Lumen** — required once anyone besides Jeff can reach it; decide
      whether the VA gets full access or a restricted forms-only view
- [ ] Move the Time Machine SSD to the mini
- [ ] Set up local Whisper transcription on the mini

---

## Is a home-built records system ethically defensible?

Yes — nothing in HIPAA, the APA ethics code, or state board rules requires
*commercial* software. The standard is **reasonable safeguards and sound
record-keeping** (paper charts in a locked cabinet were home-built systems too).
But the real ethical risks are not the ones people guess (hacking); they are the
five below. Each has a concrete fix.

### 1. The bus factor — the big one

Jeff is Lumen's developer, maintainer, and sole expert. If he is suddenly
incapacitated, patients' records sit inside a system nobody else can operate — and
psychologists have an affirmative duty (APA Standard 6; most states) to plan for
exactly that, usually via a **professional will**.

**Fix:** the records are plain files, not trapped in a database — so a colleague or
executor never needs Lumen itself. Write **one page of instructions**: where the
records live (the practice Drive account), how the executor gets access, and the
retention obligation. This single page is the highest-value ethical act in the
whole project.

### 2. Durability and integrity

Records must survive the retention period (commonly 7+ years; longer for minors).
Homemade software has bugs; a bad update could corrupt notes silently.

**Fix:** plain files + Time Machine + Drive version history genuinely cover this —
but only if backups are real. **Restore a file once a year to prove the backup
works.** An untested backup is an ethical risk wearing a technical costume.

### 3. Producibility

Subpoenas, patient record requests, and board audits require producing complete,
legible records promptly — even if Lumen is broken that week.

**Fix:** keep notes readable as bare files (dates and patient identifiers in
filenames or headers), meaningful without Lumen's interface. Files-in-folders
passes this test.

### 4. The AI layer needs a deliberate decision

Patient material going to the Claude API is an ethical question separate from the
security mechanics. Emerging APA guidance leans toward **disclosing AI-assisted
documentation in informed-consent paperwork**.

**Fix:** add a sentence to intake forms (secure AI tools assist with
documentation); check current state-association guidance. Separately, before
handling records at scale, set up **Anthropic's HIPAA-eligible arrangement** for
the API — this is the one open BAA gap.

### 5. How it looks if something goes wrong

If there's ever a breach or board complaint, "commercial EHR" is self-explanatory
while "system I built" invites scrutiny.

**Fix:** documentation is the defense — a written **risk assessment** (a few pages
for a solo practice: where PHI lives, how each location is protected; this doc is
most of the raw material), plus the encryption settings and BAAs on record. A
well-documented homemade system is defensible; an undocumented one looks like
improvisation even when it isn't. An annual one-hour review by an IT consultant
who works with medical practices doubles as this documentation.

### The honest counterweight

Commercial EHRs get breached constantly — at massive scale — and lock records into
proprietary formats with their own continuity problems. This setup keeps patient
data on owned hardware, invisible to the internet, in a format readable in thirty
years. Done with the mitigations above, there's a credible argument it is
ethically *stronger* than the default, not weaker.

---

## Security model (why no cybersecurity staff is needed)

The attack surface is nearly zero **by design**: the mini is not reachable from the
internet at all — no exposed ports, no website to harden. Tailscale (WireGuard-based,
audited) handles the hard part. The layers and what each one covers:

| Threat | Covered by |
|---|---|
| Strangers on the internet | Tailscale — the mini is invisible; nothing to scan or attack |
| Stolen mini or backup drive | FileVault + encrypted Time Machine — hardware loss, not a records breach |
| Authorized person seeing too much | Lumen's own login (Tailscale's job ends at the network door) |
| Lost/compromised laptop or phone | Device hygiene — lock screens, FileVault on the laptop too |
| Vendor mishandling data | BAAs — Google (done via Workspace) and Anthropic (to do) |
| Session audio exposure | Local transcription on the mini — no third party ever touches audio |

Ongoing maintenance is habits, not expertise: automatic updates on, real passwords
in a password manager, add/revoke VA access as needed, and one hour a year checking
that updates applied, backups ran, and the access list is right.

## HIPAA checklist

- [x] Encryption at rest — FileVault + encrypted backup drive
- [x] Encryption in transit — Tailscale tunnels
- [x] Access control — Tailscale device list + Lumen login + one-click revocation
- [ ] BAA: Google — accept in Workspace admin for the practice account
- [ ] BAA: Anthropic — HIPAA-eligible API arrangement before scale
- [ ] Written risk assessment (few pages; annual consultant hour can produce it)
- [ ] Professional will / executor access page
- [ ] Annual backup-restore test
- [ ] Informed-consent language re: AI-assisted documentation
