export const INCIDENT_TYPES = [
  "Pastoral Misconduct / Staff Transition",
  "Youth / Student Accident",
  "Sudden Death / Community Tragedy",
  "Legal / Financial / Property Incident",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type Audience = "board" | "staff" | "congregation" | "press";
export type RecipientTier = "executive" | "elders" | "pastoral" | "volunteers";
export type EmergencyStatus = "pending" | "contacted" | "not_required";

export interface TimelineEntry {
  time: string;
  detail: string;
  verified: boolean;
}

export interface IncidentRecord {
  id: string | null;
  isDemo: boolean;
  title: string;
  situationType: IncidentType;
  intakeNotes: string;
  confirmedFacts: string[];
  timeline: TimelineEntry[];
  confirmedParties: string[];
  rumors: string[];
  pastoralGuidance: string[];
  legalNotes: string[];
  medicalFamilyDetails: string[];
  emergencyStatus: EmergencyStatus;
  nextOfKinNotified: boolean;
  riskContactNotified: boolean;
  spokesperson: string;
}

export interface DraftGate {
  recipientTier: RecipientTier;
  confidentialityAcknowledged: boolean;
}

export interface TeamProfileData {
  churchName: string;
  leadershipRoles: { role: string; name: string }[];
  contactPreferences: {
    spokespersonName: string;
    pressEmail: string;
    riskContact: string;
    preferredChannel: "email" | "phone" | "secure_messaging";
  };
}

export interface DraftPayload {
  audience: Audience;
  title: string;
  situationType: IncidentType;
  verifiedFacts: string[];
  timeline: TimelineEntry[];
  confirmedParties: string[];
  unconfirmedRumors: string[];
  pastoralGuidance: string[];
  legalRiskNotes: string[];
  emergencyServicesStatus: EmergencyStatus;
  nextOfKinNotified: boolean;
  riskContactNotified: boolean;
  spokesperson: string;
  churchName: string;
  officialPressContact: string;
  recipientTier: RecipientTier;
  confidentialityAcknowledged: boolean;
}

export const AUDIENCES: { id: Audience; label: string; detail: string }[] = [
  { id: "board", label: "Elder / Board", detail: "Confidential briefing" },
  { id: "staff", label: "Staff & Volunteers", detail: "Holding lines" },
  { id: "congregation", label: "Congregation", detail: "Sunday address" },
  { id: "press", label: "Public & Press", detail: "Statement + FAQ" },
];

export const RECIPIENT_TIERS: { id: RecipientTier; label: string }[] = [
  { id: "executive", label: "Executive Leadership" },
  { id: "elders", label: "Governing Elders" },
  { id: "pastoral", label: "Pastoral Staff" },
  { id: "volunteers", label: "Volunteers" },
];

const makeDemoGates = (): Pick<
  IncidentRecord,
  "emergencyStatus" | "nextOfKinNotified" | "riskContactNotified" | "spokesperson"
> => ({
  emergencyStatus: "contacted",
  nextOfKinNotified: true,
  riskContactNotified: true,
  spokesperson: "Communications lead",
});

export const DEMO_SCENARIOS: IncidentRecord[] = [
  {
    id: null,
    isDemo: true,
    title: "Youth retreat bus accident",
    situationType: "Youth / Student Accident",
    intakeNotes:
      "8:42 AM — confirmed: a retreat bus was involved in a roadway collision.\nConfirmed: two students have minor injuries; adults are with them.\nParty: youth ministry lead and retreat coordinator.\nUnconfirmed: a social post says another vehicle was speeding; no source has verified this.",
    confirmedFacts: [
      "A bus transporting retreat participants was involved in a roadway collision.",
      "Two students have minor injuries; adult leaders are with them.",
    ],
    timeline: [
      { time: "8:42 AM", detail: "Collision reported to retreat leadership.", verified: true },
      {
        time: "8:51 AM",
        detail: "Two minor injuries reported; details are being confirmed.",
        verified: true,
      },
      {
        time: "Unconfirmed",
        detail:
          "A social post makes a claim about another vehicle. Source and claim are unverified.",
        verified: false,
      },
    ],
    confirmedParties: ["Youth ministry lead", "Retreat coordinator"],
    rumors: ["Unverified social post about another vehicle's speed; do not repeat as fact."],
    pastoralGuidance: [
      "Pray for the students, families, and responders.",
      "Offer a clear path to the designated spokesperson and family support contact.",
    ],
    legalNotes: ["Risk contact notified. No cause or fault has been determined."],
    medicalFamilyDetails: ["Two minor injuries reported. No names or diagnoses in this demo."],
    ...makeDemoGates(),
  },
  {
    id: null,
    isDemo: true,
    title: "Pastor transition and unverified report",
    situationType: "Pastoral Misconduct / Staff Transition",
    intakeNotes:
      "9:10 AM — confirmed: the senior pastor submitted a resignation to the board chair.\nConfirmed: governing elders are arranging an interim leadership plan.\nUnconfirmed: a secondhand report alleges misconduct; no finding has been made.\nParty: board chair and interim pastoral team.",
    confirmedFacts: [
      "The senior pastor submitted a resignation to the board chair.",
      "Governing elders are arranging an interim leadership plan.",
    ],
    timeline: [
      { time: "9:10 AM", detail: "Resignation received by board chair.", verified: true },
      { time: "Today", detail: "Elders began planning interim leadership.", verified: true },
      {
        time: "Unconfirmed",
        detail: "Secondhand report has not been verified or assessed.",
        verified: false,
      },
    ],
    confirmedParties: ["Board chair", "Governing elders", "Interim pastoral team"],
    rumors: [
      "Secondhand allegation is unverified; do not repeat, characterize, or imply a finding.",
    ],
    pastoralGuidance: [
      "Make space for grief, uncertainty, and prayer without pressuring anyone to take sides.",
      "Direct confidential pastoral-care requests to an appropriate independent counselor.",
    ],
    legalNotes: ["Risk contact notified. No finding or liability determination is represented."],
    medicalFamilyDetails: [],
    ...makeDemoGates(),
  },
];

export function createBlankIncident(type: IncidentType): IncidentRecord {
  return {
    id: null,
    isDemo: false,
    title: "New incident",
    situationType: type,
    intakeNotes: "",
    confirmedFacts: [],
    timeline: [],
    confirmedParties: [],
    rumors: [],
    pastoralGuidance: [],
    legalNotes: [],
    medicalFamilyDetails: [],
    emergencyStatus: "pending",
    nextOfKinNotified: false,
    riskContactNotified: false,
    spokesperson: "",
  };
}

export function parseIntakeNotes(
  notes: string,
): Pick<IncidentRecord, "confirmedFacts" | "timeline" | "confirmedParties" | "rumors"> {
  const confirmedFacts: string[] = [];
  const timeline: TimelineEntry[] = [];
  const confirmedParties: string[] = [];
  const rumors: string[] = [];

  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*•]\s+/, "");
    if (!line) continue;

    const party = line.match(/^part(?:y|ies)\s*:\s*(.+)$/i);
    if (party?.[1]) {
      confirmedParties.push(party[1].trim());
      continue;
    }

    const rumor = line.match(/^(?:unconfirmed|rumou?r)\s*:\s*(.+)$/i);
    if (rumor?.[1]) {
      rumors.push(rumor[1].trim());
      continue;
    }

    const confirmed = line.match(/^(?:confirmed|verified|fact)\s*:\s*(.+)$/i);
    if (confirmed?.[1]) {
      confirmedFacts.push(confirmed[1].trim());
      continue;
    }

    const timed = line.match(/^(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[—–-]\s*(.+)$/i);
    if (timed?.[1] && timed[2]) {
      timeline.push({ time: timed[1].trim(), detail: timed[2].trim(), verified: false });
      continue;
    }

    timeline.push({ time: "Needs verification", detail: line, verified: false });
  }

  return { confirmedFacts, timeline, confirmedParties, rumors };
}

