import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const jsonTextList = z.array(z.string().max(4000)).max(100);
const timelineSchema = z
  .array(
    z
      .object({ time: z.string().max(120), detail: z.string().max(4000), verified: z.boolean() })
      .strict(),
  )
  .max(100);

const incidentInput = z
  .object({
    id: z.string().uuid().nullable(),
    churchId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(300),
    situationType: z.string().min(1).max(120),
    intakeNotes: z.string().max(30000),
    confirmedFacts: jsonTextList,
    timeline: timelineSchema,
    confirmedParties: jsonTextList,
    rumors: jsonTextList,
    pastoralGuidance: jsonTextList,
    legalNotes: jsonTextList,
    medicalFamilyDetails: jsonTextList,
    safetyGates: z
      .object({
        emergencyStatus: z.enum(["pending", "contacted", "not_required"]),
        nextOfKinNotified: z.boolean(),
        riskContactNotified: z.boolean(),
        spokesperson: z.string().max(300),
      })
      .strict(),
  })
  .strict();

export const getTeamProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("team_profiles")
      .select("church_id, church_name, leadership_roles, contact_preferences")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Could not load the private church profile.");
    return data;
  });

export const saveTeamProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        churchId: z.string().uuid().nullable().optional(),
        churchName: z.string().max(300),
        leadershipRoles: z
          .array(z.object({ role: z.string().max(120), name: z.string().max(160) }).strict())
          .max(40),
        contactPreferences: z
          .object({
            spokespersonName: z.string().max(160),
            pressEmail: z.string().max(320),
            riskContact: z.string().max(320),
            preferredChannel: z.enum(["email", "phone", "secure_messaging"]),
          })
          .strict(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("team_profiles").upsert({
      user_id: context.userId,
      church_id: data.churchId ?? null,
      church_name: data.churchName,
      leadership_roles: data.leadershipRoles,
      contact_preferences: data.contactPreferences,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save the private church profile.");
    return { ok: true };
  });

export const listIncidentRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("incident_records")
      .select(
        "id, title, situation_type, intake_notes, confirmed_facts, timeline, confirmed_parties, unconfirmed_rumors, pastoral_guidance, legal_notes, medical_family_details, safety_gates, church_id, created_at, updated_at",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Could not load private incident records.");
    return data;
  });

export const saveIncidentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => incidentInput.parse(input))
  .handler(async ({ data, context }) => {
    const baseRecord = {
      church_id: data.churchId ?? null,
      title: data.title,
      situation_type: data.situationType,
      intake_notes: data.intakeNotes,
      confirmed_facts: data.confirmedFacts,
      timeline: data.timeline,
      confirmed_parties: data.confirmedParties,
      unconfirmed_rumors: data.rumors,
      pastoral_guidance: data.pastoralGuidance,
      legal_notes: data.legalNotes,
      medical_family_details: data.medicalFamilyDetails,
      safety_gates: data.safetyGates,
      updated_at: new Date().toISOString(),
    };

    const result = data.id
      ? await context.supabase
          .from("incident_records")
          .update(baseRecord)
          .eq("id", data.id)
          .select("id")
          .single()
      : await context.supabase
          .from("incident_records")
          .insert({ ...baseRecord, owner_id: context.userId })
          .select("id")
          .single();
    if (result.error || !result.data)
      throw new Error("Could not save this private incident record.");
    return { id: result.data.id };
  });

export const deleteIncidentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("incident_records").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this private incident record.");
    return { ok: true };
  });

export const saveCounselingNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        incidentId: z.string().uuid(),
        churchId: z.string().uuid().nullable().optional(),
        note: z.string().min(1).max(30000),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("counseling_vault").insert({
      incident_id: data.incidentId,
      church_id: data.churchId ?? null,
      owner_id: context.userId,
      note: data.note,
    });
    if (error) throw new Error("Could not save this private counseling note.");
    return { ok: true };
  });

export const updateCounselingNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        noteId: z.string().uuid(),
        note: z.string().min(1).max(30000),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("counseling_vault")
      .update({ note: data.note, updated_at: new Date().toISOString() })
      .eq("id", data.noteId);
    if (error) throw new Error("Could not update this private counseling note.");
    return { ok: true };
  });

export const deleteCounselingNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ noteId: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("counseling_vault")
      .delete()
      .eq("id", data.noteId);
    if (error) throw new Error("Could not delete this private counseling note.");
    return { ok: true };
  });

