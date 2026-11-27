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
      .select("church_name, leadership_roles, contact_preferences")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load the private church profile.");
    return data;
  });

export const saveTeamProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
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
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Could not load private incident records.");
    return data;
  });

export const saveIncidentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => incidentInput.parse(input))
  .handler(async ({ data, context }) => {
    const record = {
      owner_id: context.userId,
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
          .update(record)
          .eq("id", data.id)
          .eq("owner_id", context.userId)
          .select("id")
          .single()
      : await context.supabase.from("incident_records").insert(record).select("id").single();
    if (result.error || !result.data)
      throw new Error("Could not save this private incident record.");
    return { id: result.data.id };
  });

export const deleteIncidentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("incident_records")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not delete this private incident record.");
    return { ok: true };
  });

export const saveCounselingNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        incidentId: z.string().uuid(),
        note: z.string().min(1).max(30000),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("counseling_vault").insert({
      incident_id: data.incidentId,
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
      .eq("id", data.noteId)
      .eq("owner_id", context.userId);
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
      .eq("id", data.noteId)
      .eq("owner_id", context.userId);
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
      .eq("owner_id", context.userId)
      .eq("incident_id", data.incidentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load private counseling notes.");
    return notes;
  });