function mergeUniqueText(
  existing: string[],
  incoming: string[],
): { items: string[]; added: number } {
  const seen = new Set(existing.map((item) => item.trim().toLowerCase()).filter(Boolean));
  const items = [...existing];
  let added = 0;

  for (const entry of incoming) {
    const trimmed = entry.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    items.push(trimmed);
    added += 1;
  }

  return { items, added };
}

function mergeUniqueTimeline(
  existing: TimelineEntry[],
  incoming: TimelineEntry[],
): { items: TimelineEntry[]; added: number } {
  const seen = new Set(
    existing.map(
      (entry) => `${entry.time.trim().toLowerCase()}::${entry.detail.trim().toLowerCase()}`,
    ),
  );
  const items = [...existing];
  let added = 0;

  for (const entry of incoming) {
    const time = entry.time.trim() || "Needs verification";
    const detail = entry.detail.trim();
    const key = `${time.toLowerCase()}::${detail.toLowerCase()}`;
    if (!detail || seen.has(key)) continue;
    seen.add(key);
    items.push({ time, detail, verified: entry.verified });
    added += 1;
  }

  return { items, added };
}

export function mergeStructuredIntake(
  current: Pick<IncidentRecord, "confirmedFacts" | "timeline" | "confirmedParties" | "rumors">,
  extracted: Pick<IncidentRecord, "confirmedFacts" | "timeline" | "confirmedParties" | "rumors">,
): {
  merged: Pick<IncidentRecord, "confirmedFacts" | "timeline" | "confirmedParties" | "rumors">;
  addedCount: number;
} {
  const facts = mergeUniqueText(current.confirmedFacts, extracted.confirmedFacts);
  const timeline = mergeUniqueTimeline(current.timeline, extracted.timeline);
  const parties = mergeUniqueText(current.confirmedParties, extracted.confirmedParties);
  const rumors = mergeUniqueText(current.rumors, extracted.rumors);

  return {
    merged: {
      confirmedFacts: facts.items,
      timeline: timeline.items,
      confirmedParties: parties.items,
      rumors: rumors.items,
    },
    addedCount: facts.added + timeline.added + parties.added + rumors.added,
  };
}

