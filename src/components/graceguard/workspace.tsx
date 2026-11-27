import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FileText,
  HeartHandshake,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Mic,
  MicOff,
  Pencil,
  Plus,
  Printer,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { GraceGuardLogo } from "@/components/graceguard/logo";
import { ThemeToggle } from "@/components/graceguard/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useCloudAuth } from "@/lib/auth-context";
import {
  coachSparringResponse,
  generateAudienceDraft,
  generateAudienceDraftStream,
  reviseDraftForSafety,
  triageIntakeNotesWithAI,
} from "@/lib/ai-drafts.functions";
import {
  ACTION_CHECKLISTS_BY_TYPE,
  AUDIENCES,
  buildDraftPayload,
  createBlankIncident,
  createInitialDraftsMap,
  critiqueDraft,
  DEMO_SCENARIOS,
  formatAudienceExport,
  formatFullCrisisPacket,
  getApprovalBlockers,
  getDraftBlockers,
  getSampleDraft,
  hasBlockingRedLines,
  INCIDENT_TYPES,
  mergeStructuredIntake,
  parseIntakeNotes,
  RECIPIENT_TIERS,
  resolveSpokesperson,
  reviewSparringResponse,
  scanLayerLeaks,
  SPARRING_QUESTIONS_BY_TYPE,
  applyDemoSafetyRevision,
  type Audience,
  type AudienceDraftState,
  type DraftGate,
  type IncidentRecord,
  type IncidentType,
  type RecipientTier,
  type TeamProfileData,
  type TimelineEntry,
} from "@/lib/graceguard";
import {
  addChurchMember,
  createChurchWorkspace,
  deleteCounselingNote,
  deleteIncidentRecord,
  getChurchWorkspace,
  getMonthlyApprovedCount,
  getTeamProfile,
  listAudienceDrafts,
  listCounselingNotes,
  listIncidentRecords,
  removeChurchMember,
  saveAudienceDraft,
  saveCounselingNote,
  saveIncidentRecord,
  saveTeamProfile,
  updateChurchMemberRole,
  updateCounselingNote,
} from "@/lib/workspace.functions";
import type { Database, Json } from "@/integrations/supabase/types";

type WorkspaceView = "incident" | "drafts" | "sparring" | "profile" | "vault";
type IncidentRow = Omit<Database["public"]["Tables"]["incident_records"]["Row"], "owner_id">;
type CounselingRow = Pick<
  Database["public"]["Tables"]["counseling_vault"]["Row"],
  "id" | "note" | "created_at"
>;
type ListField =
  | "confirmedFacts"
  | "confirmedParties"
  | "rumors"
  | "pastoralGuidance"
  | "legalNotes"
  | "medicalFamilyDetails";

interface VaultItem {
  id: string;
  note: string;
  created_at: string;
}

type ChurchWorkspaceData = Awaited<ReturnType<typeof getChurchWorkspace>>;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonStringList(value: Json): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
      spokespersonName:
        typeof contacts["spokespersonName"] === "string" ? contacts["spokespersonName"] : "",
      pressEmail: typeof contacts["pressEmail"] === "string" ? contacts["pressEmail"] : "",
      riskContact: typeof contacts["riskContact"] === "string" ? contacts["riskContact"] : "",
      preferredChannel: channel === "phone" || channel === "secure_messaging" ? channel : "email",
      counselingReferral:
        typeof contacts["counselingReferral"] === "string" ? contacts["counselingReferral"] : "",
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
    churchId: row.church_id,
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
    emergencyStatus:
      emergency === "contacted" || emergency === "not_required" ? emergency : "pending",
    nextOfKinNotified: safety["nextOfKinNotified"] === true,
    riskContactNotified: safety["riskContactNotified"] === true,
    spokesperson: typeof safety["spokesperson"] === "string" ? safety["spokesperson"] : "",
  };
}

function parseLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listText(value: string[]) {
  return value.join("\n");
}

function asIncidentType(value: string): IncidentType {
  return INCIDENT_TYPES.find((type) => type === value) ?? DEFAULT_TYPE;
}

