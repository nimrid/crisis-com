# GraceGuard PR

**Steady, caring words when your church is in crisis.**

Built for the [AI for Church Hackathon](https://aiforchurch.com/hackathon) (*Church Operations & Admin* / *Care & Community*).

**Live app**: https://crisis-com.lovable.app

---

## What GraceGuard Does

GraceGuard PR is a crisis and sensitive communications copilot for pastors, governing elders, and church communications leads. When an urgent incident hits, it prevents premature public statements, protects clergy-penitent privilege, and drafts four audience-specific communications from one verified triage record.

### Key Capabilities
1. **Incident Triage & Chronology**: Paste unstructured notes or dictate via Web Speech voice-to-text, then merge confirmed facts, parties, timelines, and unconfirmed rumors without overwriting edits. Includes situation-specific **First-60-Minute Action Checklists**.
2. **Pause & Assess Safety Interlocks**: Hard gates block church-wide and public drafts until 911/emergency status, next-of-kin notification, legal/insurer risk-contact check, and a designated single spokesperson are confirmed.
3. **5-Layer Counseling Firewall**:
   - **Layer 1**: Verified Baseline Facts & Timeline
   - **Layer 2**: Pastoral Guidance & Prayer Points
   - **Layer 3**: Legal Strategy & Liability Notes (Elder/Board only)
   - **Layer 4**: Medical & Family Details (excluded from every AI payload)
   - **Layer 5**: Confidential Counseling & Confessional Vault (physically separate Postgres table with owner + `executive`/`pastoral` RLS only—never sent to AI prompts)
4. **Multi-Audience Draft Studio & Exports**:
   - **Elder / Board Briefing** (confidential chronology, risk notes, voting checklist)
   - **Staff & Volunteers** (30-second spoken pocket script with spokesperson redirect)
   - **Sunday Congregation** (Scripture-grounded lament address + local counseling referral directory)
   - **Public & Press** (zero-fault holding statement + 4 FAQ answers + official press contact)
   - Includes **Cross-Layer Privacy Leak Scanning**, **Leader Release Sign-Off**, **Reading / Print View**, and **Full Crisis Packet Export**.
5. **Interactive Lobby & Media Sparring**: Situation-aware challenge questions with live conciseness meter (`75 words` target), red-line checks, and AI coaching.
6. **Church Workspaces & Role-Scoped Access**: Share incidents, profiles, and persisted draft approvals across church members (`executive`, `elders`, `pastoral`, `volunteers`) while keeping Layer 5 restricted.

---

## 60-Second Judge Walkthrough

1. Open `/workspace` (no sign-in required for fictional demos).
2. Switch to **Pastor transition · demo** to see **Pause & Assess** actively holding Congregation/Press drafts until the legal/insurer risk contact is confirmed.
3. Open **Information layers** to inspect Layers 1–4 and the isolated **Layer 5 Counseling Vault**.
4. Open **Draft studio**, clear the confidentiality check, preview all **4 audience voices**, test **Reading / print view**, and mark a draft **Approved for release**.
5. Open **Lobby sparring** to rehearse a tough question against the holding line.

---

## Development

```sh
bun install
bun run dev
```

Run tests, typecheck, and production build:

```sh
bun run test
bunx tsc --noEmit
bun run build
```

Built with [Lovable](https://lovable.dev) · [Project Editor](https://lovable.dev/projects/a1cc0130-3663-4352-b8dc-7ae8feacfb64).