export function resolveSpokesperson(incident: IncidentRecord, profile?: TeamProfileData): string {
  return incident.spokesperson.trim() || profile?.contactPreferences.spokespersonName.trim() || "";
}

const TIER_RANK: Record<RecipientTier, number> = {
  volunteers: 1,
  pastoral: 2,
  elders: 3,
  executive: 4,
};

const MINIMUM_TIER: Record<Audience, RecipientTier> = {
  board: "elders",
  staff: "volunteers",
  congregation: "pastoral",
  press: "elders",
};

export function getDraftBlockers(
  audience: Audience,
  incident: IncidentRecord,
  gate: DraftGate,
  profile?: TeamProfileData,
): string[] {
  const blockers: string[] = [];

  if (incident.emergencyStatus === "pending") {
    blockers.push(
      "Confirm whether emergency services or 911 have been contacted or are not required.",
    );
  }
  if (!resolveSpokesperson(incident, profile)) {
    blockers.push("Designate one spokesperson before preparing outward lines.");
  }
  if (!gate.confidentialityAcknowledged) {
    blockers.push("Confirm this recipient group's clearance and confidentiality acknowledgment.");
  }
  if (TIER_RANK[gate.recipientTier] < TIER_RANK[MINIMUM_TIER[audience]]) {
    blockers.push(
      `This audience requires at least ${RECIPIENT_TIERS.find((tier) => tier.id === MINIMUM_TIER[audience])?.label ?? "leadership"} clearance.`,
    );
  }
  if (audience === "congregation" || audience === "press") {
    if (!incident.nextOfKinNotified)
      blockers.push("Notify next of kin or parents before any church or public statement.");
    if (!incident.riskContactNotified)
      blockers.push("Complete the legal and insurer risk-contact check before release.");
  }

  return blockers;
}

