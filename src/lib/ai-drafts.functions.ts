import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { critiqueDraft, getDraftBlockers, type IncidentRecord } from "@/lib/graceguard";

const draftInput = z
  .object({
    audience: z.enum(["board", "staff", "congregation", "press"]),
    title: z.string().min(1).max(300),
    situationType: z.string().min(1).max(120),
    verifiedFacts: z.array(z.string().max(4000)).max(100),
    timeline: z
      .array(
        z
          .object({
            time: z.string().max(120),
            detail: z.string().max(4000),
            verified: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    confirmedParties: z.array(z.string().max(300)).max(100),
    unconfirmedRumors: z.array(z.string().max(4000)).max(100),
    pastoralGuidance: z.array(z.string().max(4000)).max(100),
    legalRiskNotes: z.array(z.string().max(4000)).max(100),
    emergencyServicesStatus: z.enum(["pending", "contacted", "not_required"]),
    nextOfKinNotified: z.boolean(),
    riskContactNotified: z.boolean(),
    spokesperson: z.string().max(300),
    churchName: z.string().max(300),
    officialPressContact: z.string().max(320),
    recipientTier: z.enum(["executive", "elders", "pastoral", "volunteers"]),
    confidentialityAcknowledged: z.literal(true),
  })
  .strict();

const AUDIENCE_RULES = {
  board:
    "Create a confidential, unvarnished chronology, governance actions, only the supplied liability notes, and a clear board voting checklist. Label unverified claims prominently as unverified. Do not infer fault or guilt.",
  staff:
    "Write a 30-second spoken script in short bullets for greeters and youth leaders. Give one calm line, a brief care statement, and a clear redirection to the designated spokesperson. No names, graphic detail, legal analysis, or unverified claims.",
  congregation:
    "Write a spoken pastoral address grounded in Psalm 34:18 as a scripture of lament. Include community prayer and licensed counseling resources. Use only verified facts; include no legal speculation, blame, graphic detail, or identifying medical or family information.",
  press:
    "Write a legally cautious holding statement followed by four concise FAQ answers. Use only verified facts, express condolences where appropriate, take a zero-fault posture, and include the supplied official press contact. Never invent an email address or speculate about cause, responsibility, or liability.",
} as const;

function safeGatewayMessage(error: unknown): string {
  if (error == null || typeof error !== "object")
    return "The draft could not be generated. Your case details are unchanged.";
  const record = error as { message?: unknown; statusCode?: unknown; responseBody?: unknown };
  let message = typeof record.message === "string" ? record.message : "";
  if (typeof record.responseBody === "string") {
    try {
      const body = JSON.parse(record.responseBody) as {
        error?: { message?: unknown };
        message?: unknown;
      };
      const upstream = body.error?.message ?? body.message;
      if (typeof upstream === "string") message = upstream;
    } catch {
      // Keep the SDK's safe message when the response body is not JSON.
    }
  }
  const status = typeof record.statusCode === "number" ? record.statusCode : undefined;
  if (status === 401)
    return message || "Meta Model API rejected the connected key. Your case details are unchanged.";
  if (status === 402 || status === 403) {
    return (
      message ||
      "AI drafting is currently unavailable for this workspace. Your case details are unchanged."
    );
  }
  if (status === 404)
    return message || "The requested drafting service is unavailable. No draft was produced.";
  return message || "The draft could not be generated. Your case details are unchanged.";
}

async function runMetaModelPrompt(instructions: string, userPayload: unknown): Promise<string> {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["UDC_META_MODEL_API_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) {
    throw new Error("The secure Meta Model API connection is not configured for this workspace.");
  }
  const request = getRequest();
  if (!request) throw new Error("The secure draft request could not be started.");

  try {
    const { createMetaModelCall } = await import("@/lib/ai/meta-model.server");
    const { result } = createMetaModelCall(
      request,
      { lovableApiKey, connectionApiKey },
      [{ role: "user", content: JSON.stringify(userPayload) }],
      instructions,
    );
    const text = await result.text;
    const finishReason = await result.finishReason;
    if (finishReason === "content-filter")
      throw new Error("This request was blocked. No draft was produced.");
    if (!text.trim())
      throw new Error("The drafting service returned no text. No draft was produced.");
    return text;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("blocked"))
    )
      throw error;
    throw new Error(safeGatewayMessage(error));
  }
}

export const generateAudienceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => draftInput.parse(input))
  .handler(async ({ data }) => {
    const incident: IncidentRecord = {
      id: null,
      isDemo: false,
      title: data.title,
      situationType: data.situationType as IncidentRecord["situationType"],
      intakeNotes: "",
      confirmedFacts: data.verifiedFacts,
      timeline: data.timeline,
      confirmedParties: data.confirmedParties,
      rumors: data.unconfirmedRumors,
      pastoralGuidance: data.pastoralGuidance,
      legalNotes: data.legalRiskNotes,
      medicalFamilyDetails: [],
      emergencyStatus: data.emergencyServicesStatus,
      nextOfKinNotified: data.nextOfKinNotified,
      riskContactNotified: data.riskContactNotified,
      spokesperson: data.spokesperson,
    };
    const blockers = getDraftBlockers(data.audience, incident, {
      recipientTier: data.recipientTier,
      confidentialityAcknowledged: data.confidentialityAcknowledged,
    });
    if (blockers.length > 0) throw new Error(blockers.join(" "));

    const instructions = [
      "You are GraceGuard, a careful crisis communications copilot for churches and ministries.",
      "This is a draft for human review, not legal, medical, or pastoral-care advice. Do not invent facts, identities, contact details, or actions.",
      "Keep confirmed facts distinct from unknowns. Never admit fault, assign blame, state liability, or turn rumor into fact.",
      "Never include names or identifying medical/family details about minors or vulnerable people.",
      "The counseling/confessional layer is quarantined and is not available to you. Do not ask for or infer private counseling notes.",
      "Recipient group: " + data.recipientTier + ". Confidentiality acknowledgment: confirmed.",
      "Audience requirements: " + AUDIENCE_RULES[data.audience],
      "Use the provided official press contact exactly when supplied. If absent, write [official press contact]; never fabricate one.",
      "Return a polished, clearly labeled draft with no preamble about being an AI.",
    ].join("\n");

    const safeContext = {
      audience: data.audience,
      incidentTitle: data.title,
      situationType: data.situationType,
      churchName: data.churchName,
      verifiedFacts: data.verifiedFacts,
      timeline: data.timeline,
      confirmedParties: data.confirmedParties,
      unconfirmedRumors: data.audience === "board" ? data.unconfirmedRumors : [],
      pastoralGuidance: data.pastoralGuidance,
      legalRiskNotes: data.audience === "board" ? data.legalRiskNotes : [],
      emergencyServicesStatus: data.emergencyServicesStatus,
      nextOfKinNotified: data.nextOfKinNotified,
      riskContactNotified: data.riskContactNotified,
      spokesperson: data.spokesperson,
      officialPressContact: data.audience === "press" ? data.officialPressContact : "",
    };

    const text = await runMetaModelPrompt(instructions, safeContext);
    return { text, warnings: critiqueDraft(text) };
  });

