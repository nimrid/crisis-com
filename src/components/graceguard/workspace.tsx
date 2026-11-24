import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  FileText,
  HeartHandshake,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Mic,
  Phone,
  Plus,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCloudAuth } from "@/lib/auth-context";
import { generateAudienceDraft } from "@/lib/ai-drafts.functions";
import {
  AUDIENCES,
  buildDraftPayload,
  createBlankIncident,
  critiqueDraft,
  DEMO_SCENARIOS,
  getDraftBlockers,
  INCIDENT_TYPES,
  parseIntakeNotes,
  RECIPIENT_TIERS,
  type Audience,
  type DraftGate,
  type IncidentRecord,
  type IncidentType,
  type RecipientTier,
  type TeamProfileData,
} from "@/lib/graceguard";
import {
  getTeamProfile,
  listCounselingNotes,
  listIncidentRecords,
  saveCounselingNote,
  saveIncidentRecord,
  saveTeamProfile,
} from "@/lib/workspace.functions";
import type { Database, Json } from "@/integrations/supabase/types";

type WorkspaceView = "incident" | "drafts" | "sparring" | "profile" | "vault";
type IncidentRow = Omit<Database["public"]["Tables"]["incident_records"]["Row"], "owner_id">;
type CounselingRow = Pick<Database["public"]["Tables"]["counseling_vault"]["Row"], "id" | "note" | "created_at">;
type ListField = "confirmedFacts" | "confirmedParties" | "rumors" | "pastoralGuidance" | "legalNotes" | "medicalFamilyDetails";

interface VaultItem {
  id: string;
  note: string;
  created_at: string;
}

const DEFAULT_TYPE: IncidentType = "Youth / Student Accident";
const EMPTY_PROFILE: TeamProfileData = {
  churchName: "",
  leadershipRoles: [],
  contactPreferences: {
    spokespersonName: "",
    pressEmail: "",
    riskContact: "",
    preferredChannel: "email",
  },
};

const NAV_ITEMS: { id: WorkspaceView; label: string; icon: LucideIcon }[] = [
  { id: "incident", label: "Incident desk", icon: Activity },
  { id: "drafts", label: "Draft studio", icon: FileText },
  { id: "sparring", label: "Lobby sparring", icon: MessageSquare },
  { id: "profile", label: "Church profile", icon: Building2 },
  { id: "vault", label: "Counseling vault", icon: LockKeyhole },
];

const SPARRING_QUESTIONS = [
  "A parent says: ‘Who was driving, and was the bus safe?’ What do you know right now?",
  "Someone asks: ‘Why are you hiding the names of the students who were hurt?’",
  "A reporter says: ‘A post blames another driver. Is that what happened?’",
  "A congregant asks: ‘Can you promise this will never happen again?’",
  "A volunteer is pressed for private family details. How do you respond?",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonStringList(value: Json): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseProfile(row: Awaited<ReturnType<typeof getTeamProfile>>): TeamProfileData {
  if (!row) return EMPTY_PROFILE;
  const rawRoles = row.leadership_roles;
  const leadershipRoles = Array.isArray(rawRoles)
    ? rawRoles.flatMap((item) => {
        if (!isRecord(item)) return [];
        const role = item["role"];
        const name = item["name"];
        return typeof role === "string" && typeof name === "string" ? [{ role, name }] : [];
      })
    : [];
  const contacts = isRecord(row.contact_preferences) ? row.contact_preferences : {};
  const channel = contacts["preferredChannel"];
  return {
    churchName: row.church_name,
    leadershipRoles,
    contactPreferences: {
      spokespersonName: typeof contacts["spokespersonName"] === "string" ? contacts["spokespersonName"] : "",
      pressEmail: typeof contacts["pressEmail"] === "string" ? contacts["pressEmail"] : "",
      riskContact: typeof contacts["riskContact"] === "string" ? contacts["riskContact"] : "",
      preferredChannel: channel === "phone" || channel === "secure_messaging" ? channel : "email",
    },
  };
}

function readTimeline(value: Json): IncidentRecord["timeline"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const time = item["time"];
    const detail = item["detail"];
    const verified = item["verified"];
    return typeof time === "string" && typeof detail === "string" && typeof verified === "boolean"
      ? [{ time, detail, verified }]
      : [];
  });
}

function rowToIncident(row: IncidentRow): IncidentRecord {
  const safety = isRecord(row.safety_gates) ? row.safety_gates : {};
  const type = INCIDENT_TYPES.find((item) => item === row.situation_type) ?? DEFAULT_TYPE;
  const emergency = safety["emergencyStatus"];
  return {
    id: row.id,
    isDemo: false,
    title: row.title,
    situationType: type,
    intakeNotes: row.intake_notes,
    confirmedFacts: jsonStringList(row.confirmed_facts),
    timeline: readTimeline(row.timeline),
    confirmedParties: jsonStringList(row.confirmed_parties),
    rumors: jsonStringList(row.unconfirmed_rumors),
    pastoralGuidance: jsonStringList(row.pastoral_guidance),
    legalNotes: jsonStringList(row.legal_notes),
    medicalFamilyDetails: jsonStringList(row.medical_family_details),
    emergencyStatus: emergency === "contacted" || emergency === "not_required" ? emergency : "pending",
    nextOfKinNotified: safety["nextOfKinNotified"] === true,
    riskContactNotified: safety["riskContactNotified"] === true,
    spokesperson: typeof safety["spokesperson"] === "string" ? safety["spokesperson"] : "",
  };
}

function parseLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function listText(value: string[]) {
  return value.join("\n");
}

function sampleDraft(audience: Audience, incident: IncidentRecord, profile: TeamProfileData) {
  const leadFact = incident.confirmedFacts[0] ?? "We are working to confirm details and will share verified updates.";
  const spokesperson = profile.contactPreferences.spokespersonName || incident.spokesperson || "our designated spokesperson";
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

function updateListText(items: string[], index: number, value: string) {
  const next = [...items];
  next[index] = value;
  return next;
}

function asIncidentType(value: string): IncidentType {
  return INCIDENT_TYPES.find((type) => type === value) ?? DEFAULT_TYPE;
}

export default function GraceGuardWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, ready } = useCloudAuth();
  const getTeamProfileFn = useServerFn(getTeamProfile);
  const saveTeamProfileFn = useServerFn(saveTeamProfile);
  const listIncidentRecordsFn = useServerFn(listIncidentRecords);
  const saveIncidentRecordFn = useServerFn(saveIncidentRecord);
  const saveCounselingNoteFn = useServerFn(saveCounselingNote);
  const listCounselingNotesFn = useServerFn(listCounselingNotes);
  const generateAudienceDraftFn = useServerFn(generateAudienceDraft);

  const [activeView, setActiveView] = useState<WorkspaceView>("incident");
  const [workTab, setWorkTab] = useState("intake");
  const [layerTab, setLayerTab] = useState("facts");
  const [scenarioValue, setScenarioValue] = useState("demo-youth");
  const [incident, setIncident] = useState<IncidentRecord>(() => DEMO_SCENARIOS[0] ?? createBlankIncident(DEFAULT_TYPE));
  const [profile, setProfile] = useState<TeamProfileData>(EMPTY_PROFILE);
  const [savedRecords, setSavedRecords] = useState<IncidentRow[]>([]);
  const [draftAudience, setDraftAudience] = useState<Audience>("board");
  const [draftGate, setDraftGate] = useState<DraftGate>({ recipientTier: "elders", confidentialityAcknowledged: false });
  const [draftText, setDraftText] = useState(() => sampleDraft("board", DEMO_SCENARIOS[0] ?? createBlankIncident(DEFAULT_TYPE), EMPTY_PROFILE));
  const [draftOrigin, setDraftOrigin] = useState<"fictional" | "ai" | "edited">("fictional");
  const [draftError, setDraftError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [intakeStructured, setIntakeStructured] = useState(false);
  const [vaultDraft, setVaultDraft] = useState("");
  const [vaultNotes, setVaultNotes] = useState<VaultItem[]>([]);
  const [vaultNotice, setVaultNotice] = useState("");
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [sparringIndex, setSparringIndex] = useState(0);
  const [sparringResponse, setSparringResponse] = useState("");
  const [sparringReview, setSparringReview] = useState<string[]>([]);

  useEffect(() => {
    if (!session) {
      setProfile(EMPTY_PROFILE);
      setSavedRecords([]);
      return;
    }
    let active = true;
    void Promise.all([getTeamProfileFn(), listIncidentRecordsFn()])
      .then(([profileRow, rows]) => {
        if (!active) return;
        setProfile(parseProfile(profileRow));
        setSavedRecords(rows);
      })
      .catch(() => {
        if (active) setNotice("Your private records could not be loaded. Try refreshing before saving.");
      });
    return () => {
      active = false;
    };
  }, [session?.user.id, getTeamProfileFn, listIncidentRecordsFn]);

  useEffect(() => {
    if (activeView !== "vault" || !session || !incident.id || incident.isDemo) {
      setVaultNotes([]);
      return;
    }
    let active = true;
    void listCounselingNotesFn({ data: { incidentId: incident.id } })
      .then((notes: CounselingRow[]) => {
        if (active) setVaultNotes(notes.map((note) => ({ id: note.id, note: note.note, created_at: note.created_at })));
      })
      .catch(() => {
        if (active) setVaultNotice("The private vault could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [activeView, session?.user.id, incident.id, incident.isDemo, listCounselingNotesFn]);

  const activeBlockers = useMemo(
    () => getDraftBlockers(draftAudience, incident, draftGate),
    [draftAudience, incident, draftGate],
  );
  const redLines = useMemo(() => critiqueDraft(draftText), [draftText]);

  function chooseScenario(value: string) {
    setScenarioValue(value);
    setNotice("");
    setDraftError("");
    setIntakeStructured(false);
    const demoIndex = value === "demo-pastor" ? 1 : value === "demo-youth" ? 0 : -1;
    if (demoIndex >= 0) {
      const next = DEMO_SCENARIOS[demoIndex];
      if (!next) return;
      setIncident(next);
      setDraftText(sampleDraft(draftAudience, next, profile));
      setDraftOrigin("fictional");
      return;
    }
    if (value === "new") {
      const next = createBlankIncident(DEFAULT_TYPE);
      setIncident(next);
      setDraftText("");
      setDraftOrigin("edited");
      return;
    }
    const saved = savedRecords.find((row) => row.id === value);
    if (saved) {
      const next = rowToIncident(saved);
      setIncident(next);
      setDraftText("");
      setDraftOrigin("edited");
    }
  }

  function updateIncident<K extends keyof IncidentRecord>(key: K, value: IncidentRecord[K]) {
    setIncident((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function updateListField(field: ListField, text: string) {
    setIncident((current) => ({ ...current, [field]: parseLines(text) }));
  }

  function structureIntake() {
    const extracted = parseIntakeNotes(incident.intakeNotes);
    setIncident((current) => ({ ...current, ...extracted }));
    setIntakeStructured(true);
    setNotice("Notes organized on this device. Unlabeled lines remain unverified.");
  }

  async function saveIncident() {
    if (!session) {
      await navigate({ to: "/auth" });
      return;
    }
    if (incident.isDemo) {
      setNotice("Fictional demo scenarios are not saved as real incident records. Start a new incident to save a case.");
      return;
    }
    setIsSaving(true);
    setNotice("");
    try {
      const saved = await saveIncidentRecordFn({
        data: {
          id: incident.id,
          title: incident.title,
          situationType: incident.situationType,
          intakeNotes: incident.intakeNotes,
          confirmedFacts: incident.confirmedFacts,
          timeline: incident.timeline,
          confirmedParties: incident.confirmedParties,
          rumors: incident.rumors,
          pastoralGuidance: incident.pastoralGuidance,
          legalNotes: incident.legalNotes,
          medicalFamilyDetails: incident.medicalFamilyDetails,
          safetyGates: {
            emergencyStatus: incident.emergencyStatus,
            nextOfKinNotified: incident.nextOfKinNotified,
            riskContactNotified: incident.riskContactNotified,
            spokesperson: incident.spokesperson,
          },
        },
      });
      const next = { ...incident, id: saved.id, isDemo: false };
      setIncident(next);
      setScenarioValue(saved.id);
      const rows = await listIncidentRecordsFn();
      setSavedRecords(rows);
      setNotice("Saved to your private incident records.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this incident.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProfile() {
    if (!session) {
      await navigate({ to: "/auth" });
      return;
    }
    setProfileNotice("");
    try {
      await saveTeamProfileFn({
        data: {
          churchName: profile.churchName,
          leadershipRoles: profile.leadershipRoles.filter((entry) => entry.role.trim() || entry.name.trim()),
          contactPreferences: profile.contactPreferences,
        },
      });
      setProfileNotice("Church profile saved privately.");
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : "Could not save this profile.");
    }
  }

  async function saveVaultNote() {
    if (!session) {
      await navigate({ to: "/auth" });
      return;
    }
    if (!incident.id || incident.isDemo) {
      setVaultNotice("Save a new incident record before adding a private counseling note.");
      return;
    }
    if (!vaultDraft.trim()) {
      setVaultNotice("Write a note before saving.");
      return;
    }
    setIsSavingVault(true);
    setVaultNotice("");
    try {
      await saveCounselingNoteFn({ data: { incidentId: incident.id, note: vaultDraft.trim() } });
      const notes = await listCounselingNotesFn({ data: { incidentId: incident.id } });
      setVaultNotes(notes.map((note) => ({ id: note.id, note: note.note, created_at: note.created_at })));
      setVaultDraft("");
      setVaultNotice("Saved in the separate counseling vault. It is not available to drafting.");
    } catch (error) {
      setVaultNotice(error instanceof Error ? error.message : "Could not save the private note.");
    } finally {
      setIsSavingVault(false);
    }
  }

  async function generateDraft() {
    setDraftError("");
    if (activeBlockers.length > 0) return;
    if (!session) {
      await navigate({ to: "/auth" });
      return;
    }
    setIsGenerating(true);
    try {
      const payload = buildDraftPayload(draftAudience, incident, draftGate, profile);
      const result = await generateAudienceDraftFn({ data: payload });
      setDraftText(result.text);
      setDraftOrigin("ai");
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Draft generation failed. No draft was produced.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyDraft() {
    if (!draftText) return;
    try {
      await navigator.clipboard.writeText(draftText);
      setNotice("Draft copied. Review it with the designated spokesperson before release.");
    } catch {
      setNotice("Copy is unavailable in this browser. Select the draft text to copy it.");
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setActiveView("incident");
    setNotice("Signed out. Fictional demo scenarios remain available.");
  }

  function updateContact<K extends keyof TeamProfileData["contactPreferences"]>(
    key: K,
    value: TeamProfileData["contactPreferences"][K],
  ) {
    setProfile((current) => ({
      ...current,
      contactPreferences: { ...current.contactPreferences, [key]: value },
    }));
  }

  function updateRole(index: number, key: "role" | "name", value: string) {
    setProfile((current) => {
      const roles = [...current.leadershipRoles];
      const row = roles[index];
      if (!row) return current;
      roles[index] = { ...row, [key]: value };
      return { ...current, leadershipRoles: roles };
    });
  }

  function renderFieldEditor(label: string, value: string[], field: ListField, placeholder: string) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Textarea
          value={listText(value)}
          onChange={(event) => updateListField(field, event.target.value)}
          placeholder={placeholder}
          className="min-h-28 bg-background"
        />
        <p className="text-xs text-muted-foreground">One item per line. Keep only details that belong in this layer.</p>
      </div>
    );
  }

  function renderSafetyInterlocks() {
    const publicBlockers = getDraftBlockers("press", incident, draftGate);
    return (
      <section className="border-y border-border bg-muted/30 px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Pause & assess</h2>
                <p className="text-sm text-muted-foreground">Complete response checks before preparing outward messages.</p>
              </div>
            </div>
            <Badge variant={publicBlockers.length === 0 ? "secondary" : "destructive"}>
              {publicBlockers.length === 0 ? "Release checks clear" : `${publicBlockers.length} hold${publicBlockers.length === 1 ? "" : "s"}`}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 border-l-2 border-primary pl-3">
              <Label htmlFor="emergency-status" className="text-sm">Emergency services / 911</Label>
              <Select value={incident.emergencyStatus} onValueChange={(value) => updateIncident("emergencyStatus", value as IncidentRecord["emergencyStatus"])}>
                <SelectTrigger id="emergency-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Not confirmed</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="not_required">Not required — documented</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 border-l-2 border-warning pl-3">
              <div>
                <Label htmlFor="family-notified" className="text-sm">Next of kin / parents</Label>
                <p className="mt-1 text-xs text-muted-foreground">Required before church or public statements.</p>
              </div>
              <Switch id="family-notified" checked={incident.nextOfKinNotified} onCheckedChange={(checked) => updateIncident("nextOfKinNotified", checked)} />
            </div>
            <div className="flex items-center justify-between gap-3 border-l-2 border-warning pl-3">
              <div>
                <Label htmlFor="risk-contacted" className="text-sm">Legal / insurer risk contact</Label>
                <p className="mt-1 text-xs text-muted-foreground">Check before any statement is released.</p>
              </div>
              <Switch id="risk-contacted" checked={incident.riskContactNotified} onCheckedChange={(checked) => updateIncident("riskContactNotified", checked)} />
            </div>
            <div className="space-y-2 border-l-2 border-primary pl-3">
              <Label htmlFor="spokesperson" className="text-sm">Designated spokesperson</Label>
              <Input id="spokesperson" value={incident.spokesperson} onChange={(event) => updateIncident("spokesperson", event.target.value)} placeholder="Name or role" />
            </div>
          </div>
          {publicBlockers.length > 0 && (
            <div className="mt-5 flex items-start gap-2 border-l-2 border-destructive px-3 py-2 text-sm text-destructive" role="status">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{publicBlockers[0]}</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderIncidentDesk() {
    return (
      <>
        <section className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Incident triage</p>
              <h1 className="font-serif text-3xl">A steady first response</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Separate what is known from what is still being confirmed. Keep care, safety, and privacy ahead of speed.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={scenarioValue} onValueChange={chooseScenario}>
                <SelectTrigger className="w-[260px]" aria-label="Choose incident scenario">
                  <SelectValue placeholder="Choose a scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo-youth">Youth retreat bus accident · demo</SelectItem>
                  <SelectItem value="demo-pastor">Pastor transition · demo</SelectItem>
                  <SelectItem value="new">Start a new incident</SelectItem>
                  {savedRecords.length > 0 && <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Saved cases</div>}
                  {savedRecords.map((row) => <SelectItem key={row.id} value={row.id}>{row.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => chooseScenario("new")}>
                <Plus /> New incident
              </Button>
              {incident.isDemo ? (
                <Badge variant="outline" className="h-9 items-center border-warning text-warning-foreground">Fictional demo</Badge>
              ) : (
                <Button onClick={() => void saveIncident()} disabled={isSaving}>
                  {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />} Save case
                </Button>
              )}
            </div>
          </div>

          {notice && <p className="mb-4 border-l-2 border-primary px-3 py-2 text-sm text-muted-foreground" role="status">{notice}</p>}
          <div className="grid gap-4 border-y border-border py-5 sm:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
            <div className="space-y-2">
              <Label htmlFor="incident-title">Incident name</Label>
              <Input id="incident-title" value={incident.title} onChange={(event) => updateIncident("title", event.target.value)} placeholder="Short, internal case title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-type">Situation type</Label>
              <Select value={incident.situationType} onValueChange={(value) => updateIncident("situationType", asIncidentType(value))}>
                <SelectTrigger id="incident-type"><SelectValue /></SelectTrigger>
                <SelectContent>{INCIDENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {renderSafetyInterlocks()}

        <section className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
          <Tabs value={workTab} onValueChange={setWorkTab}>
            <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-md bg-muted/70 p-1">
              <TabsTrigger value="intake">Intake & timeline</TabsTrigger>
              <TabsTrigger value="layers">Information layers</TabsTrigger>
            </TabsList>
            <TabsContent value="intake" className="mt-6">
              <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Notes and voice-memo text</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Paste unstructured notes. Structuring happens on this device.</p>
                    </div>
                    <Mic className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <Textarea
                    value={incident.intakeNotes}
                    onChange={(event) => updateIncident("intakeNotes", event.target.value)}
                    placeholder={'8:42 AM — confirmed: ...\nParty: ...\nUnconfirmed: ...'}
                    className="min-h-56 bg-background"
                  />
                  <Button variant="outline" onClick={structureIntake}>
                    <ClipboardCheck /> Structure notes
                  </Button>
                  {intakeStructured && <p className="text-sm text-success">Notes organized. Unlabeled lines stay unverified.</p>}
                </div>
                <div className="space-y-5">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Clock3Icon />
                      <h2 className="font-semibold">Working chronology</h2>
                    </div>
                    {incident.timeline.length > 0 ? (
                      <ol className="space-y-3 border-l border-border pl-5">
                        {incident.timeline.map((entry, index) => (
                          <li key={`${entry.time}-${index}`} className="relative">
                            <span className="absolute -left-[1.53rem] top-1 grid h-3 w-3 place-items-center rounded-full border border-background bg-primary" />
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-muted-foreground">{entry.time}</span>
                              <Badge variant={entry.verified ? "secondary" : "outline"} className={entry.verified ? "text-success" : "border-warning text-warning-foreground"}>
                                {entry.verified ? "Verified" : "Unconfirmed"}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm">{entry.detail}</p>
                          </li>
                        ))}
                      </ol>
                    ) : <p className="border-l border-border pl-4 text-sm text-muted-foreground">No timeline entries yet. Structure notes to start a chronology.</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="border-t border-border pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Confirmed parties</p>
                      {incident.confirmedParties.length ? <ul className="space-y-1 text-sm">{incident.confirmedParties.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul> : <p className="text-sm text-muted-foreground">None recorded.</p>}
                    </div>
                    <div className="border-t border-warning pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-warning-foreground">Unconfirmed / rumor</p>
                      {incident.rumors.length ? <ul className="space-y-1 text-sm">{incident.rumors.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul> : <p className="text-sm text-muted-foreground">None recorded.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="layers" className="mt-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Need-to-know information layers</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Layer 5 is stored in a separate vault and never enters a drafting request.</p>
                </div>
                <Button variant="outline" onClick={() => setActiveView("vault")}>
                  <LockKeyhole /> Open private vault <ArrowRight />
                </Button>
              </div>
              <Tabs value={layerTab} onValueChange={setLayerTab}>
                <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-md bg-muted/70 p-1">
                  <TabsTrigger value="facts">1 · Verified facts</TabsTrigger>
                  <TabsTrigger value="pastoral">2 · Pastoral guidance</TabsTrigger>
                  <TabsTrigger value="legal">3 · Legal / liability</TabsTrigger>
                  <TabsTrigger value="family">4 · Medical / family</TabsTrigger>
                </TabsList>
                <TabsContent value="facts" className="mt-5 grid gap-6 lg:grid-cols-2">
                  {renderFieldEditor("Verified baseline facts", incident.confirmedFacts, "confirmedFacts", "Only confirmed information…")}
                  {renderFieldEditor("Confirmed parties / roles", incident.confirmedParties, "confirmedParties", "Names or roles needed for response…")}
                  <div className="lg:col-span-2">{renderFieldEditor("Unconfirmed information — internal tracking only", incident.rumors, "rumors", "Label what is unverified; never repeat as fact…")}</div>
                </TabsContent>
                <TabsContent value="pastoral" className="mt-5 max-w-3xl">
                  {renderFieldEditor("Pastoral guidance and prayer points", incident.pastoralGuidance, "pastoralGuidance", "Care needs, prayer, scripture, counseling resources…")}
                </TabsContent>
                <TabsContent value="legal" className="mt-5 max-w-3xl">
                  {renderFieldEditor("Legal strategy and liability notes", incident.legalNotes, "legalNotes", "Restricted internal notes for authorized leadership…")}
                  <p className="mt-3 text-sm text-warning-foreground">Never admit fault or make promises in a draft. Consult the named risk contact before release.</p>
                </TabsContent>
                <TabsContent value="family" className="mt-5 max-w-3xl">
                  {renderFieldEditor("Medical and family details", incident.medicalFamilyDetails, "medicalFamilyDetails", "Restricted care details. Avoid unnecessary identifiers…")}
                  <p className="mt-3 text-sm text-muted-foreground">Detailed family and medical information is excluded from all drafting requests.</p>
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </section>
      </>
    );
  }

  function renderDraftStudio() {
    return (
      <section className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Multi-audience draft studio</p>
            <h1 className="font-serif text-3xl">One incident, four careful voices</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Each audience gets only the information it needs. Every draft remains unapproved until a designated leader reviews it.</p>
          </div>
          <Badge variant="outline" className="border-warning text-warning-foreground">Draft only · human review required</Badge>
        </div>

        <Tabs value={draftAudience} onValueChange={(value) => {
          const next = AUDIENCES.find((item) => item.id === value)?.id;
          if (!next) return;
          setDraftAudience(next);
          setDraftText(incident.isDemo ? sampleDraft(next, incident, profile) : "");
          setDraftOrigin(incident.isDemo ? "fictional" : "edited");
          setDraftError("");
          setDraftGate({ recipientTier: next === "board" || next === "press" ? "elders" : next === "staff" ? "pastoral" : "pastoral", confidentialityAcknowledged: false });
        }}>
          <TabsList className="h-auto w-full flex-wrap justify-start rounded-md bg-muted/70 p-1 sm:w-auto">
            {AUDIENCES.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}
          </TabsList>
          {AUDIENCES.map((item) => <TabsContent key={item.id} value={item.id} className="mt-6">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
              <div className="space-y-6">
                <div className="border-b border-border pb-5">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Selected audience</p>
                  <h2 className="mt-1 text-xl font-semibold">{item.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recipient-tier">Recipient clearance tier</Label>
                    <Select value={draftGate.recipientTier} onValueChange={(value) => setDraftGate((current) => ({ ...current, recipientTier: value as RecipientTier, confidentialityAcknowledged: false }))}>
                      <SelectTrigger id="recipient-tier"><SelectValue /></SelectTrigger>
                      <SelectContent>{RECIPIENT_TIERS.map((tier) => <SelectItem key={tier.id} value={tier.id}>{tier.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-start gap-3 pt-1">
                    <Checkbox
                      id={`confidentiality-${item.id}`}
                      checked={draftGate.confidentialityAcknowledged}
                      onCheckedChange={(checked) => setDraftGate((current) => ({ ...current, confidentialityAcknowledged: checked === true }))}
                      className="mt-1"
                    />
                    <Label htmlFor={`confidentiality-${item.id}`} className="leading-5">I confirm this group has need-to-know clearance and has acknowledged confidentiality.</Label>
                  </div>
                </div>

                {activeBlockers.length > 0 && (
                  <div className="border-l-2 border-warning px-4 py-3" role="status">
                    <div className="flex items-center gap-2 font-medium text-warning-foreground"><LockKeyhole className="h-4 w-4" /> Draft held</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{activeBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
                  </div>
                )}
                {draftError && <p className="border-l-2 border-destructive px-3 py-2 text-sm text-destructive" role="alert">{draftError}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void generateDraft()} disabled={isGenerating || activeBlockers.length > 0}>
                    {isGenerating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                    {isGenerating ? "Preparing draft…" : session ? "Generate with Lovable AI" : "Sign in to generate"}
                  </Button>
                  {draftText && <Button variant="outline" onClick={() => void copyDraft()}><Copy /> Copy draft</Button>}
                </div>
                <p className="text-xs text-muted-foreground">Public and congregation drafts stay locked until next-of-kin and risk-contact checks are complete.</p>
              </div>

              <div className="border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Working draft</h3>
                  </div>
                  <Badge variant={draftOrigin === "ai" ? "secondary" : "outline"}>
                    {draftOrigin === "ai" ? "AI draft · unapproved" : draftOrigin === "fictional" ? "Fictional sample" : "Not approved"}
                  </Badge>
                </div>
                <Textarea
                  value={draftText}
                  onChange={(event) => {
                    setDraftText(event.target.value);
                    setDraftOrigin("edited");
                  }}
                  placeholder="A draft will appear here after generation…"
                  className="min-h-[430px] bg-background font-sans leading-6"
                  aria-label={`${item.label} working draft`}
                />
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-warning-foreground" /> Red-line & tone review</div>
                  <ul className="space-y-2 text-sm text-muted-foreground">{redLines.map((line) => <li key={line} className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" /><span>{line}</span></li>)}</ul>
                </div>
              </div>
            </div>
          </TabsContent>)}
        </Tabs>
      </section>
    );
  }

  function renderSparring() {
    const question = SPARRING_QUESTIONS[sparringIndex] ?? SPARRING_QUESTIONS[0] ?? "What can you confirm?";
    return (
      <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
        <div className="mb-7">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Interactive media / lobby practice</p>
          <h1 className="font-serif text-3xl">Practice the hard question</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Rehearse a calm response against the current holding lines. This practice stays on this device and is not saved.</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="border-y border-border py-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Megaphone className="h-4 w-4" /> Question {sparringIndex + 1} of {SPARRING_QUESTIONS.length}</div>
            <blockquote className="font-serif text-2xl leading-snug">“{question}”</blockquote>
            <Button variant="outline" className="mt-6" onClick={() => {
              setSparringIndex((current) => (current + 1) % SPARRING_QUESTIONS.length);
              setSparringResponse("");
              setSparringReview([]);
            }}>
              Next challenge <ChevronRight />
            </Button>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sparring-response">Your spoken response</Label>
              <Textarea id="sparring-response" value={sparringResponse} onChange={(event) => setSparringResponse(event.target.value)} placeholder="Practice a brief, compassionate answer…" className="mt-2 min-h-36 bg-background" />
            </div>
            <Button onClick={() => {
              const review = critiqueDraft(sparringResponse);
              const needsRedirect = !/spokesperson|church office|contact/i.test(sparringResponse);
              setSparringReview(needsRedirect ? [...review, `Redirect questions to ${incident.spokesperson || "the designated spokesperson"}.`] : review);
            }} disabled={!sparringResponse.trim()}>
              Review my response <ArrowRight />
            </Button>
            {sparringReview.length > 0 && (
              <div className="border-l-2 border-primary px-4 py-3" role="status">
                <p className="mb-2 flex items-center gap-2 font-semibold"><HeartHandshake className="h-4 w-4 text-primary" /> Practice notes</p>
                <ul className="space-y-2 text-sm text-muted-foreground">{sparringReview.map((line) => <li key={line}>• {line}</li>)}</ul>
              </div>
            )}
            <div className="border-t border-border pt-4 text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">Current holding line</p>
              <p>{draftText ? draftText.split("\n").find((line) => line.trim() && !line.toUpperCase().includes("FICTIONAL")) : "Generate or review a holding line in Draft Studio first."}</p>
              <Button variant="link" className="mt-2 h-auto p-0" onClick={() => setActiveView("drafts")}>Open Draft Studio <ArrowRight /></Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderProfile() {
    return (
      <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
        <div className="mb-7">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Private team settings</p>
          <h1 className="font-serif text-3xl">Church & response team</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Keep trusted leadership roles and response contacts ready for future incidents. Only your signed-in account can access this profile.</p>
        </div>
        {!session ? <SignedOutPanel onSignIn={() => void navigate({ to: "/auth" })} /> : (
          <div className="space-y-8">
            <div className="max-w-2xl space-y-2">
              <Label htmlFor="church-name">Church name</Label>
              <Input id="church-name" value={profile.churchName} onChange={(event) => setProfile((current) => ({ ...current, churchName: event.target.value }))} placeholder="Your church or ministry" />
            </div>
            <div className="border-t border-border pt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Leadership team roles</h2>
                  <p className="mt-1 text-sm text-muted-foreground">List a role and the person who currently fills it.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setProfile((current) => ({ ...current, leadershipRoles: [...current.leadershipRoles, { role: "", name: "" }] }))}>
                  <Plus /> Add role
                </Button>
              </div>
              <div className="space-y-3">
                {profile.leadershipRoles.map((entry, index) => (
                  <div key={`role-${index}`} className="grid gap-3 sm:grid-cols-[1fr_1fr_2.5rem]">
                    <Input aria-label={`Leadership role ${index + 1}`} value={entry.role} onChange={(event) => updateRole(index, "role", event.target.value)} placeholder="Role — e.g. Board chair" />
                    <Input aria-label={`Person for role ${index + 1}`} value={entry.name} onChange={(event) => updateRole(index, "name", event.target.value)} placeholder="Name" />
                    <Button variant="ghost" size="icon" aria-label={`Remove role ${index + 1}`} title="Remove role" onClick={() => setProfile((current) => ({ ...current, leadershipRoles: current.leadershipRoles.filter((_, rowIndex) => rowIndex !== index) }))}><X /></Button>
                  </div>
                ))}
                {profile.leadershipRoles.length === 0 && <p className="text-sm text-muted-foreground">No leadership roles added.</p>}
              </div>
            </div>
            <div className="border-t border-border pt-6">
              <h2 className="font-semibold">Response contacts</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="profile-spokesperson">Designated spokesperson</Label><Input id="profile-spokesperson" value={profile.contactPreferences.spokespersonName} onChange={(event) => updateContact("spokespersonName", event.target.value)} placeholder="Name or role" /></div>
                <div className="space-y-2"><Label htmlFor="press-email">Official press contact email</Label><Input id="press-email" type="email" value={profile.contactPreferences.pressEmail} onChange={(event) => updateContact("pressEmail", event.target.value)} placeholder="[official press contact]" /></div>
                <div className="space-y-2"><Label htmlFor="risk-contact">Legal / insurer risk contact</Label><Input id="risk-contact" value={profile.contactPreferences.riskContact} onChange={(event) => updateContact("riskContact", event.target.value)} placeholder="Risk line, insurer, or counsel" /></div>
                <div className="space-y-2"><Label htmlFor="contact-channel">Preferred contact channel</Label>
                  <Select value={profile.contactPreferences.preferredChannel} onValueChange={(value) => updateContact("preferredChannel", value as TeamProfileData["contactPreferences"]["preferredChannel"])}>
                    <SelectTrigger id="contact-channel"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="secure_messaging">Secure messaging</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <Button onClick={() => void saveProfile()}><Save /> Save church profile</Button>
              {profileNotice && <p className="text-sm text-muted-foreground" role="status">{profileNotice}</p>}
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderVault() {
    return (
      <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
        <div className="mb-7 flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-warning/20 text-warning-foreground"><LockKeyhole className="h-6 w-6" /></div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Layer 5 · separate private record</p>
            <h1 className="font-serif text-3xl">Counseling vault</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Confessional, therapy, marital counseling, and addiction notes remain here. They are stored separately and are never sent to AI drafting.</p>
          </div>
        </div>
        {!session ? <SignedOutPanel onSignIn={() => void navigate({ to: "/auth" })} /> : incident.isDemo || !incident.id ? (
          <div className="border-y border-warning px-4 py-5">
            <p className="font-medium">Save a real incident before adding a private note.</p>
            <p className="mt-1 text-sm text-muted-foreground">Fictional scenarios cannot hold counseling records. Start a new incident and save it first.</p>
            <Button className="mt-4" variant="outline" onClick={() => { chooseScenario("new"); setActiveView("incident"); }}><Plus /> New incident</Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <Label htmlFor="vault-note">Private counseling note · {incident.title}</Label>
              <Textarea id="vault-note" value={vaultDraft} onChange={(event) => setVaultDraft(event.target.value)} placeholder="Confidential pastoral-care notes…" className="min-h-48 bg-background" />
              <Button onClick={() => void saveVaultNote()} disabled={isSavingVault}>{isSavingVault ? <LoaderCircle className="animate-spin" /> : <Save />} Save in private vault</Button>
              {vaultNotice && <p className="text-sm text-muted-foreground" role="status">{vaultNotice}</p>}
              <p className="border-l-2 border-warning px-3 py-2 text-sm text-warning-foreground">Not available to the draft generator. The counseling vault is a separate record.</p>
            </div>
            <div className="border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <h2 className="mb-4 font-semibold">Saved private notes</h2>
              {vaultNotes.length ? <ol className="space-y-4">{vaultNotes.map((note) => <li key={note.id} className="border-b border-border pb-4"><p className="mb-2 text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</p><p className="whitespace-pre-wrap text-sm">{note.note}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">No private notes saved for this incident.</p>}
            </div>
          </div>
        )}
      </section>
    );
  }

  const currentNav = NAV_ITEMS.find((item) => item.id === activeView) ?? NAV_ITEMS[0];
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/20 lg:min-h-screen lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 border-b border-border px-5 py-5">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div>
            <div><p className="font-serif text-lg font-semibold">GraceGuard</p><p className="text-xs text-muted-foreground">Crisis response desk</p></div>
          </div>
          <nav aria-label="Workspace" className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return <Button key={item.id} variant={activeView === item.id ? "secondary" : "ghost"} className="justify-start whitespace-nowrap" onClick={() => setActiveView(item.id)}><Icon /> {item.label}</Button>;
            })}
          </nav>
          <div className="hidden border-t border-border px-5 py-5 text-xs text-muted-foreground lg:block">
            <div className="mb-2 flex items-center gap-2 text-foreground"><LockKeyhole className="h-4 w-4" /> Privacy first</div>
            Layer 5 is physically separate. Drafts include only whitelisted facts and guidance.
          </div>
        </aside>

        <div className="min-w-0">
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>{currentNav?.label ?? "Workspace"}</span><ChevronRight className="h-4 w-4" /><span className="max-w-[14rem] truncate font-medium text-foreground">{incident.title}</span></div>
            <div className="flex items-center gap-2">
              {ready && session ? (
                <>
                  <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground sm:inline">{session.user.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => void signOut()} title="Sign out"><LogOut /> Sign out</Button>
                </>
              ) : <Button asChild variant="outline" size="sm"><Link to="/auth"><LockKeyhole /> Sign in to save</Link></Button>}
            </div>
          </header>

          {activeView === "incident" && renderIncidentDesk()}
          {activeView === "drafts" && renderDraftStudio()}
          {activeView === "sparring" && renderSparring()}
          {activeView === "profile" && renderProfile()}
          {activeView === "vault" && renderVault()}

          <footer className="border-t border-border px-5 py-4 text-center text-xs text-muted-foreground sm:px-8">
            Drafts are not approved for release. Follow your church's safeguarding, reporting, legal, and pastoral-care protocols.
          </footer>
        </div>
      </div>
    </main>
  );
}

function SignedOutPanel({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
      <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Sign in to access private records</p><p className="mt-1 text-sm text-muted-foreground">Your fictional demo stays available without saving case information.</p></div></div>
      <Button onClick={onSignIn}>Sign in <ArrowRight /></Button>
    </div>
  );
}

function Clock3Icon() {
  return <Activity className="h-4 w-4 text-primary" aria-hidden="true" />;
}