export function buildDraftPayload(
  audience: Audience,
  incident: IncidentRecord,
  gate: DraftGate,
  profile: TeamProfileData,
): DraftPayload {
  const isInternalBoardBrief = audience === "board";
  return {
    audience,
    title: incident.title,
    situationType: incident.situationType,
    verifiedFacts: incident.confirmedFacts,
    timeline: incident.timeline,
    confirmedParties: incident.confirmedParties,
    unconfirmedRumors: isInternalBoardBrief ? incident.rumors : [],
    pastoralGuidance: incident.pastoralGuidance,
    legalRiskNotes: isInternalBoardBrief ? incident.legalNotes : [],
    emergencyServicesStatus: incident.emergencyStatus,
    nextOfKinNotified: incident.nextOfKinNotified,
    riskContactNotified: incident.riskContactNotified,
    spokesperson: resolveSpokesperson(incident, profile),
    churchName: profile.churchName,
    officialPressContact: audience === "press" ? profile.contactPreferences.pressEmail : "",
    recipientTier: gate.recipientTier,
    confidentialityAcknowledged: gate.confidentialityAcknowledged,
  };
}

const LIABILITY_PATTERNS = [
  /we (?:are|were) (?:at fault|responsible|negligent)/i,
  /we caused/i,
  /we failed to/i,
  /we accept liability/i,
  /we guarantee/i,
  /our (?:fault|negligence|mistake)/i,
  /we should have/i,
];

export function critiqueDraft(text: string): string[] {
  const flags: string[] = [];
  if (LIABILITY_PATTERNS.some((pattern) => pattern.test(text))) {
    flags.push(
      "Possible admission or promise: remove fault language and have counsel review before release.",
    );
  }
  if (/rumou?r|allegation|heard that|people are saying|supposedly/i.test(text)) {
    flags.push(
      "Unverified claim detected: omit it or identify it only as unconfirmed in a restricted internal briefing.",
    );
  }
  if (/no comment|stakeholders|incident number|per policy|cannot confirm or deny/i.test(text)) {
    flags.push(
      "Tone may feel cold: lead with care, acknowledge uncertainty, and offer a human contact.",
    );
  }
  if (/\b(?:minor|student|child|teen)\s+[A-Z][a-z]+\b/.test(text)) {
    flags.push(
      "Possible identifying detail about a young person: remove names and re-check family privacy.",
    );
  }
  if (
    /\b(?:diagnosed with|admitted to|intensive care|ICU|hospitalized at|room \d+)\b/i.test(text)
  ) {
    flags.push(
      "Possible private medical detail: keep health and location details off outward communications.",
    );
  }
  if (flags.length === 0)
    flags.push(
      "No obvious red-line phrase found. A designated leader should still review this draft.",
    );
  return flags;
}

export const SPARRING_QUESTIONS_BY_TYPE: Record<IncidentType, string[]> = {
  "Youth / Student Accident": [
    "A parent says: ‘Who was driving, and was the bus safe?’ What do you know right now?",
    "Someone asks: ‘Why are you hiding the names of the students who were hurt?’",
    "A reporter says: ‘A social post blames another driver. Is that what happened?’",
    "A congregant asks: ‘Can you promise this will never happen again?’",
    "A volunteer is pressed for private family or hospital details. How do you respond?",
  ],
  "Pastoral Misconduct / Staff Transition": [
    "A member asks in the lobby: ‘Did the pastor confess to something, or was he forced out?’",
    "Someone says: ‘People are sharing screenshots online—why won’t the elders confirm them?’",
    "A reporter asks: ‘Did the church know about prior complaints and ignore them?’",
    "A small-group leader asks: ‘Should we tell our group to stop talking about this or defend him?’",
    "A donor asks: ‘Was any church money involved, and who is running things on Sunday?’",
  ],
  "Sudden Death / Community Tragedy": [
    "A neighbor asks at the doors: ‘Can you tell me how they died and who was with them?’",
    "A reporter calls asking for a comment on the family’s condition and funeral plans.",
    "A grieving volunteer says: ‘Everyone is asking me what happened—what am I supposed to say?’",
    "Someone asks: ‘Why did God let this happen, and why isn’t the church saying more yet?’",
    "A community member presses for details about surviving children or medical responders.",
  ],
  "Legal / Financial / Property Incident": [
    "A member asks: ‘How much money or property is affected, and was someone arrested?’",
    "A reporter asks: ‘Is the church admitting fault or expecting a lawsuit?’",
    "Someone says: ‘I heard a staff member was responsible—why are they still listed online?’",
    "A deacon asks: ‘Should I tell my Sunday class what the insurance adjuster told us?’",
    "A caller demands immediate records before the board or counsel has completed review.",
  ],
};