export const reviseDraftForSafety = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        audience: z.enum(["board", "staff", "congregation", "press"]),
        draftText: z.string().min(1).max(20000),
        flags: z.array(z.string().max(500)).max(20),
        verifiedFacts: z.array(z.string().max(4000)).max(100),
        spokesperson: z.string().max(300),
        officialPressContact: z.string().max(320),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const instructions = [
      "You are GraceGuard's pastoral-legal copy editor.",
      "Revise the supplied draft to resolve every listed red-line or tone warning while preserving care, warmth, and all verified facts.",
      "Remove admissions of fault, liability guarantees, unverified claims (unless clearly marked unconfirmed in a board briefing), cold corporate phrasing, and identifying medical or minor details.",
      "Do not invent facts or contact details. Never ask for or infer private counseling notes.",
      "Audience requirements: " + AUDIENCE_RULES[data.audience],
      "Return only the revised draft text with no commentary.",
    ].join("\n");

    const text = await runMetaModelPrompt(instructions, {
      audience: data.audience,
      warningsToResolve: data.flags,
      verifiedFacts: data.verifiedFacts,
      spokesperson: data.spokesperson,
      officialPressContact: data.audience === "press" ? data.officialPressContact : "",
      draftText: data.draftText,
    });
    return { text };
  });

const triageResultSchema = z.object({
  confirmedFacts: z.array(z.string().max(4000)).max(100),
  timeline: z
    .array(
      z
        .object({
          time: z.string().max(120),
          detail: z.string().max(4000),
          verified: z.boolean(),
        })
        .strict(),
    )
    .max(100),
  confirmedParties: z.array(z.string().max(300)).max(100),
  rumors: z.array(z.string().max(4000)).max(100),
});

export const triageIntakeNotesWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        situationType: z.string().min(1).max(120),
        intakeNotes: z.string().min(1).max(30000),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const instructions = [
      "You organize unstructured church incident notes into strict JSON without inventing facts.",
      'Return ONLY valid JSON matching: {"confirmedFacts": string[], "timeline": [{"time": string, "detail": string, "verified": boolean}], "confirmedParties": string[], "rumors": string[]}.',
      "Only place claims explicitly stated as confirmed or directly observed into confirmedFacts and verified: true timeline entries.",
      "Place secondhand reports, social media claims, speculation, or uncertain details into rumors and set timeline verified: false.",
      "Omit any private counseling, confessional, or therapy details—never include them.",
    ].join("\n");

    const raw = await runMetaModelPrompt(instructions, {
      situationType: data.situationType,
      intakeNotes: data.intakeNotes,
    });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      throw new Error(
        "Smart triage did not return structured JSON. Use Merge into layers instead.",
      );
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("Smart triage returned invalid JSON. Use Merge into layers instead.");
    }
    return triageResultSchema.parse(parsed);
  });

export const coachSparringResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        situationType: z.string().min(1).max(120),
        question: z.string().min(1).max(1000),
        response: z.string().min(1).max(5000),
        verifiedFacts: z.array(z.string().max(4000)).max(100),
        spokesperson: z.string().max(300),
        holdingLine: z.string().max(4000),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const instructions = [
      "You are GraceGuard's media & lobby sparring coach for church leaders.",
      "Evaluate the user's spoken response against the question, verified facts, and holding line.",
      "Return 3 to 4 short bullet points starting with '• ' covering: (1) pastoral warmth, (2) accuracy & rumor/privacy boundaries, (3) liability posture, and (4) a cleaner 1-2 sentence suggested spoken phrasing redirecting to the spokesperson if needed.",
      "Never invent facts or infer private counseling/medical details.",
    ].join("\n");

    const feedback = await runMetaModelPrompt(instructions, data);
    const lines = feedback
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
    return {
      notes: lines.length
        ? lines
        : ["Coaching completed. Keep your response brief and compassionate."],
    };
  });