export default function GraceGuardWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, ready } = useCloudAuth();
  const userId = session?.user.id;
  const getTeamProfileFn = useServerFn(getTeamProfile);
  const saveTeamProfileFn = useServerFn(saveTeamProfile);
  const listIncidentRecordsFn = useServerFn(listIncidentRecords);
  const saveIncidentRecordFn = useServerFn(saveIncidentRecord);
  const deleteIncidentRecordFn = useServerFn(deleteIncidentRecord);
  const saveCounselingNoteFn = useServerFn(saveCounselingNote);
  const updateCounselingNoteFn = useServerFn(updateCounselingNote);
  const deleteCounselingNoteFn = useServerFn(deleteCounselingNote);
  const listCounselingNotesFn = useServerFn(listCounselingNotes);
  const getChurchWorkspaceFn = useServerFn(getChurchWorkspace);
  const createChurchWorkspaceFn = useServerFn(createChurchWorkspace);
  const addChurchMemberFn = useServerFn(addChurchMember);
  const updateChurchMemberRoleFn = useServerFn(updateChurchMemberRole);
  const removeChurchMemberFn = useServerFn(removeChurchMember);
  const listAudienceDraftsFn = useServerFn(listAudienceDrafts);
  const saveAudienceDraftFn = useServerFn(saveAudienceDraft);
  const getMonthlyApprovedCountFn = useServerFn(getMonthlyApprovedCount);
  const generateAudienceDraftFn = useServerFn(generateAudienceDraft);
  const generateAudienceDraftStreamFn = useServerFn(generateAudienceDraftStream);
  const reviseDraftForSafetyFn = useServerFn(reviseDraftForSafety);
  const triageIntakeNotesWithAIFn = useServerFn(triageIntakeNotesWithAI);
  const coachSparringResponseFn = useServerFn(coachSparringResponse);

  const [activeView, setActiveView] = useState<WorkspaceView>("incident");
  const [workTab, setWorkTab] = useState("intake");
  const [layerTab, setLayerTab] = useState("facts");
  const [scenarioValue, setScenarioValue] = useState("demo-youth");
  const [incident, setIncident] = useState<IncidentRecord>(
    () => DEMO_SCENARIOS[0] ?? createBlankIncident(DEFAULT_TYPE),
  );
  const [profile, setProfile] = useState<TeamProfileData>(EMPTY_PROFILE);
  const [savedRecords, setSavedRecords] = useState<IncidentRow[]>([]);
  const [draftAudience, setDraftAudience] = useState<Audience>("board");
  const [draftsByAudience, setDraftsByAudience] = useState<Record<Audience, AudienceDraftState>>(
    () =>
      createInitialDraftsMap(DEMO_SCENARIOS[0] ?? createBlankIncident(DEFAULT_TYPE), EMPTY_PROFILE),
  );
  const [approverName, setApproverName] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingIncident, setIsDeletingIncident] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isSmartTriaging, setIsSmartTriaging] = useState(false);
  const [isCoachingSparring, setIsCoachingSparring] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [churchWorkspace, setChurchWorkspace] = useState<ChurchWorkspaceData>({
    church: null,
    members: [],
    myRole: null,
  });
  const [monthlyApprovedCount, setMonthlyApprovedCount] = useState(0);
  const [newChurchName, setNewChurchName] = useState("");
  const [memberUserIdInput, setMemberUserIdInput] = useState("");
  const [memberEmailInput, setMemberEmailInput] = useState("");
  const [memberRoleInput, setMemberRoleInput] = useState<RecipientTier>("pastoral");
  const [churchNotice, setChurchNotice] = useState("");
  const [isUpdatingChurch, setIsUpdatingChurch] = useState(false);
  const [intakeStructured, setIntakeStructured] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [dictationSupported, setDictationSupported] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const [checkedActionsByKey, setCheckedActionsByKey] = useState<Record<string, string[]>>({});
  const [showJudgeGuide, setShowJudgeGuide] = useState(true);
  const [pendingScenario, setPendingScenario] = useState<string | null>(null);
  const [confirmDeleteIncident, setConfirmDeleteIncident] = useState(false);
  const [vaultDraft, setVaultDraft] = useState("");
  const [vaultNotes, setVaultNotes] = useState<VaultItem[]>([]);
  const [vaultNotice, setVaultNotice] = useState("");
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);
  const [editingVaultText, setEditingVaultText] = useState("");
  const [deletingVaultId, setDeletingVaultId] = useState<string | null>(null);
  const [sparringIndex, setSparringIndex] = useState(0);
  const [sparringResponse, setSparringResponse] = useState("");
  const [sparringReview, setSparringReview] = useState<string[]>([]);

  const currentDraft = draftsByAudience[draftAudience];
  const draftGate = currentDraft.gate;
  const draftText = currentDraft.text;
  const draftOrigin = currentDraft.origin;
  const draftApproval = currentDraft.approval;

  function updateAudienceDraft(audience: Audience, patch: Partial<AudienceDraftState>) {
    setDraftsByAudience((current) => ({
      ...current,
      [audience]: { ...current[audience], ...patch },
    }));
  }

  function clearAllDraftApprovals() {
    setDraftsByAudience((current) => ({
      board: { ...current.board, approval: null },
      staff: { ...current.staff, approval: null },
      congregation: { ...current.congregation, approval: null },
      press: { ...current.press, approval: null },
    }));
  }

  useEffect(() => {
    if (!userId) {
      setProfile(EMPTY_PROFILE);
      setSavedRecords([]);
      setChurchWorkspace({ church: null, members: [], myRole: null });
      setMonthlyApprovedCount(0);
      return;
    }
    let active = true;
    void Promise.all([
      getTeamProfileFn(),
      listIncidentRecordsFn(),
      getChurchWorkspaceFn(),
      getMonthlyApprovedCountFn(),
    ])
      .then(([profileRow, rows, churchData, monthly]) => {
        if (!active) return;
        setProfile(parseProfile(profileRow));
        setSavedRecords(rows);
        setChurchWorkspace(churchData);
        setMonthlyApprovedCount(monthly.count);
      })
      .catch(() => {
        if (active)
          setNotice("Your private records could not be loaded. Try refreshing before saving.");
      });
    return () => {
      active = false;
    };
  }, [
    userId,
    getTeamProfileFn,
    listIncidentRecordsFn,
    getChurchWorkspaceFn,
    getMonthlyApprovedCountFn,
  ]);

  useEffect(() => {
    if (!userId || !incident.id || incident.isDemo) return;
    let active = true;
    void listAudienceDraftsFn({ data: { incidentId: incident.id } })
      .then((rows) => {
        if (!active || rows.length === 0) return;
        setDraftsByAudience((current) => {
          const next = { ...current };
          for (const row of rows) {
            const audience = AUDIENCES.find((item) => item.id === row.audience)?.id;
            if (!audience) continue;
            const tier = RECIPIENT_TIERS.find((item) => item.id === row.recipient_tier)?.id;
            next[audience] = {
              text: row.draft_text,
              origin: row.origin === "ai" || row.origin === "fictional" ? row.origin : "edited",
              gate: {
                recipientTier: tier ?? current[audience].gate.recipientTier,
                confidentialityAcknowledged: row.confidentiality_acknowledged,
              },
              approval:
                row.approved_by && row.approved_at
                  ? { approvedBy: row.approved_by, approvedAt: row.approved_at }
                  : null,
            };
          }
          return next;
        });
      })
      .catch(() => {
        // Keep in-memory drafts if persisted drafts could not be loaded.
      });
    return () => {
      active = false;
    };
  }, [userId, incident.id, incident.isDemo, listAudienceDraftsFn]);

  useEffect(() => {
    if (activeView !== "vault" || !userId || !incident.id || incident.isDemo) {
      setVaultNotes([]);
      return;
    }
    let active = true;
    void listCounselingNotesFn({ data: { incidentId: incident.id } })
      .then((notes: CounselingRow[]) => {
        if (active)
          setVaultNotes(
            notes.map((note) => ({ id: note.id, note: note.note, created_at: note.created_at })),
          );
      })
      .catch(() => {
        if (active) setVaultNotice("The private vault could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [activeView, userId, incident.id, incident.isDemo, listCounselingNotesFn]);

  useEffect(() => {
    const speechWin = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    setDictationSupported(
      Boolean(speechWin.SpeechRecognition || speechWin.webkitSpeechRecognition),
    );
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (incident.isDemo || !hasUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [incident.isDemo, hasUnsavedChanges]);

  useEffect(() => {
    if (!userId || incident.isDemo || !incident.id || !hasUnsavedChanges || isSaving) return;
    const timer = window.setTimeout(() => {
      void saveIncidentRecordFn({
        data: {
          id: incident.id,
          churchId: incident.churchId ?? churchWorkspace.church?.id ?? null,
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
      })
        .then(() => {
          setHasUnsavedChanges(false);
          setAutoSaveStatus("Auto-saved");
        })
        .catch(() => {
          // Manual save remains available if auto-save fails.
        });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [
    userId,
    incident,
    hasUnsavedChanges,
    isSaving,
    churchWorkspace.church?.id,
    saveIncidentRecordFn,
  ]);

  const activeBlockers = useMemo(
    () => getDraftBlockers(draftAudience, incident, draftGate, profile),
    [draftAudience, incident, draftGate, profile],
  );
  const approvalBlockers = useMemo(
    () => getApprovalBlockers(draftAudience, incident, draftGate, draftText, profile),
    [draftAudience, incident, draftGate, draftText, profile],
  );
  const redLines = useMemo(() => {
    const base = critiqueDraft(draftText);
    const leaks = scanLayerLeaks(draftAudience, draftText, incident);
    if (leaks.length === 0) return base;
    return [
      ...leaks,
      ...base.filter(
        (flag) =>
          flag !==
          "No obvious red-line phrase found. A designated leader should still review this draft.",
      ),
    ];
  }, [draftAudience, draftText, incident]);
  const hasSevereFlags = useMemo(
    () => hasBlockingRedLines(draftText, draftAudience, incident),
    [draftText, draftAudience, incident],
  );
  const approvedCount = useMemo(
    () => AUDIENCES.filter((item) => draftsByAudience[item.id].approval !== null).length,
    [draftsByAudience],
  );
  const sparringQuestions = SPARRING_QUESTIONS_BY_TYPE[incident.situationType];

  function applyScenario(value: string) {
    setScenarioValue(value);
    setNotice("");
    setDraftError("");
    setIntakeStructured("");
    setHasUnsavedChanges(false);
    setSparringIndex(0);
    setSparringResponse("");
    setSparringReview([]);
    setEditingVaultId(null);
    setEditingVaultText("");
    const demoIndex = value === "demo-pastor" ? 1 : value === "demo-youth" ? 0 : -1;
    if (demoIndex >= 0) {
      const next = DEMO_SCENARIOS[demoIndex];
      if (!next) return;
      setIncident(next);
      setDraftsByAudience(createInitialDraftsMap(next, profile));
      return;
    }
    if (value === "new") {
      const blank = createBlankIncident(DEFAULT_TYPE);
      const next: IncidentRecord = {
        ...blank,
        spokesperson: profile.contactPreferences.spokespersonName,
      };
      setIncident(next);
      setDraftsByAudience(createInitialDraftsMap(next, profile));
      return;
    }
    const saved = savedRecords.find((row) => row.id === value);
    if (saved) {
      const next = rowToIncident(saved);
      setIncident(next);
      setDraftsByAudience(createInitialDraftsMap(next, profile));
    }
  }

  function chooseScenario(value: string) {
    if (value === scenarioValue) return;
    if (!incident.isDemo && hasUnsavedChanges) {
      setPendingScenario(value);
      return;
    }
    applyScenario(value);
  }

  function updateIncident<K extends keyof IncidentRecord>(key: K, value: IncidentRecord[K]) {
    setIncident((current) => ({ ...current, [key]: value }));
    if (
      key === "emergencyStatus" ||
      key === "nextOfKinNotified" ||
      key === "riskContactNotified" ||
      key === "spokesperson"
    ) {
      clearAllDraftApprovals();
    }
    if (!incident.isDemo) setHasUnsavedChanges(true);
    setNotice("");
  }

  function updateListField(field: ListField, text: string) {
    setIncident((current) => ({ ...current, [field]: parseLines(text) }));
    if (!incident.isDemo) setHasUnsavedChanges(true);
  }

  function updateTimelineEntry(index: number, patch: Partial<TimelineEntry>) {
    setIncident((current) => ({
      ...current,
      timeline: current.timeline.map((entry, rowIndex) =>
        rowIndex === index ? { ...entry, ...patch } : entry,
      ),
    }));
    if (!incident.isDemo) setHasUnsavedChanges(true);
  }

  function addTimelineEntry() {
    setIncident((current) => ({
      ...current,
      timeline: [...current.timeline, { time: "Needs verification", detail: "", verified: false }],
    }));
    if (!incident.isDemo) setHasUnsavedChanges(true);
  }

  function removeTimelineEntry(index: number) {
    setIncident((current) => ({
      ...current,
      timeline: current.timeline.filter((_, rowIndex) => rowIndex !== index),
    }));
    if (!incident.isDemo) setHasUnsavedChanges(true);
  }

  function structureIntake(mode: "merge" | "replace" = "merge") {
    const extracted = parseIntakeNotes(incident.intakeNotes);
    if (mode === "replace") {
      setIncident((current) => ({ ...current, ...extracted }));
      setIntakeStructured(
        "Replaced structured fields from intake notes. Unlabeled lines remain unverified.",
      );
    } else {
      const { merged, addedCount } = mergeStructuredIntake(incident, extracted);
      setIncident((current) => ({ ...current, ...merged }));
      setIntakeStructured(
        addedCount > 0
          ? `Added ${addedCount} new item${addedCount === 1 ? "" : "s"} while preserving existing layer edits.`
          : "No new items found to add. Existing layer edits are unchanged.",
      );
    }
    if (!incident.isDemo) setHasUnsavedChanges(true);
    setNotice("");
  }

  async function saveIncident() {
    if (!session) {
      await navigate({ to: "/auth" });
      return;
    }
    if (incident.isDemo) {
      setNotice(
        "Fictional demo scenarios are not saved as real incident records. Start a new incident to save a case.",
      );
      return;
    }
    setIsSaving(true);
    setNotice("");
    try {
      const saved = await saveIncidentRecordFn({
        data: {
          id: incident.id,
          churchId: incident.churchId ?? churchWorkspace.church?.id ?? null,
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
      setHasUnsavedChanges(false);
      const rows = await listIncidentRecordsFn();
      setSavedRecords(rows);
      setNotice("Saved to your private incident records.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this incident.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCurrentIncident() {
    if (!session || !incident.id || incident.isDemo) return;
    setIsDeletingIncident(true);
    setNotice("");
    try {
      await deleteIncidentRecordFn({ data: { id: incident.id } });
      const rows = await listIncidentRecordsFn();
      setSavedRecords(rows);
      setConfirmDeleteIncident(false);
      applyScenario("demo-youth");
      setNotice("Private incident record deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete this incident.");
    } finally {
      setIsDeletingIncident(false);
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
          churchId: churchWorkspace.church?.id ?? null,
          churchName: profile.churchName,
          leadershipRoles: profile.leadershipRoles.filter(
            (entry) => entry.role.trim() || entry.name.trim(),
          ),
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
      await saveCounselingNoteFn({
        data: {
          incidentId: incident.id,
          churchId: incident.churchId ?? churchWorkspace.church?.id ?? null,
          note: vaultDraft.trim(),
        },
      });
      const notes = await listCounselingNotesFn({ data: { incidentId: incident.id } });
      setVaultNotes(
        notes.map((note) => ({ id: note.id, note: note.note, created_at: note.created_at })),
      );
      setVaultDraft("");
      setVaultNotice("Saved in the separate counseling vault. It is not available to drafting.");
    } catch (error) {
      setVaultNotice(error instanceof Error ? error.message : "Could not save the private note.");
    } finally {
      setIsSavingVault(false);
    }
  }

  async function saveEditedVaultNote(noteId: string) {
    if (!session || !incident.id || !editingVaultText.trim()) return;
    setIsSavingVault(true);
    setVaultNotice("");
    try {
      await updateCounselingNoteFn({ data: { noteId, note: editingVaultText.trim() } });
      const notes = await listCounselingNotesFn({ data: { incidentId: incident.id } });
      setVaultNotes(
        notes.map((note) => ({ id: note.id, note: note.note, created_at: note.created_at })),
      );
      setEditingVaultId(null);
      setEditingVaultText("");
      setVaultNotice("Private counseling note updated.");
    } catch (error) {
      setVaultNotice(error instanceof Error ? error.message : "Could not update the private note.");
    } finally {
      setIsSavingVault(false);
    }
  }

  async function confirmRemoveVaultNote() {
    if (!session || !incident.id || !deletingVaultId) return;
    setIsSavingVault(true);
    setVaultNotice("");
    try {
      await deleteCounselingNoteFn({ data: { noteId: deletingVaultId } });
      const notes = await listCounselingNotesFn({ data: { incidentId: incident.id } });
      setVaultNotes(
        notes.map((note) => ({ id: note.id, note: note.note, created_at: note.created_at })),
      );
      setDeletingVaultId(null);
      setVaultNotice("Private counseling note removed.");
    } catch (error) {
      setVaultNotice(error instanceof Error ? error.message : "Could not delete the private note.");
    } finally {
      setIsSavingVault(false);
    }
  }

  async function smartTriageIntake() {
    if (!incident.intakeNotes.trim()) {
      setIntakeStructured("Paste notes or a voice-memo transcript first.");
      return;
    }
    if (!session) {
      if (incident.isDemo) {
        const extracted = parseIntakeNotes(incident.intakeNotes);
        const { merged, addedCount } = mergeStructuredIntake(incident, extracted);
        setIncident((current) => ({ ...current, ...merged }));
        setIntakeStructured(
          addedCount > 0
            ? `Demo triage added ${addedCount} item${addedCount === 1 ? "" : "s"}. Sign in for live Muse Spark triage.`
            : "Demo triage checked notes — no new items to add.",
        );
        return;
      }
      await navigate({ to: "/auth" });
      return;
    }
    setIsSmartTriaging(true);
    setIntakeStructured("");
    try {
      const extracted = await triageIntakeNotesWithAIFn({
        data: {
          situationType: incident.situationType,
          intakeNotes: incident.intakeNotes,
        },
      });
      const { merged, addedCount } = mergeStructuredIntake(incident, extracted);
      setIncident((current) => ({ ...current, ...merged }));
      if (!incident.isDemo) setHasUnsavedChanges(true);
      setIntakeStructured(
        addedCount > 0
          ? `Smart triage added ${addedCount} new item${addedCount === 1 ? "" : "s"} while keeping uncertain claims marked unconfirmed.`
          : "Smart triage found no new items to add.",
      );
    } catch (error) {
      setIntakeStructured(
        error instanceof Error
          ? error.message
          : "Smart triage failed. Use Merge into layers on this device.",
      );
    } finally {
      setIsSmartTriaging(false);
    }
  }

  function toggleDictation() {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }
    type SpeechCtor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const speechWin = window as unknown as {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = speechWin.SpeechRecognition ?? speechWin.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
      if (!latest) return;
      setIncident((current) => ({
        ...current,
        intakeNotes: current.intakeNotes ? `${current.intakeNotes}\n${latest}` : latest,
      }));
      if (!incident.isDemo) setHasUnsavedChanges(true);
    };
    recognition.onerror = () => setIsDictating(false);
    recognition.onend = () => setIsDictating(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
  }

  async function generateDraft() {
    setDraftError("");
    if (activeBlockers.length > 0) return;
    if (!session) {
      if (incident.isDemo) {
        setIsGenerating(true);
        const demoText = getSampleDraft(draftAudience, incident, profile);
        updateAudienceDraft(draftAudience, {
          text: demoText,
          origin: "fictional",
          approval: null,
        });
        setNotice(
          "Demo preview updated from current facts and locks. Sign in for live Muse Spark drafting.",
        );
        setIsGenerating(false);
        return;
      }
      await navigate({ to: "/auth" });
      return;
    }
    setIsGenerating(true);
    try {
      const payload = buildDraftPayload(draftAudience, incident, draftGate, profile);
      const response = await generateAudienceDraftStreamFn({ data: payload });
      if (response instanceof Response && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        updateAudienceDraft(draftAudience, { text: "", origin: "ai", approval: null });
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          updateAudienceDraft(draftAudience, {
            text: accumulated,
            origin: "ai",
            approval: null,
          });
        }
        if (!accumulated.trim()) {
          throw new Error("The drafting service returned no text. No draft was produced.");
        }
      } else {
        const result = await generateAudienceDraftFn({ data: payload });
        updateAudienceDraft(draftAudience, {
          text: result.text,
          origin: "ai",
          approval: null,
        });
      }
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : "Draft generation failed. No draft was produced.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function suggestSaferRevision() {
    if (!draftText.trim()) return;
    if (!session) {
      if (incident.isDemo) {
        const revised = applyDemoSafetyRevision(draftText, draftAudience, incident, profile);
        updateAudienceDraft(draftAudience, {
          text: revised,
          origin: "edited",
          approval: null,
        });
        setNotice("Demo safety revision applied. Sign in for live Muse Spark copy editing.");
        return;
      }
      await navigate({ to: "/auth" });
      return;
    }
    setDraftError("");
    setIsRevising(true);
    try {
      const result = await reviseDraftForSafetyFn({
        data: {
          audience: draftAudience,
          draftText,
          flags: redLines,
          verifiedFacts: incident.confirmedFacts,
          spokesperson: resolveSpokesperson(incident, profile),
          officialPressContact: profile.contactPreferences.pressEmail,
        },
      });
      updateAudienceDraft(draftAudience, {
        text: result.text,
        origin: "ai",
        approval: null,
      });
      setNotice("Suggested safer revision applied. Review it carefully before approval.");
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Could not revise this draft safely.");
    } finally {
      setIsRevising(false);
    }
  }

  async function persistAudienceDraft(audience: Audience, override?: Partial<AudienceDraftState>) {
    if (!session || !incident.id || incident.isDemo) return;
    const state = { ...draftsByAudience[audience], ...override };
    setIsSavingDraft(true);
    try {
      await saveAudienceDraftFn({
        data: {
          incidentId: incident.id,
          churchId: incident.churchId ?? churchWorkspace.church?.id ?? null,
          audience,
          draftText: state.text,
          origin: state.origin,
          recipientTier: state.gate.recipientTier,
          confidentialityAcknowledged: state.gate.confidentialityAcknowledged,
          approvedBy: state.approval?.approvedBy ?? null,
          approvedAt: state.approval?.approvedAt ?? null,
        },
      });
      const monthly = await getMonthlyApprovedCountFn();
      setMonthlyApprovedCount(monthly.count);
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : "Could not persist this audience draft.",
      );
    } finally {
      setIsSavingDraft(false);
    }
  }

  function approveCurrentDraft() {
    if (approvalBlockers.length > 0) return;
    const reviewer =
      approverName.trim() ||
      resolveSpokesperson(incident, profile) ||
      session?.user.email ||
      "Designated leader";
    const approval = { approvedBy: reviewer, approvedAt: new Date().toISOString() };
    updateAudienceDraft(draftAudience, { approval });
    if (session && incident.id && !incident.isDemo) {
      void persistAudienceDraft(draftAudience, { approval });
    }
    setNotice(
      `Marked ${AUDIENCES.find((item) => item.id === draftAudience)?.label} draft approved for release.`,
    );
  }

  async function createChurch() {
    if (!session || !newChurchName.trim()) return;
    setIsUpdatingChurch(true);
    setChurchNotice("");
    try {
      await createChurchWorkspaceFn({
        data: { name: newChurchName.trim(), email: session.user.email ?? "" },
      });
      const updated = await getChurchWorkspaceFn();
      setChurchWorkspace(updated);
      if (updated.church) {
        setProfile((current) => ({
          ...current,
          churchName: updated.church?.name ?? current.churchName,
        }));
      }
      setNewChurchName("");
      setChurchNotice("Church workspace created.");
    } catch (error) {
      setChurchNotice(
        error instanceof Error ? error.message : "Could not create church workspace.",
      );
    } finally {
      setIsUpdatingChurch(false);
    }
  }

  async function addMemberToChurch() {
    if (!session || !churchWorkspace.church) return;
    setIsUpdatingChurch(true);
    setChurchNotice("");
    try {
      await addChurchMemberFn({
        data: {
          churchId: churchWorkspace.church.id,
          userId: memberUserIdInput.trim(),
          email: memberEmailInput.trim(),
          role: memberRoleInput,
        },
      });
      setChurchWorkspace(await getChurchWorkspaceFn());
      setMemberUserIdInput("");
      setMemberEmailInput("");
      setChurchNotice("Church member added.");
    } catch (error) {
      setChurchNotice(error instanceof Error ? error.message : "Could not add church member.");
    } finally {
      setIsUpdatingChurch(false);
    }
  }

  async function changeMemberRole(memberId: string, role: RecipientTier) {
    setIsUpdatingChurch(true);
    setChurchNotice("");
    try {
      await updateChurchMemberRoleFn({ data: { memberId, role } });
      setChurchWorkspace(await getChurchWorkspaceFn());
      setChurchNotice("Member role updated.");
    } catch (error) {
      setChurchNotice(error instanceof Error ? error.message : "Could not update member role.");
    } finally {
      setIsUpdatingChurch(false);
    }
  }

  async function deleteMemberFromChurch(memberId: string) {
    setIsUpdatingChurch(true);
    setChurchNotice("");
    try {
      await removeChurchMemberFn({ data: { memberId } });
      setChurchWorkspace(await getChurchWorkspaceFn());
      setChurchNotice("Member removed from church workspace.");
    } catch (error) {
      setChurchNotice(error instanceof Error ? error.message : "Could not remove member.");
    } finally {
      setIsUpdatingChurch(false);
    }
  }

  function downloadDraft() {
    if (!draftText.trim()) return;
    const content = formatAudienceExport(
      draftAudience,
      draftText,
      incident,
      profile,
      draftApproval,
    );
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug =
      incident.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "incident";
    link.href = url;
    link.download = `graceguard-${slug}-${draftAudience}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadFullPacket() {
    const content = formatFullCrisisPacket(incident, draftsByAudience, profile);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug =
      incident.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "incident";
    link.href = url;
    link.download = `graceguard-${slug}-full-packet.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openDraftInEmail() {
    if (!draftText.trim()) return;
    const formatted = formatAudienceExport(
      draftAudience,
      draftText,
      incident,
      profile,
      draftApproval,
    );
    const subject = encodeURIComponent(
      `${profile.churchName || "GraceGuard"} — ${AUDIENCES.find((item) => item.id === draftAudience)?.label ?? "Statement"}: ${incident.title}`,
    );
    const body = encodeURIComponent(formatted);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function copyDraft() {
    if (!draftText) return;
    try {
      const formatted = formatAudienceExport(
        draftAudience,
        draftText,
        incident,
        profile,
        draftApproval,
      );
      await navigator.clipboard.writeText(formatted);
      setNotice("Formatted draft copied. Follow your church's release review protocol.");
    } catch {
      setNotice("Copy is unavailable in this browser. Select the draft text to copy it.");
    }
  }

  async function coachSparringWithAI() {
    if (!sparringResponse.trim()) return;
    if (!session) {
      if (incident.isDemo) {
        const baseNotes = reviewSparringResponse(sparringResponse, incident, profile);
        const leadFact = incident.confirmedFacts[0];
        setSparringReview(
          leadFact
            ? [...baseNotes, `Anchor your reply to verified fact: "${leadFact}"`]
            : baseNotes,
        );
        return;
      }
      await navigate({ to: "/auth" });
      return;
    }
    const safeIndex = sparringQuestions.length ? sparringIndex % sparringQuestions.length : 0;
    const question = sparringQuestions[safeIndex] ?? "What can you confirm right now?";
    setIsCoachingSparring(true);
    try {
      const result = await coachSparringResponseFn({
        data: {
          situationType: incident.situationType,
          question,
          response: sparringResponse,
          verifiedFacts: incident.confirmedFacts,
          spokesperson: resolveSpokesperson(incident, profile) || "Designated spokesperson",
          holdingLine: draftsByAudience.press.text || draftsByAudience.staff.text || draftText,
        },
      });
      setSparringReview(result.notes);
    } catch (error) {
      setSparringReview([
        ...reviewSparringResponse(sparringResponse, incident, profile),
        error instanceof Error ? error.message : "AI coaching unavailable; showing local review.",
      ]);
    } finally {
      setIsCoachingSparring(false);
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

  function renderFieldEditor(
    label: string,
    value: string[],
    field: ListField,
    placeholder: string,
  ) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Textarea
          value={listText(value)}
          onChange={(event) => updateListField(field, event.target.value)}
          placeholder={placeholder}
          className="min-h-28 bg-background"
        />
        <p className="text-xs text-muted-foreground">
          One item per line. Keep only details that belong in this layer.
        </p>
      </div>
    );
  }

  function renderSafetyInterlocks() {
    const publicBlockers = getDraftBlockers("press", incident, draftGate, profile);
    const profileSpokesperson = profile.contactPreferences.spokespersonName.trim();
    const effectiveSpokesperson = resolveSpokesperson(incident, profile);
    const clearedCount =
      (incident.emergencyStatus !== "pending" ? 1 : 0) +
      (incident.nextOfKinNotified ? 1 : 0) +
      (incident.riskContactNotified ? 1 : 0) +
      (effectiveSpokesperson ? 1 : 0);

    return (
      <section className="border-y border-border bg-muted/40 px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                  publicBlockers.length === 0
                    ? "bg-success/15 text-success"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold tracking-tight">Pause & assess</h2>
                <p className="text-sm text-muted-foreground">
                  Complete all 4 response checks before preparing outward messages.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {clearedCount} / 4 cleared
              </span>
              <Badge
                variant={publicBlockers.length === 0 ? "secondary" : "outline"}
                className={
                  publicBlockers.length === 0
                    ? "border border-success/30 bg-success/10 text-success"
                    : "border-warning bg-warning/15 text-warning-foreground"
                }
              >
                {publicBlockers.length === 0
                  ? "Release checks clear"
                  : `${publicBlockers.length} hold${publicBlockers.length === 1 ? "" : "s"}`}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div
              className={`space-y-2 rounded-xl border bg-card p-4 shadow-xs transition-colors ${
                incident.emergencyStatus !== "pending" ? "border-success/40" : "border-warning/60"
              }`}
            >
              <Label htmlFor="emergency-status" className="text-sm font-medium">
                Emergency services / 911
              </Label>
              <Select
                value={incident.emergencyStatus}
                onValueChange={(value) =>
                  updateIncident("emergencyStatus", value as IncidentRecord["emergencyStatus"])
                }
              >
                <SelectTrigger id="emergency-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Not confirmed</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="not_required">Not required — documented</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors ${
                incident.nextOfKinNotified ? "border-success/40" : "border-warning/60"
              }`}
            >
              <div>
                <Label htmlFor="family-notified" className="text-sm font-medium">
                  Next of kin / parents
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Required before church or public statements.
                </p>
              </div>
              <Switch
                id="family-notified"
                checked={incident.nextOfKinNotified}
                onCheckedChange={(checked) => updateIncident("nextOfKinNotified", checked)}
              />
            </div>
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors ${
                incident.riskContactNotified ? "border-success/40" : "border-warning/60"
              }`}
            >
              <div>
                <Label htmlFor="risk-contacted" className="text-sm font-medium">
                  Legal / insurer risk contact
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check before any statement is released.
                </p>
              </div>
              <Switch
                id="risk-contacted"
                checked={incident.riskContactNotified}
                onCheckedChange={(checked) => updateIncident("riskContactNotified", checked)}
              />
            </div>
            <div
              className={`space-y-2 rounded-xl border bg-card p-4 shadow-xs transition-colors ${
                effectiveSpokesperson ? "border-success/40" : "border-warning/60"
              }`}
            >
              <Label htmlFor="spokesperson" className="text-sm font-medium">
                Designated spokesperson
              </Label>
              <Input
                id="spokesperson"
                value={incident.spokesperson}
                onChange={(event) => updateIncident("spokesperson", event.target.value)}
                placeholder={
                  profileSpokesperson ? `Profile default: ${profileSpokesperson}` : "Name or role"
                }
              />
              {!incident.spokesperson.trim() && profileSpokesperson && (
                <p className="text-xs text-muted-foreground">
                  Using Church Profile default: {profileSpokesperson}
                </p>
              )}
            </div>
          </div>
          {publicBlockers.length > 0 && (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning-foreground"
              role="status"
            >
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
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Incident triage
              </p>
              <h1 className="font-serif text-3xl">A steady first response</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Separate what is known from what is still being confirmed. Keep care, safety, and
                privacy ahead of speed.
              </p>
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
                  {savedRecords.length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Saved cases
                    </div>
                  )}
                  {savedRecords.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => chooseScenario("new")}>
                <Plus /> New incident
              </Button>
              {incident.isDemo ? (
                <Badge
                  variant="outline"
                  className="h-9 items-center border-warning text-warning-foreground"
                >
                  Fictional demo
                </Badge>
              ) : (
                <>
                  {hasUnsavedChanges && (
                    <Badge
                      variant="outline"
                      className="h-9 items-center border-warning text-warning-foreground"
                    >
                      Unsaved changes
                    </Badge>
                  )}
                  <Button onClick={() => void saveIncident()} disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />} Save case
                  </Button>
                  {incident.id && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmDeleteIncident(true)}
                      disabled={isDeletingIncident}
                      aria-label="Delete saved incident"
                    >
                      <Trash2 className="text-destructive" /> Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {notice && (
            <p
              className="mb-4 border-l-2 border-primary px-3 py-2 text-sm text-muted-foreground"
              role="status"
            >
              {notice}
            </p>
          )}
          <div className="grid gap-4 border-y border-border py-5 sm:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
            <div className="space-y-2">
              <Label htmlFor="incident-title">Incident name</Label>
              <Input
                id="incident-title"
                value={incident.title}
                onChange={(event) => updateIncident("title", event.target.value)}
                placeholder="Short, internal case title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-type">Situation type</Label>
              <Select
                value={incident.situationType}
                onValueChange={(value) => {
                  updateIncident("situationType", asIncidentType(value));
                  setSparringIndex(0);
                  setSparringReview([]);
                }}
              >
                <SelectTrigger id="incident-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
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
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Notes and voice-memo text</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Paste unstructured notes or dictate hands-free. Structuring happens on this
                        device without overwriting existing layer edits.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={isDictating ? "destructive" : "outline"}
                      size="sm"
                      disabled={!dictationSupported}
                      title={
                        dictationSupported
                          ? isDictating
                            ? "Stop voice dictation"
                            : "Dictate notes with microphone"
                          : "Voice dictation is not supported in this browser"
                      }
                      onClick={toggleDictation}
                    >
                      {isDictating ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isDictating ? "Stop" : "Dictate"}
                    </Button>
                  </div>
                  <Textarea
                    value={incident.intakeNotes}
                    onChange={(event) => updateIncident("intakeNotes", event.target.value)}
                    placeholder={"8:42 AM — confirmed: ...\nParty: ...\nUnconfirmed: ..."}
                    className="min-h-56 bg-background"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => structureIntake("merge")}>
                      <ClipboardCheck /> Merge into layers
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void smartTriageIntake()}
                      disabled={isSmartTriaging}
                    >
                      {isSmartTriaging ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                      {isSmartTriaging
                        ? "Triaging…"
                        : session
                          ? "Smart triage (Muse Spark)"
                          : incident.isDemo
                            ? "Smart triage (demo)"
                            : "Sign in for smart triage"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => structureIntake("replace")}>
                      Replace all from notes
                    </Button>
                  </div>
                  {intakeStructured && (
                    <p className="text-sm text-success" role="status">
                      {intakeStructured}
                    </p>
                  )}
                </div>
                <div className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-xs">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock3Icon />
                        <h2 className="font-semibold">Working chronology</h2>
                      </div>
                      <Button variant="outline" size="sm" onClick={addTimelineEntry}>
                        <Plus /> Add entry
                      </Button>
                    </div>
                    {incident.timeline.length > 0 ? (
                      <ol className="space-y-3 border-l border-border pl-5">
                        {incident.timeline.map((entry, index) => (
                          <li
                            key={`timeline-${index}`}
                            className="relative space-y-2 border-b border-border/60 pb-3 last:border-b-0"
                          >
                            <span
                              className={`absolute -left-[1.53rem] top-2 grid h-3 w-3 place-items-center rounded-full border border-background ${
                                entry.verified ? "bg-success" : "bg-warning"
                              }`}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                aria-label={`Timeline ${index + 1} time`}
                                value={entry.time}
                                onChange={(event) =>
                                  updateTimelineEntry(index, { time: event.target.value })
                                }
                                className="h-8 w-36 bg-background text-xs font-semibold"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant={entry.verified ? "secondary" : "outline"}
                                className={
                                  entry.verified
                                    ? "h-7 px-2 text-xs text-success"
                                    : "h-7 border-warning px-2 text-xs text-warning-foreground"
                                }
                                onClick={() =>
                                  updateTimelineEntry(index, { verified: !entry.verified })
                                }
                              >
                                {entry.verified ? "Verified" : "Unconfirmed · mark verified"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="ml-auto h-7 w-7"
                                aria-label={`Remove timeline entry ${index + 1}`}
                                onClick={() => removeTimelineEntry(index)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Input
                              aria-label={`Timeline ${index + 1} detail`}
                              value={entry.detail}
                              onChange={(event) =>
                                updateTimelineEntry(index, { detail: event.target.value })
                              }
                              placeholder="What happened at this time?"
                              className="bg-background text-sm"
                            />
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="border-l border-border pl-4 text-sm text-muted-foreground">
                        No timeline entries yet. Structure notes or add an entry to start a
                        chronology.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="border-t border-border pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        Confirmed parties
                      </p>
                      {incident.confirmedParties.length ? (
                        <ul className="space-y-1 text-sm">
                          {incident.confirmedParties.map((item, index) => (
                            <li key={`${item}-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">None recorded.</p>
                      )}
                    </div>
                    <div className="border-t border-warning pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-warning-foreground">
                        Unconfirmed / rumor
                      </p>
                      {incident.rumors.length ? (
                        <ul className="space-y-1 text-sm">
                          {incident.rumors.map((item, index) => (
                            <li key={`${item}-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">None recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const actionItems = ACTION_CHECKLISTS_BY_TYPE[incident.situationType];
                const checklistKey = incident.id ?? scenarioValue;
                const checked = checkedActionsByKey[checklistKey] ?? [];
                return (
                  <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-xs">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-semibold">
                          First-60-minute action checklist · {incident.situationType}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Operational safeguards tailored to this incident type.
                        </p>
                      </div>
                      <Badge variant="outline">
                        {checked.length} / {actionItems.length} completed
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {actionItems.map((step, index) => {
                        const isChecked = checked.includes(step);
                        const stepId = `action-step-${index}`;
                        return (
                          <label
                            key={step}
                            htmlFor={stepId}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                              isChecked
                                ? "border-success/40 bg-success/5 text-muted-foreground line-through"
                                : "border-border hover:bg-muted/30"
                            }`}
                          >
                            <Checkbox
                              id={stepId}
                              checked={isChecked}
                              className="mt-0.5"
                              onCheckedChange={(val) => {
                                setCheckedActionsByKey((current) => {
                                  const existing = current[checklistKey] ?? [];
                                  const next =
                                    val === true
                                      ? [...existing, step]
                                      : existing.filter((item) => item !== step);
                                  return { ...current, [checklistKey]: next };
                                });
                              }}
                            />
                            <span>{step}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
            <TabsContent value="layers" className="mt-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Need-to-know information layers</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Layer 5 is stored in a separate vault and never enters a drafting request.
                  </p>
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
                  {renderFieldEditor(
                    "Verified baseline facts",
                    incident.confirmedFacts,
                    "confirmedFacts",
                    "Only confirmed information…",
                  )}
                  {renderFieldEditor(
                    "Confirmed parties / roles",
                    incident.confirmedParties,
                    "confirmedParties",
                    "Names or roles needed for response…",
                  )}
                  <div className="lg:col-span-2">
                    {renderFieldEditor(
                      "Unconfirmed information — internal tracking only",
                      incident.rumors,
                      "rumors",
                      "Label what is unverified; never repeat as fact…",
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="pastoral" className="mt-5 max-w-3xl">
                  {renderFieldEditor(
                    "Pastoral guidance and prayer points",
                    incident.pastoralGuidance,
                    "pastoralGuidance",
                    "Care needs, prayer, scripture, counseling resources…",
                  )}
                </TabsContent>
                <TabsContent value="legal" className="mt-5 max-w-3xl">
                  {renderFieldEditor(
                    "Legal strategy and liability notes",
                    incident.legalNotes,
                    "legalNotes",
                    "Restricted internal notes for authorized leadership…",
                  )}
                  <p className="mt-3 text-sm text-warning-foreground">
                    Never admit fault or make promises in a draft. Consult the named risk contact
                    before release.
                  </p>
                </TabsContent>
                <TabsContent value="family" className="mt-5 max-w-3xl">
                  {renderFieldEditor(
                    "Medical and family details",
                    incident.medicalFamilyDetails,
                    "medicalFamilyDetails",
                    "Restricted care details. Avoid unnecessary identifiers…",
                  )}
                  <p className="mt-3 text-sm text-muted-foreground">
                    Detailed family and medical information is excluded from all drafting requests.
                  </p>
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </section>
      </>
    );
  }

  function renderDraftStudio() {
    const showReviseButton =
      draftText.trim().length > 0 &&
      (hasSevereFlags || redLines.some((line) => line.startsWith("Tone may feel cold:")));
    return (
      <section className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Multi-audience draft studio
            </p>
            <h1 className="font-serif text-3xl">One incident, four careful voices</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Each audience gets only the information it needs. Clear safety checks, resolve
              red-line flags, and mark each audience approved before release.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {session && (
              <Badge variant="outline">This month: {monthlyApprovedCount} finalized</Badge>
            )}
            <Badge
              variant={approvedCount === 4 ? "secondary" : "outline"}
              className="border-warning text-warning-foreground"
            >
              {approvedCount} / 4 audiences approved
            </Badge>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((item) => {
            const state = draftsByAudience[item.id];
            const blockers = getDraftBlockers(item.id, incident, state.gate, profile);
            const statusLabel = state.approval
              ? "Approved"
              : blockers.length > 0
                ? "Held"
                : state.text.trim()
                  ? "Drafted"
                  : "Empty";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setDraftAudience(item.id);
                  setDraftError("");
                }}
                className={`flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  draftAudience === item.id
                    ? "border-primary bg-accent/50"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <Badge
                  variant={state.approval ? "secondary" : "outline"}
                  className={
                    state.approval
                      ? "border border-success/30 bg-success/10 text-success"
                      : blockers.length > 0
                        ? "border-warning bg-warning/15 text-warning-foreground"
                        : ""
                  }
                >
                  {statusLabel}
                </Badge>
              </button>
            );
          })}
        </div>

        <Tabs
          value={draftAudience}
          onValueChange={(value) => {
            const next = AUDIENCES.find((item) => item.id === value)?.id;
            if (!next) return;
            setDraftAudience(next);
            setDraftError("");
          }}
        >
          <TabsList className="h-auto w-full flex-wrap justify-start rounded-md bg-muted/70 p-1 sm:w-auto">
            {AUDIENCES.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {AUDIENCES.map((item) => (
            <TabsContent key={item.id} value={item.id} className="mt-6">
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                <div className="space-y-6">
                  <div className="border-b border-border pb-5">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Selected audience
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">{item.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="recipient-tier">Recipient clearance tier</Label>
                      <Select
                        value={draftGate.recipientTier}
                        onValueChange={(value) =>
                          updateAudienceDraft(draftAudience, {
                            gate: {
                              recipientTier: value as RecipientTier,
                              confidentialityAcknowledged: false,
                            },
                            approval: null,
                          })
                        }
                      >
                        <SelectTrigger id="recipient-tier">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECIPIENT_TIERS.map((tier) => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-start gap-3 pt-1">
                      <Checkbox
                        id={`confidentiality-${item.id}`}
                        checked={draftGate.confidentialityAcknowledged}
                        onCheckedChange={(checked) =>
                          updateAudienceDraft(draftAudience, {
                            gate: {
                              ...draftGate,
                              confidentialityAcknowledged: checked === true,
                            },
                            approval: null,
                          })
                        }
                        className="mt-1"
                      />
                      <Label htmlFor={`confidentiality-${item.id}`} className="leading-5">
                        I confirm this group has need-to-know clearance and has acknowledged
                        confidentiality.
                      </Label>
                    </div>
                  </div>

                  {activeBlockers.length > 0 && (
                    <div className="border-l-2 border-warning px-4 py-3" role="status">
                      <div className="flex items-center gap-2 font-medium text-warning-foreground">
                        <LockKeyhole className="h-4 w-4" /> Draft held
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {activeBlockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {draftError && (
                    <p
                      className="border-l-2 border-destructive px-3 py-2 text-sm text-destructive"
                      role="alert"
                    >
                      {draftError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void generateDraft()}
                      disabled={isGenerating || activeBlockers.length > 0}
                    >
                      {isGenerating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                      {isGenerating
                        ? "Preparing draft…"
                        : session
                          ? "Generate with Muse Spark"
                          : incident.isDemo
                            ? "Preview draft (demo)"
                            : "Sign in to generate"}
                    </Button>
                    {draftText && (
                      <>
                        {session && incident.id && !incident.isDemo && (
                          <Button
                            variant="outline"
                            onClick={() => void persistAudienceDraft(draftAudience)}
                            disabled={isSavingDraft}
                          >
                            {isSavingDraft ? <LoaderCircle className="animate-spin" /> : <Save />}
                            Save draft
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => void copyDraft()}>
                          <Copy /> Copy formatted
                        </Button>
                        <Button variant="outline" onClick={downloadDraft}>
                          <Download /> Download .txt
                        </Button>
                        <Button variant="outline" onClick={downloadFullPacket}>
                          <Download /> Full packet
                        </Button>
                        {(draftAudience === "board" || draftAudience === "press") && (
                          <Button variant="outline" onClick={openDraftInEmail}>
                            <Mail /> Email draft
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
                          <Eye /> Reading / print view
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Public and congregation drafts stay locked until next-of-kin and risk-contact
                    checks are complete.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Working draft</h3>
                      {draftText.trim() && (
                        <span className="text-xs text-muted-foreground">
                          · {draftText.trim().split(/\s+/).length} words
                          {(item.id === "staff" || item.id === "congregation") &&
                            ` (~${Math.max(5, Math.round((draftText.trim().split(/\s+/).length / 130) * 60))}s spoken)`}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant={
                        draftApproval ? "secondary" : draftOrigin === "ai" ? "secondary" : "outline"
                      }
                      className={draftApproval ? "text-success" : ""}
                    >
                      {draftApproval
                        ? `Approved · ${draftApproval.approvedBy}`
                        : draftOrigin === "ai"
                          ? "AI draft · unapproved"
                          : draftOrigin === "fictional"
                            ? "Fictional sample"
                            : "Not approved"}
                    </Badge>
                  </div>
                  <Textarea
                    value={draftText}
                    onChange={(event) => {
                      updateAudienceDraft(draftAudience, {
                        text: event.target.value,
                        origin: "edited",
                        approval: null,
                      });
                    }}
                    placeholder="A draft will appear here after generation…"
                    className="min-h-[430px] bg-background font-sans leading-6"
                    aria-label={`${item.label} working draft`}
                  />
                  <div className="mt-5 border-t border-border pt-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldAlert className="h-4 w-4 text-warning-foreground" /> Red-line & tone
                        review
                      </div>
                      {showReviseButton && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void suggestSaferRevision()}
                          disabled={isRevising}
                        >
                          {isRevising ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                          {isRevising
                            ? "Revising…"
                            : session
                              ? "Suggest safer revision"
                              : incident.isDemo
                                ? "Preview safer revision"
                                : "Sign in to revise"}
                        </Button>
                      )}
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {redLines.map((line) => (
                        <li key={line} className="flex gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> Leader release sign-off
                    </div>
                    {draftApproval ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                        <div>
                          <p className="font-medium text-success">Approved for release</p>
                          <p className="text-xs text-muted-foreground">
                            Reviewed by {draftApproval.approvedBy} at{" "}
                            {new Date(draftApproval.approvedAt).toLocaleString()}. Editing the draft
                            or safety checks resets approval.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            updateAudienceDraft(draftAudience, { approval: null });
                            if (session && incident.id && !incident.isDemo) {
                              void persistAudienceDraft(draftAudience, { approval: null });
                            }
                          }}
                        >
                          Revoke approval
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Input
                            aria-label="Reviewer name or role"
                            value={approverName}
                            onChange={(event) => setApproverName(event.target.value)}
                            placeholder={
                              resolveSpokesperson(incident, profile)
                                ? `Reviewer (default: ${resolveSpokesperson(incident, profile)})`
                                : "Approving leader name or role"
                            }
                            className="flex-1 bg-background"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={approvalBlockers.length > 0}
                            onClick={approveCurrentDraft}
                          >
                            <CheckCircle2 /> Approve for release
                          </Button>
                        </div>
                        {approvalBlockers.length > 0 && (
                          <p className="text-xs text-muted-foreground">{approvalBlockers[0]}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(() => {
                const actionItems = ACTION_CHECKLISTS_BY_TYPE[incident.situationType];
                const checklistKey = incident.id ?? scenarioValue;
                const checked = checkedActionsByKey[checklistKey] ?? [];
                return (
                  <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-xs">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-semibold">
                          First-60-minute action checklist · {incident.situationType}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Operational safeguards tailored to this incident type.
                        </p>
                      </div>
                      <Badge variant="outline">
                        {checked.length} / {actionItems.length} completed
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {actionItems.map((step, index) => {
                        const isChecked = checked.includes(step);
                        const stepId = `action-step-${index}`;
                        return (
                          <label
                            key={step}
                            htmlFor={stepId}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                              isChecked
                                ? "border-success/40 bg-success/5 text-muted-foreground line-through"
                                : "border-border hover:bg-muted/30"
                            }`}
                          >
                            <Checkbox
                              id={stepId}
                              checked={isChecked}
                              className="mt-0.5"
                              onCheckedChange={(val) => {
                                setCheckedActionsByKey((current) => {
                                  const existing = current[checklistKey] ?? [];
                                  const next =
                                    val === true
                                      ? [...existing, step]
                                      : existing.filter((item) => item !== step);
                                  return { ...current, [checklistKey]: next };
                                });
                              }}
                            />
                            <span>{step}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          ))}
        </Tabs>
      </section>
    );
  }

  function renderSparring() {
    const safeIndex = sparringQuestions.length ? sparringIndex % sparringQuestions.length : 0;
    const question = sparringQuestions[safeIndex] ?? "What can you confirm right now?";
    return (
      <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
        <div className="mb-7">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Interactive media / lobby practice · {incident.situationType}
          </p>
          <h1 className="font-serif text-3xl">Practice the hard question</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Rehearse a calm response against the current holding lines. Questions adapt to the
            selected situation type and stay on this device.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-xs">
            <div>
              <div className="mb-4 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" /> Question {safeIndex + 1} of{" "}
                  {sparringQuestions.length}
                </span>
                <div className="flex gap-1">
                  {sparringQuestions.map((_, dotIndex) => (
                    <span
                      key={`dot-${dotIndex}`}
                      className={`h-1.5 w-4 rounded-full transition-colors ${
                        dotIndex === safeIndex ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <blockquote className="font-serif text-2xl leading-snug text-foreground">
                “{question}”
              </blockquote>
            </div>
            <Button
              variant="outline"
              className="mt-6 self-start"
              onClick={() => {
                setSparringIndex((current) => (current + 1) % sparringQuestions.length);
                setSparringResponse("");
                setSparringReview([]);
              }}
            >
              Next challenge <ChevronRight />
            </Button>
          </div>
          <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sparring-response">Your spoken response</Label>
                <span className="text-xs text-muted-foreground">
                  {sparringResponse.trim() ? sparringResponse.trim().split(/\s+/).length : 0} / 75
                  words target
                </span>
              </div>
              <Textarea
                id="sparring-response"
                value={sparringResponse}
                onChange={(event) => setSparringResponse(event.target.value)}
                placeholder="Practice a brief, compassionate answer…"
                className="mt-2 min-h-36 bg-background"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  setSparringReview(reviewSparringResponse(sparringResponse, incident, profile))
                }
                disabled={!sparringResponse.trim()}
              >
                Review my response <ArrowRight />
              </Button>
              <Button
                variant="outline"
                onClick={() => void coachSparringWithAI()}
                disabled={isCoachingSparring || !sparringResponse.trim()}
              >
                {isCoachingSparring ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                {isCoachingSparring
                  ? "Coaching…"
                  : session
                    ? "Coach with Muse Spark"
                    : incident.isDemo
                      ? "Coach response (demo)"
                      : "Sign in for AI coach"}
              </Button>
            </div>
            {sparringReview.length > 0 && (
              <div className="border-l-2 border-primary px-4 py-3" role="status">
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  <HeartHandshake className="h-4 w-4 text-primary" /> Practice notes
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {sparringReview.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="border-t border-border pt-4 text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">Current holding line</p>
              <p>
                {draftText
                  ? draftText
                      .split("\n")
                      .find((line) => line.trim() && !line.toUpperCase().includes("FICTIONAL"))
                  : "Generate or review a holding line in Draft Studio first."}
              </p>
              <Button
                variant="link"
                className="mt-2 h-auto p-0"
                onClick={() => setActiveView("drafts")}
              >
                Open Draft Studio <ArrowRight />
              </Button>
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
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Private team settings
          </p>
          <h1 className="font-serif text-3xl">Church & response team</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Keep trusted leadership roles and response contacts ready for future incidents. Only
            your signed-in account can access this profile.
          </p>
        </div>
        {!session ? (
          <SignedOutPanel onSignIn={() => void navigate({ to: "/auth" })} />
        ) : (
          <div className="space-y-8">
            <div className="max-w-2xl space-y-2">
              <Label htmlFor="church-name">Church name</Label>
              <Input
                id="church-name"
                value={profile.churchName}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, churchName: event.target.value }))
                }
                placeholder="Your church or ministry"
              />
            </div>
            <div className="border-t border-border pt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Leadership team roles</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    List a role and the person who currently fills it.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      leadershipRoles: [...current.leadershipRoles, { role: "", name: "" }],
                    }))
                  }
                >
                  <Plus /> Add role
                </Button>
              </div>
              <div className="space-y-3">
                {profile.leadershipRoles.map((entry, index) => (
                  <div key={`role-${index}`} className="grid gap-3 sm:grid-cols-[1fr_1fr_2.5rem]">
                    <Input
                      aria-label={`Leadership role ${index + 1}`}
                      value={entry.role}
                      onChange={(event) => updateRole(index, "role", event.target.value)}
                      placeholder="Role — e.g. Board chair"
                    />
                    <Input
                      aria-label={`Person for role ${index + 1}`}
                      value={entry.name}
                      onChange={(event) => updateRole(index, "name", event.target.value)}
                      placeholder="Name"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove role ${index + 1}`}
                      title="Remove role"
                      onClick={() =>
                        setProfile((current) => ({
                          ...current,
                          leadershipRoles: current.leadershipRoles.filter(
                            (_, rowIndex) => rowIndex !== index,
                          ),
                        }))
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                {profile.leadershipRoles.length === 0 && (
                  <p className="text-sm text-muted-foreground">No leadership roles added.</p>
                )}
              </div>
            </div>
            <div className="border-t border-border pt-6">
              <h2 className="font-semibold">Response contacts</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-spokesperson">Designated spokesperson</Label>
                  <Input
                    id="profile-spokesperson"
                    value={profile.contactPreferences.spokespersonName}
                    onChange={(event) => updateContact("spokespersonName", event.target.value)}
                    placeholder="Name or role"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="press-email">Official press contact email</Label>
                  <Input
                    id="press-email"
                    type="email"
                    value={profile.contactPreferences.pressEmail}
                    onChange={(event) => updateContact("pressEmail", event.target.value)}
                    placeholder="[official press contact]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="risk-contact">Legal / insurer risk contact</Label>
                  <Input
                    id="risk-contact"
                    value={profile.contactPreferences.riskContact}
                    onChange={(event) => updateContact("riskContact", event.target.value)}
                    placeholder="Risk line, insurer, or counsel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-channel">Preferred contact channel</Label>
                  <Select
                    value={profile.contactPreferences.preferredChannel}
                    onValueChange={(value) =>
                      updateContact(
                        "preferredChannel",
                        value as TeamProfileData["contactPreferences"]["preferredChannel"],
                      )
                    }
                  >
                    <SelectTrigger id="contact-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="secure_messaging">Secure messaging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="counseling-referral">
                    Licensed counseling & care referral directory
                  </Label>
                  <Input
                    id="counseling-referral"
                    value={profile.contactPreferences.counselingReferral ?? ""}
                    onChange={(event) => updateContact("counselingReferral", event.target.value)}
                    placeholder="e.g. Hope Care Counseling (555-0199) · care@church.org · 988 Lifeline"
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically included in Congregation Sunday addresses and exports.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <Button onClick={() => void saveProfile()}>
                <Save /> Save church profile
              </Button>
              {profileNotice && (
                <p className="text-sm text-muted-foreground" role="status">
                  {profileNotice}
                </p>
              )}
            </div>

            <div className="border-t border-border pt-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold">
                    <Users className="h-4 w-4 text-primary" /> Church workspace & team memberships
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Share incidents, profiles, and saved drafts with authorized members. Layer 5
                    counseling notes remain restricted to owners, executive, and pastoral roles.
                  </p>
                </div>
                {churchWorkspace.myRole && (
                  <Badge variant="secondary">Your role: {churchWorkspace.myRole}</Badge>
                )}
              </div>

              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span>Your User ID:</span>
                <code className="font-mono text-foreground">{session.user.id}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    void navigator.clipboard.writeText(session.user.id);
                    setChurchNotice("User ID copied.");
                  }}
                >
                  <Copy className="h-3 w-3" /> Copy ID
                </Button>
              </div>

              {!churchWorkspace.church ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1 space-y-2">
                    <Label htmlFor="new-church-name">Create a shared church workspace</Label>
                    <Input
                      id="new-church-name"
                      value={newChurchName}
                      onChange={(event) => setNewChurchName(event.target.value)}
                      placeholder={profile.churchName || "e.g. Grace Community Church"}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void createChurch()}
                    disabled={isUpdatingChurch || !newChurchName.trim()}
                  >
                    {isUpdatingChurch ? <LoaderCircle className="animate-spin" /> : <Plus />} Create
                    workspace
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Active workspace</p>
                      <p className="font-semibold">{churchWorkspace.church.name}</p>
                    </div>
                    <Badge variant="outline">
                      {churchWorkspace.members.length} member
                      {churchWorkspace.members.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {churchWorkspace.members.map((member) => {
                      const isCreator = churchWorkspace.church?.created_by === session.user.id;
                      const isSelf = member.user_id === session.user.id;
                      return (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {member.email} {isSelf ? "(you)" : ""}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {member.user_id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCreator && !isSelf ? (
                              <>
                                <Select
                                  value={member.role}
                                  onValueChange={(value) =>
                                    void changeMemberRole(member.id, value as RecipientTier)
                                  }
                                >
                                  <SelectTrigger className="h-8 w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {RECIPIENT_TIERS.map((tier) => (
                                      <SelectItem key={tier.id} value={tier.id}>
                                        {tier.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  aria-label={`Remove ${member.email}`}
                                  onClick={() => void deleteMemberFromChurch(member.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Badge variant="outline">{member.role}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {churchWorkspace.church.created_by === session.user.id && (
                    <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_11rem_auto]">
                      <Input
                        aria-label="Member User ID"
                        value={memberUserIdInput}
                        onChange={(event) => setMemberUserIdInput(event.target.value)}
                        placeholder="Teammate User ID (UUID)"
                      />
                      <Input
                        aria-label="Member email"
                        type="email"
                        value={memberEmailInput}
                        onChange={(event) => setMemberEmailInput(event.target.value)}
                        placeholder="teammate@church.org"
                      />
                      <Select
                        value={memberRoleInput}
                        onValueChange={(value) => setMemberRoleInput(value as RecipientTier)}
                      >
                        <SelectTrigger aria-label="Member role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECIPIENT_TIERS.map((tier) => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={() => void addMemberToChurch()}
                        disabled={
                          isUpdatingChurch || !memberUserIdInput.trim() || !memberEmailInput.trim()
                        }
                      >
                        <Plus /> Add member
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {churchNotice && (
                <p className="mt-3 text-sm text-muted-foreground" role="status">
                  {churchNotice}
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderVault() {
    const restrictedByChurchRole = Boolean(
      churchWorkspace.myRole &&
      churchWorkspace.myRole !== "executive" &&
      churchWorkspace.myRole !== "pastoral",
    );
    return (
      <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
        <div className="mb-7 flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-warning/20 text-warning-foreground">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Layer 5 · separate private record
            </p>
            <h1 className="font-serif text-3xl">Counseling vault</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Confessional, therapy, marital counseling, and addiction notes remain here. They are
              stored separately and are never sent to AI drafting.
            </p>
            {restrictedByChurchRole && (
              <p className="mt-2 text-xs text-warning-foreground">
                Your church role is "{churchWorkspace.myRole}". Shared church counseling notes are
                restricted to executive and pastoral roles (owners still see their own notes).
              </p>
            )}
          </div>
        </div>
        {!session ? (
          <SignedOutPanel onSignIn={() => void navigate({ to: "/auth" })} />
        ) : incident.isDemo || !incident.id ? (
          <div className="border-y border-warning px-4 py-5">
            <p className="font-medium">Save a real incident before adding a private note.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fictional scenarios cannot hold counseling records. Start a new incident and save it
              first.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                chooseScenario("new");
                setActiveView("incident");
              }}
            >
              <Plus /> New incident
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <Label htmlFor="vault-note">Private counseling note · {incident.title}</Label>
              <Textarea
                id="vault-note"
                value={vaultDraft}
                onChange={(event) => setVaultDraft(event.target.value)}
                placeholder="Confidential pastoral-care notes…"
                className="min-h-48 bg-background"
              />
              <Button onClick={() => void saveVaultNote()} disabled={isSavingVault}>
                {isSavingVault ? <LoaderCircle className="animate-spin" /> : <Save />} Save in
                private vault
              </Button>
              {vaultNotice && (
                <p className="text-sm text-muted-foreground" role="status">
                  {vaultNotice}
                </p>
              )}
              <p className="border-l-2 border-warning px-3 py-2 text-sm text-warning-foreground">
                Not available to the draft generator. The counseling vault is a separate record.
              </p>
            </div>
            <div className="border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <h2 className="mb-4 font-semibold">Saved private notes</h2>
              {vaultNotes.length ? (
                <ol className="space-y-4">
                  {vaultNotes.map((note) => (
                    <li key={note.id} className="border-b border-border pb-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Edit private counseling note"
                            onClick={() => {
                              setEditingVaultId(note.id);
                              setEditingVaultText(note.note);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            aria-label="Delete private counseling note"
                            onClick={() => setDeletingVaultId(note.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {editingVaultId === note.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingVaultText}
                            onChange={(event) => setEditingVaultText(event.target.value)}
                            className="min-h-28 bg-background text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => void saveEditedVaultNote(note.id)}
                              disabled={isSavingVault || !editingVaultText.trim()}
                            >
                              Save changes
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingVaultId(null);
                                setEditingVaultText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">{note.note}</p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No private notes saved for this incident.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  const currentNav = NAV_ITEMS.find((item) => item.id === activeView) ?? NAV_ITEMS[0];
  const publicHoldsCount = getDraftBlockers("press", incident, draftGate, profile).length;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="flex flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:min-h-screen lg:border-b-0 lg:border-r">
          <Link
            to="/"
            className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5 transition-colors hover:bg-sidebar-accent/40"
          >
            <GraceGuardLogo className="h-10 w-10 shrink-0" />
            <div>
              <p className="font-serif text-xl font-semibold tracking-tight">GraceGuard</p>
              <p className="text-xs text-muted-foreground">Crisis response desk</p>
            </div>
          </Link>
          <nav
            aria-label="Workspace"
            className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const badgeText =
                item.id === "incident" && publicHoldsCount > 0
                  ? `${publicHoldsCount} hold${publicHoldsCount === 1 ? "" : "s"}`
                  : item.id === "drafts"
                    ? `${approvedCount}/4`
                    : null;
              return (
                <Button
                  key={item.id}
                  variant={activeView === item.id ? "secondary" : "ghost"}
                  className={`justify-between whitespace-nowrap ${
                    activeView === item.id ? "font-semibold shadow-xs" : "text-muted-foreground"
                  }`}
                  onClick={() => setActiveView(item.id)}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {item.label}
                  </span>
                  {badgeText && (
                    <Badge
                      variant="outline"
                      className={`ml-2 text-[10px] ${
                        item.id === "incident" && publicHoldsCount > 0
                          ? "border-warning text-warning-foreground"
                          : ""
                      }`}
                    >
                      {badgeText}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </nav>
          <div className="hidden border-t border-sidebar-border px-4 py-4 lg:block">
            <div className="rounded-xl border border-border bg-card p-3.5 text-xs text-muted-foreground shadow-xs">
              <div className="mb-1.5 flex items-center gap-2 font-medium text-foreground">
                <LockKeyhole className="h-3.5 w-3.5 text-primary" /> Counseling Firewall
              </div>
              Layer 5 is physically isolated. Drafts include only whitelisted facts and guidance.
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur-xs sm:px-8">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{currentNav?.label ?? "Workspace"}</span>
              <ChevronRight className="h-4 w-4" />
              <span className="max-w-[14rem] truncate font-medium text-foreground">
                {incident.title}
              </span>
              {incident.isDemo ? (
                <Badge
                  variant="outline"
                  className="border-warning/60 bg-warning/10 text-warning-foreground"
                >
                  Fictional demo
                </Badge>
              ) : hasUnsavedChanges ? (
                <Badge variant="outline" className="border-warning/60 text-warning-foreground">
                  Unsaved
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-success">
                  {autoSaveStatus || "Saved"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {ready && session ? (
                <>
                  <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground sm:inline">
                    {session.user.email}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void signOut()} title="Sign out">
                    <LogOut /> Sign out
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to="/auth">
                    <LockKeyhole /> Sign in to save
                  </Link>
                </Button>
              )}
            </div>
          </header>

          {!session && showJudgeGuide && (
            <div className="border-b border-border bg-muted/40 px-5 py-3 sm:px-8">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="font-semibold">
                    60s Judge Walkthrough
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      chooseScenario("demo-pastor");
                      setActiveView("incident");
                    }}
                  >
                    1. See Safety Hold
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setActiveView("incident");
                      setWorkTab("layers");
                    }}
                  >
                    2. Inspect 5 Layers
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setActiveView("drafts")}
                  >
                    3. Preview 4 Voices
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setActiveView("sparring")}
                  >
                    4. Spar Hard Questions
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setShowJudgeGuide(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {activeView === "incident" && renderIncidentDesk()}
          {activeView === "drafts" && renderDraftStudio()}
          {activeView === "sparring" && renderSparring()}
          {activeView === "profile" && renderProfile()}
          {activeView === "vault" && renderVault()}

          <footer className="border-t border-border px-5 py-4 text-center text-xs text-muted-foreground sm:px-8">
            Drafts are not approved for release. Follow your church's safeguarding, reporting,
            legal, and pastoral-care protocols.
          </footer>
        </div>
      </div>

      <AlertDialog
        open={pendingScenario !== null}
        onOpenChange={(open) => {
          if (!open) setPendingScenario(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved incident changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits on "{incident.title}". Switching scenarios now will discard
              those local changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingScenario) applyScenario(pendingScenario);
                setPendingScenario(null);
              }}
            >
              Discard and switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteIncident} onOpenChange={setConfirmDeleteIncident}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete private incident record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{incident.title}" and any linked counseling vault notes from
              your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void deleteCurrentIncident()}
            >
              Delete incident
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deletingVaultId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingVaultId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete counseling note?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected note from the separate counseling vault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmRemoveVaultNote()}
            >
              Delete note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {AUDIENCES.find((item) => item.id === draftAudience)?.label} ·{" "}
              {draftAudience === "congregation"
                ? "Pulpit reading view"
                : draftAudience === "staff"
                  ? "Pocket holding card"
                  : draftAudience === "board"
                    ? "Board packet view"
                    : "Press statement view"}
            </DialogTitle>
            <DialogDescription>
              {draftApproval
                ? `Approved by ${draftApproval.approvedBy} on ${new Date(draftApproval.approvedAt).toLocaleString()}.`
                : "Draft only — confirm leader review and safety locks before distributing."}
            </DialogDescription>
          </DialogHeader>
          <div className="graceguard-print-sheet rounded-md border border-border bg-muted/20 p-5">
            <pre
              className={`whitespace-pre-wrap ${
                draftAudience === "congregation"
                  ? "font-serif text-lg leading-relaxed"
                  : "font-sans text-sm leading-6"
              }`}
            >
              {formatAudienceExport(draftAudience, draftText, incident, profile, draftApproval)}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={downloadDraft}>
              <Download /> Download .txt
            </Button>
            <Button onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SignedOutPanel({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">Sign in to access private records</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your fictional demo stays available without saving case information.
          </p>
        </div>
      </div>
      <Button onClick={onSignIn}>
        Sign in <ArrowRight />
      </Button>
    </div>
  );
}

function Clock3Icon() {
  return <Activity className="h-4 w-4 text-primary" aria-hidden="true" />;
}
