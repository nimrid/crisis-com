import { describe, expect, it } from "vitest";

import {
  buildDraftPayload,
  DEMO_SCENARIOS,
  getDraftBlockers,
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
    const blockers = getDraftBlockers("board", { ...demo, emergencyStatus: "pending" }, clearedGate);
    expect(blockers).toContain("Confirm whether emergency services or 911 have been contacted or are not required.");
  });

  it("holds public drafts until next of kin and the risk contact are notified", () => {
    const incident = { ...demo, nextOfKinNotified: false, riskContactNotified: false };
    const blockers = getDraftBlockers("press", incident, clearedGate);
    expect(blockers).toContain("Notify next of kin or parents before any church or public statement.");
    expect(blockers).toContain("Complete the legal and insurer risk-contact check before release.");
  });

  it("requires both confidentiality acknowledgment and the board's minimum clearance tier", () => {
    const blockers = getDraftBlockers("board", demo, {
      recipientTier: "pastoral",
      confidentialityAcknowledged: false,
    });
    expect(blockers).toContain("Confirm this recipient group's clearance and confidentiality acknowledgment.");
    expect(blockers).toContain("This audience requires at least Governing Elders clearance.");
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