export const listCounselingNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ incidentId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: notes, error } = await context.supabase
      .from("counseling_vault")
      .select("id, note, created_at")
      .eq("incident_id", data.incidentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load private counseling notes.");
    return notes;
  });

export const getChurchWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: churches, error: churchError } = await context.supabase
      .from("churches")
      .select("id, name, created_by, created_at")
      .order("created_at", { ascending: true })
      .limit(1);
    if (churchError) throw new Error("Could not load church workspace.");
    const church = churches?.[0] ?? null;
    if (!church) return { church: null, members: [], myRole: null as string | null };

    const { data: members, error: memberError } = await context.supabase
      .from("church_members")
      .select("id, church_id, user_id, email, role, created_at")
      .eq("church_id", church.id)
      .order("created_at", { ascending: true });
    if (memberError) throw new Error("Could not load church members.");

    const mine = members?.find((member) => member.user_id === context.userId);
    const myRole = mine?.role ?? (church.created_by === context.userId ? "executive" : null);
    return { church, members: members ?? [], myRole };
  });

export const createChurchWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ name: z.string().trim().min(1).max(200), email: z.string().max(320) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: church, error } = await context.supabase
      .from("churches")
      .insert({ name: data.name, created_by: context.userId })
      .select("id, name, created_by, created_at")
      .single();
    if (error || !church) throw new Error("Could not create church workspace.");

    await context.supabase.from("church_members").insert({
      church_id: church.id,
      user_id: context.userId,
      email: data.email || "owner@church.local",
      role: "executive",
    });

    await context.supabase
      .from("team_profiles")
      .update({
        church_id: church.id,
        church_name: data.name,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);

    return church;
  });

export const addChurchMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        churchId: z.string().uuid(),
        userId: z.string().uuid(),
        email: z.string().trim().email().max(320),
        role: z.enum(["executive", "elders", "pastoral", "volunteers"]),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("church_members").insert({
      church_id: data.churchId,
      user_id: data.userId,
      email: data.email,
      role: data.role,
    });
    if (error) throw new Error("Could not add church member. Verify the User ID and permissions.");
    return { ok: true };
  });

export const updateChurchMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        role: z.enum(["executive", "elders", "pastoral", "volunteers"]),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("church_members")
      .update({ role: data.role })
      .eq("id", data.memberId);
    if (error) throw new Error("Could not update member role.");
    return { ok: true };
  });

export const removeChurchMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("church_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw new Error("Could not remove church member.");
    return { ok: true };
  });

export const listAudienceDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ incidentId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: drafts, error } = await context.supabase
      .from("audience_drafts")
      .select(
        "id, audience, draft_text, origin, recipient_tier, confidentiality_acknowledged, approved_by, approved_at, updated_at",
      )
      .eq("incident_id", data.incidentId);
    if (error) throw new Error("Could not load saved audience drafts.");
    return drafts ?? [];
  });

export const saveAudienceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        incidentId: z.string().uuid(),
        churchId: z.string().uuid().nullable().optional(),
        audience: z.enum(["board", "staff", "congregation", "press"]),
        draftText: z.string().max(30000),
        origin: z.enum(["fictional", "ai", "edited"]),
        recipientTier: z.enum(["executive", "elders", "pastoral", "volunteers"]),
        confidentialityAcknowledged: z.boolean(),
        approvedBy: z.string().max(300).nullable(),
        approvedAt: z.string().nullable(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("audience_drafts").upsert(
      {
        incident_id: data.incidentId,
        church_id: data.churchId ?? null,
        owner_id: context.userId,
        audience: data.audience,
        draft_text: data.draftText,
        origin: data.origin,
        recipient_tier: data.recipientTier,
        confidentiality_acknowledged: data.confidentialityAcknowledged,
        approved_by: data.approvedBy,
        approved_at: data.approvedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "incident_id,audience" },
    );
    if (error) throw new Error("Could not save audience draft.");
    return { ok: true };
  });

export const getMonthlyApprovedCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const { count, error } = await context.supabase
      .from("audience_drafts")
      .select("id", { count: "exact", head: true })
      .not("approved_at", "is", null)
      .gte("approved_at", startOfMonth.toISOString());
    if (error) return { count: 0 };
    return { count: count ?? 0 };
  });
