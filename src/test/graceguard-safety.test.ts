import { describe, expect, it } from "vitest";

import {
  buildDraftPayload,
  createBlankIncident,
  createInitialDraftsMap,
  critiqueDraft,
  DEMO_SCENARIOS,
  formatAudienceExport,
  getApprovalBlockers,
  getDraftBlockers,
  hasBlockingRedLines,
  INCIDENT_TYPES,
  mergeStructuredIntake,
  parseIntakeNotes,
  resolveSpokesperson,
  reviewSparringResponse,
  SPARRING_QUESTIONS_BY_TYPE,
  type Audience,
  type TeamProfileData,
} from "@/lib/graceguard";

const demo = DEMO_SCENARIOS[0];
if (!demo) throw new Error("The youth-accident demo scenario is required for safety tests.");

const profile: TeamProfileData = {
  churchName: "Test Ministry",
  leadershipRoles: [],
  contactPreferences: {
    spokespersonName: "Communications lead",
    pressEmail: "",
    riskContact: "",
    preferredChannel: "email",
  },
};

const clearedGate = { recipientTier: "elders" as const, confidentialityAcknowledged: true };
const audiences: Audience[] = ["board", "staff", "congregation", "press"];

describe("GraceGuard safety gates and draft boundaries", () => {
  it("holds every audience while emergency services status is pending", () => {
    const blockers = getDraftBlockers(
      "board",
      { ...demo, emergencyStatus: "pending" },
      clearedGate,
    );
    expect(blockers).toContain(
      "Confirm whether emergency services or 911 have been contacted or are not required.",
    );
  });

  it("holds public drafts until next of kin and the risk contact are notified", () => {
    const incident = { ...demo, nextOfKinNotified: false, riskContactNotified: false };
    const blockers = getDraftBlockers("press", incident, clearedGate);
    expect(blockers).toContain(
      "Notify next of kin or parents before any church or public statement.",
    );
    expect(blockers).toContain("Complete the legal and insurer risk-contact check before release.");
  });

  it("requires both confidentiality acknowledgment and the board's minimum clearance tier", () => {
    const blockers = getDraftBlockers("board", demo, {
      recipientTier: "pastoral",
      confidentialityAcknowledged: false,
    });
    expect(blockers).toContain(
      "Confirm this recipient group's clearance and confidentiality acknowledgment.",
    );
    expect(blockers).toContain("This audience requires at least Governing Elders clearance.");
  });

  it("accepts a designated spokesperson from the church profile when incident spokesperson is empty", () => {
    const incident = { ...demo, spokesperson: "" };
    expect(resolveSpokesperson(incident, profile)).toBe("Communications lead");
    expect(getDraftBlockers("board", incident, clearedGate, profile)).toEqual([]);
  });

  it("keeps medical and family details out of every audience payload", () => {
    const incident = { ...demo, medicalFamilyDetails: ["PRIVATE_MEDICAL_SENTINEL"] };
    for (const audience of audiences) {
      const payload = buildDraftPayload(audience, incident, clearedGate, profile);
      expect(JSON.stringify(payload)).not.toContain("PRIVATE_MEDICAL_SENTINEL");
    }
  });

  it("keeps separate counseling-vault details out of every audience payload", () => {
    const incident = { ...demo, privateCounselingNote: "CONFIDENTIAL_COUNSELING_SENTINEL" };
    for (const audience of audiences) {
      const payload = buildDraftPayload(audience, incident, clearedGate, profile);
      expect(JSON.stringify(payload)).not.toContain("CONFIDENTIAL_COUNSELING_SENTINEL");
    }
  });

  it("sends rumors and legal notes only to the internal board audience", () => {
    const board = buildDraftPayload("board", demo, clearedGate, profile);
    expect(board.unconfirmedRumors).toEqual(demo.rumors);
    expect(board.legalRiskNotes).toEqual(demo.legalNotes);

    for (const audience of ["staff", "congregation", "press"] as const) {
      const payload = buildDraftPayload(audience, demo, clearedGate, profile);
      expect(payload.unconfirmedRumors).toEqual([]);
      expect(payload.legalRiskNotes).toEqual([]);
    }
  });
});

