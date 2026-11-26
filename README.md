# Crisis Com

Build GraceGuard PR — The Crisis & Sensitive Communications Copilot for churches and ministries.

Key capabilities to build:
1. Incident Triage & Intake:
- Support selecting or entering situation types: Pastoral Misconduct / Staff Transition, Youth / Student Accident, Sudden Death / Community Tragedy, Legal / Financial / Property Incident.
- Intake allows unstructured notes / voice-memo text paste, extracting timeline, confirmed parties, and unconfirmed rumors.
- Pre-loaded hero demo scenarios (e.g. Youth Retreat Bus Accident with minor injuries, or Pastor Resignation / Moral Failure) for instant hackathon evaluation.

2. Pause & Assess Safety Interlock Protocol:
- Hard Locks: Emergency Services / 911 status, Next-of-kin / parental notification (mandatory before broadcasting to church or public).
- Conditional Holds: Legal & insurance notification check (e.g., Brotherhood Mutual / Church Mutual risk contact before admitting fault), Designated Single Spokesperson lock.
- Need-to-Know Authorization Gate: Confirm authorized recipient clearance tiers (Executive Leadership, Governing Elders, Pastoral Staff, Volunteers) and require confidentiality acknowledgment.

3. Counseling Firewall & Data Layer Permissions:
- Strict segregation of data layers: Layer 1 (Verified Baseline Facts), Layer 2 (Pastoral Guidance & Prayer Points), Layer 3 (Legal Strategy & Liability), Layer 4 (Medical & Family Details), Layer 5 (Confidential Pastoral Counseling / Confessional Notes).
- Counseling Firewall physically quarantines private confessions, marital counseling, therapy, and addiction notes—completely excluding them from generation prompts to preserve clergy-penitent privilege.

4. Multi-Audience Draft Studio:
- 4 audience-specific generation pipelines with strict redaction constraints:
  * 1. Elder / Board Briefing: Confidential, unvarnished chronology, governance actions, liability notes, and board voting checklist.
  * 2. Staff & Volunteer Holding Lines: 30-second bulleted spoken scripts for greeters and youth leaders, with clear redirection to the designated spokesperson.
  * 3. Sunday Congregation Statement: Spoken pastoral address anchored in Scripture of lament, community prayer, and licensed counseling resources, with zero legal speculation or graphic details.
  * 4. Public & Press Statement with FAQ: Legally vetted holding statement, verified facts only, condolences, zero-fault posture, and official press contact email.
- Real-time Red-line / Tone Critic: Highlights potential legal liability traps or cold corporate tone, offering pastoral-legal suggestions.
- Interactive Media / Lobby Sparring Mode: Practice responding to aggressive questions against the approved holding lines.

Include clean navigation, interactive state toggles (lock gates, scenario switcher, audience tabs), and professional church-appropriate design.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://crisis-com.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a1cc0130-3663-4352-b8dc-7ae8feacfb64).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
