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
      { time: "8:51 AM", detail: "Two minor injuries reported; details are being confirmed.", verified: true },
      { time: "Unconfirmed", detail: "A social post makes a claim about another vehicle. Source and claim are unverified.", verified: false },
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
      { time: "Unconfirmed", detail: "Secondhand report has not been verified or assessed.", verified: false },
    ],
    confirmedParties: ["Board chair", "Governing elders", "Interim pastoral team"],
    rumors: ["Secondhand allegation is unverified; do not repeat, characterize, or imply a finding."],
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

export function parseIntakeNotes(notes: string): Pick<
  IncidentRecord,
  "confirmedFacts" | "timeline" | "confirmedParties" | "rumors"
> {
  const confirmedFacts: string[] = [];
  const timeline: TimelineEntry[] = [];
  const confirmedParties: string[] = [];
  const rumors: string[] = [];

  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const party = line.match(/^party\s*:\s*(.+)$/i);
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
): string[] {
  const blockers: string[] = [];

  if (incident.emergencyStatus === "pending") {
    blockers.push("Confirm whether emergency services or 911 have been contacted or are not required.");
  }
  if (!incident.spokesperson.trim()) blockers.push("Designate one spokesperson before preparing outward lines.");
  if (!gate.confidentialityAcknowledged) {
    blockers.push("Confirm this recipient group's clearance and confidentiality acknowledgment.");
  }
  if (TIER_RANK[gate.recipientTier] < TIER_RANK[MINIMUM_TIER[audience]]) {
    blockers.push(`This audience requires at least ${RECIPIENT_TIERS.find((tier) => tier.id === MINIMUM_TIER[audience])?.label ?? "leadership"} clearance.`);
  }
  if (audience === "congregation" || audience === "press") {
    if (!incident.nextOfKinNotified) blockers.push("Notify next of kin or parents before any church or public statement.");
    if (!incident.riskContactNotified) blockers.push("Complete the legal and insurer risk-contact check before release.");
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
    spokesperson: profile.contactPreferences.spokespersonName || incident.spokesperson,
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
];

export function critiqueDraft(text: string): string[] {
  const flags: string[] = [];
  if (LIABILITY_PATTERNS.some((pattern) => pattern.test(text))) {
    flags.push("Possible admission or promise: remove fault language and have counsel review before release.");
  }
  if (/rumou?r|allegation|heard that|people are saying/i.test(text)) {
    flags.push("Unverified claim detected: omit it or identify it only as unconfirmed in a restricted internal briefing.");
  }
  if (/no comment|stakeholders|incident number|per policy/i.test(text)) {
    flags.push("Tone may feel cold: lead with care, acknowledge uncertainty, and offer a human contact.");
  }
  if (/\b(?:minor|student|child)\s+[A-Z][a-z]+\b/.test(text)) {
    flags.push("Possible identifying detail about a young person: remove names and re-check family privacy.");
  }
  if (flags.length === 0) flags.push("No obvious red-line phrase found. A designated leader should still review this draft.");
  return flags;
}