describe("GraceGuard intake parsing, red-line review, and sparring", () => {
  it("parses prefixed and unlabeled intake lines while leaving unlabeled items unverified", () => {
    const parsed = parseIntakeNotes(
      [
        "- Confirmed: Two buses arrived safely.",
        "Parties: Youth pastor and bus driver",
        "Rumor: Someone saw smoke near the exit.",
        "9:15 AM — Parents called for pickup.",
        "Check campus gate lock.",
      ].join("\n"),
    );

    expect(parsed.confirmedFacts).toEqual(["Two buses arrived safely."]);
    expect(parsed.confirmedParties).toEqual(["Youth pastor and bus driver"]);
    expect(parsed.rumors).toEqual(["Someone saw smoke near the exit."]);
    expect(parsed.timeline).toEqual([
      { time: "9:15 AM", detail: "Parents called for pickup.", verified: false },
      { time: "Needs verification", detail: "Check campus gate lock.", verified: false },
    ]);
  });

  it("merges newly parsed intake items without duplicating or wiping existing edits", () => {
    const current = {
      confirmedFacts: ["Two buses arrived safely."],
      timeline: [{ time: "9:15 AM", detail: "Parents called for pickup.", verified: true }],
      confirmedParties: ["Youth pastor"],
      rumors: [],
    };
    const extracted = {
      confirmedFacts: ["two buses arrived safely.", "All students accounted for."],
      timeline: [
        { time: "9:15 AM", detail: "Parents called for pickup.", verified: false },
        { time: "9:30 AM", detail: "First responders cleared scene.", verified: false },
      ],
      confirmedParties: ["Youth pastor", "Lead chaperone"],
      rumors: ["Unverified social post"],
    };

    const { merged, addedCount } = mergeStructuredIntake(current, extracted);
    expect(addedCount).toBe(4);
    expect(merged.confirmedFacts).toEqual([
      "Two buses arrived safely.",
      "All students accounted for.",
    ]);
    expect(merged.timeline[0]?.verified).toBe(true);
    expect(merged.timeline).toHaveLength(2);
    expect(merged.confirmedParties).toEqual(["Youth pastor", "Lead chaperone"]);
    expect(merged.rumors).toEqual(["Unverified social post"]);
  });

  it("flags liability, rumors, cold tone, and identifying student/medical details", () => {
    const flags = critiqueDraft(
      "We are at fault. People are saying student Alex was admitted to ICU. No comment.",
    );
    expect(flags.length).toBe(5);
  });

  it("provides situation-specific sparring questions for every incident type and checks redirects", () => {
    for (const type of INCIDENT_TYPES) {
      expect(SPARRING_QUESTIONS_BY_TYPE[type].length).toBeGreaterThanOrEqual(5);
    }

    const incident = createBlankIncident("Pastoral Misconduct / Staff Transition");
    const incomplete = reviewSparringResponse("We have no comment on that.", incident, profile);
    expect(incomplete.some((line) => line.includes("Communications lead"))).toBe(true);
    expect(incomplete.some((line) => line.includes("Tone may feel cold"))).toBe(true);
    expect(incomplete.some((line) => line.includes("human care"))).toBe(true);

    const grounded = reviewSparringResponse(
      "We are grieving with everyone affected and praying for all families. Please direct follow-up questions to our designated spokesperson at the church office.",
      incident,
      profile,
    );
    expect(grounded[0]).toContain("aligned with holding boundaries");
  });
});

describe("GraceGuard approvals and export formatting", () => {
  it("blocks release approval when draft text is empty or has severe red-line flags", () => {
    expect(getApprovalBlockers("board", demo, clearedGate, "", profile)).toContain(
      "Prepare or generate a draft before marking it approved.",
    );
    expect(hasBlockingRedLines("We accept liability for this incident.")).toBe(true);
    expect(
      getApprovalBlockers(
        "board",
        demo,
        clearedGate,
        "We accept liability for this incident.",
        profile,
      ),
    ).toContain("Resolve red-line liability, rumor, or privacy flags before approval.");
    expect(
      getApprovalBlockers(
        "board",
        demo,
        clearedGate,
        "We are caring for families and confirming facts.",
        profile,
      ),
    ).toEqual([]);
  });

  it("formats exports with approval status or unapproved warning and initializes all four audience tabs", () => {
    const drafts = createInitialDraftsMap(demo, profile);
    expect(Object.keys(drafts)).toEqual(["board", "staff", "congregation", "press"]);
    expect(drafts.press.text).toContain("FICTIONAL PUBLIC HOLDING STATEMENT");

    const unapproved = formatAudienceExport("press", "Holding statement body", demo, profile, null);
    expect(unapproved).toContain("UNAPPROVED DRAFT");
    expect(unapproved).toContain("Communications lead");

    const approved = formatAudienceExport("board", "Board summary", demo, profile, {
      approvedBy: "Elder Chair",
      approvedAt: "2026-11-26T16:00:00.000Z",
    });
    expect(approved).toContain("APPROVED FOR RELEASE · Reviewed by Elder Chair");
  });
});