export interface DraftApproval {
  approvedBy: string;
  approvedAt: string;
}

export interface AudienceDraftState {
  text: string;
  origin: "fictional" | "ai" | "edited";
  gate: DraftGate;
  approval: DraftApproval | null;
}

const SEVERE_REDLINE_PREFIXES = [
  "Possible admission or promise:",
  "Unverified claim detected:",
  "Possible identifying detail about a young person:",
  "Possible private medical detail:",
];

export function hasBlockingRedLines(text: string): boolean {
  return critiqueDraft(text).some((flag) =>
    SEVERE_REDLINE_PREFIXES.some((prefix) => flag.startsWith(prefix)),
  );
}

export function getApprovalBlockers(
  audience: Audience,
  incident: IncidentRecord,
  gate: DraftGate,
  draftText: string,
  profile?: TeamProfileData,
): string[] {
  const blockers = getDraftBlockers(audience, incident, gate, profile);
  if (!draftText.trim()) {
    blockers.push("Prepare or generate a draft before marking it approved.");
  }
  if (hasBlockingRedLines(draftText)) {
    blockers.push("Resolve red-line liability, rumor, or privacy flags before approval.");
  }
  return blockers;
}

export function getSampleDraft(
  audience: Audience,
  incident: IncidentRecord,
  profile: TeamProfileData,
): string {
  const leadFact =
    incident.confirmedFacts[0] ??
    "We are working to confirm details and will share verified updates.";
  const spokesperson = resolveSpokesperson(incident, profile) || "our designated spokesperson";
  if (audience === "board") {
    return `FICTIONAL BOARD BRIEF\n\nVerified chronology\n${incident.timeline.map((entry) => `${entry.time} — ${entry.detail}${entry.verified ? " [verified]" : " [unconfirmed]"}`).join("\n") || leadFact}\n\nGovernance actions\n• Confirm family communication and care coordination.\n• Keep decisions, owners, and review times in the board record.\n\nRisk review\n${incident.legalNotes.join("\n") || "No risk notes entered."}\n\nBoard checklist\n□ Confirm the interim response owner\n□ Review only verified information\n□ Record the next decision and vote`;
  }
  if (audience === "staff") {
    return `FICTIONAL STAFF HOLDING LINES · ABOUT 30 SECONDS\n\n• We are aware of the situation and are caring for the people affected.\n• ${leadFact}\n• We are sharing only confirmed information and will protect family privacy.\n• Please direct questions to ${spokesperson}; do not speculate or repeat social posts.`;
  }
  if (audience === "congregation") {
    return `FICTIONAL SUNDAY ADDRESS\n\nChurch family, we are holding the people affected in prayer. Psalm 34:18 gives us language for lament and for staying close to those who are hurting.\n\n${leadFact}\n\nWe will share confirmed updates when families have been cared for. Please join us in prayer, and contact the church office for licensed counseling and support resources.`;
  }
  return `FICTIONAL PUBLIC HOLDING STATEMENT\n\nWe are aware of the situation and are caring for those affected. ${leadFact} We are sharing verified information only and respecting the privacy of families. Our thoughts and prayers are with everyone affected.\n\nFAQ\nQ: What happened?\nA: We are confirming details and will share verified information.\n\nQ: Who was affected?\nA: We are protecting personal and family privacy.\n\nQ: Has a cause been determined?\nA: No conclusion is being shared at this time.\n\nQ: Who can I contact?\nA: ${profile.contactPreferences.pressEmail || "[official press contact]"} — ${spokesperson}.`;
}

export function createInitialDraftsMap(
  incident: IncidentRecord,
  profile: TeamProfileData,
): Record<Audience, AudienceDraftState> {
  return {
    board: {
      text: incident.isDemo ? getSampleDraft("board", incident, profile) : "",
      origin: incident.isDemo ? "fictional" : "edited",
      gate: { recipientTier: "elders", confidentialityAcknowledged: false },
      approval: null,
    },
    staff: {
      text: incident.isDemo ? getSampleDraft("staff", incident, profile) : "",
      origin: incident.isDemo ? "fictional" : "edited",
      gate: { recipientTier: "pastoral", confidentialityAcknowledged: false },
      approval: null,
    },
    congregation: {
      text: incident.isDemo ? getSampleDraft("congregation", incident, profile) : "",
      origin: incident.isDemo ? "fictional" : "edited",
      gate: { recipientTier: "pastoral", confidentialityAcknowledged: false },
      approval: null,
    },
    press: {
      text: incident.isDemo ? getSampleDraft("press", incident, profile) : "",
      origin: incident.isDemo ? "fictional" : "edited",
      gate: { recipientTier: "elders", confidentialityAcknowledged: false },
      approval: null,
    },
  };
}

export function formatAudienceExport(
  audience: Audience,
  draftText: string,
  incident: IncidentRecord,
  profile: TeamProfileData,
  approval: DraftApproval | null,
): string {
  const church = profile.churchName.trim() || "GraceGuard Ministry";
  const spokesperson = resolveSpokesperson(incident, profile) || "Designated spokesperson";
  const pressEmail = profile.contactPreferences.pressEmail.trim() || "[official press contact]";
  const statusLine = approval
    ? `APPROVED FOR RELEASE · Reviewed by ${approval.approvedBy} (${new Date(approval.approvedAt).toLocaleString()})`
    : "UNAPPROVED DRAFT · Human review required before release";

  if (audience === "board") {
    return [
      `${church} — CONFIDENTIAL ELDER / BOARD BRIEFING`,
      statusLine,
      `Incident: ${incident.title} (${incident.situationType})`,
      `Safety Checks: 911=${incident.emergencyStatus} | Next-of-kin=${incident.nextOfKinNotified ? "Yes" : "No"} | Risk contact=${incident.riskContactNotified ? "Yes" : "No"} | Spokesperson=${spokesperson}`,
      "",
      draftText.trim(),
    ].join("\n");
  }

  if (audience === "staff") {
    return [
      `${church} — STAFF & VOLUNTEER HOLDING CARD`,
      statusLine,
      `Redirect all media & follow-up inquiries to: ${spokesperson}`,
      "",
      draftText.trim(),
    ].join("\n");
  }

  if (audience === "congregation") {
    return [
      `${church} — CONGREGATION ADDRESS`,
      statusLine,
      "",
      draftText.trim(),
      "",
      `Pastoral & counseling support contact: ${spokesperson}`,
    ].join("\n");
  }

  return [
    `SUBJECT: ${church} — Statement Regarding ${incident.title}`,
    statusLine,
    `Official Press Contact: ${spokesperson} (${pressEmail})`,
    "",
    draftText.trim(),
  ].join("\n");
}

export function reviewSparringResponse(
  response: string,
  incident: IncidentRecord,
  profile?: TeamProfileData,
): string[] {
  const notes = critiqueDraft(response).filter(
    (flag) =>
      flag !==
      "No obvious red-line phrase found. A designated leader should still review this draft.",
  );
  const trimmed = response.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const spokesperson = resolveSpokesperson(incident, profile) || "the designated spokesperson";

  if (!/spokesperson|church office|contact|press@/i.test(trimmed)) {
    notes.push(`Redirect follow-up questions to ${spokesperson}.`);
  }
  if (
    !/\b(?:pray|care|caring|sorry|grief|grieving|support|family|families|compassion|concern|affected|holding)\b/i.test(
      trimmed,
    )
  ) {
    notes.push("Lead with human care and compassion before stating boundaries or redirects.");
  }
  if (words > 85) {
    notes.push(
      `Keep spoken holding lines brief (currently ${words} words; aim for under 75 words / ~30 seconds).`,
    );
  }
  if (notes.length === 0) {
    notes.push(
      "Calm, compassionate, and aligned with holding boundaries. Keep your voice steady and stick to confirmed facts.",
    );
  }
  return notes;
}
