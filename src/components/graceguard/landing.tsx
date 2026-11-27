import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  HeartHandshake,
  LockKeyhole,
  Megaphone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { GraceGuardLogo } from "@/components/graceguard/logo";
import { ThemeToggle } from "@/components/graceguard/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCloudAuth } from "@/lib/auth-context";

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Pause & assess interlocks",
    description:
      "Hard gates hold congregation and public statements until 911 status, next-of-kin notification, legal/insurer risk contact, and a single spokesperson are confirmed.",
  },
  {
    icon: LockKeyhole,
    title: "5-layer counseling firewall",
    description:
      "Confessional, marital counseling, and therapy notes live in a physically separate vault restricted to owners, executive, and pastoral roles—never sent to AI drafting.",
  },
  {
    icon: FileText,
    title: "Four audience-specific voices",
    description:
      "Prepare confidential Elder briefings, 30-second Staff pocket scripts, Scripture-grounded Sunday addresses, and zero-fault Press holding statements from one triage record.",
  },
  {
    icon: Megaphone,
    title: "Red-line critic & lobby sparring",
    description:
      "Catch liability admissions, unverified rumors, and cold corporate phrasing before release, then rehearse hard questions against your approved holding lines.",
  },
];

const LAYERS = [
  {
    layer: "Layer 1",
    name: "Verified baseline facts & chronology",
    scope: "Included across authorized drafts",
    tone: "bg-success/10 text-success border-success/30",
  },
  {
    layer: "Layer 2",
    name: "Pastoral guidance & prayer points",
    scope: "Included for care-centered messaging",
    tone: "bg-primary/10 text-primary border-primary/25",
  },
  {
    layer: "Layer 3",
    name: "Legal strategy & liability notes",
    scope: "Restricted to Elder / Board briefings only",
    tone: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  {
    layer: "Layer 4",
    name: "Medical & family care details",
    scope: "Excluded from every AI drafting payload",
    tone: "bg-muted text-muted-foreground border-border",
  },
  {
    layer: "Layer 5",
    name: "Confidential counseling & confessional vault",
    scope: "Physically separate table · Executive & Pastoral RLS only",
    tone: "bg-destructive/10 text-destructive border-destructive/30",
  },
];

const AUDIENCE_CARDS = [
  {
    audience: "Elder / Board Briefing",
    tier: "Governing Elders+",
    summary:
      "Unvarnished chronology, explicitly labeled unconfirmed claims, governance actions, risk notes, and board voting checklist.",
  },
  {
    audience: "Staff & Volunteers",
    tier: "Volunteers+",
    summary:
      "30-second spoken pocket script for greeters and youth leaders with a compassionate holding line and spokesperson redirect.",
  },
  {
    audience: "Sunday Congregation",
    tier: "Pastoral Staff+",
    summary:
      "Spoken pastoral address anchored in Psalm 34:18, community prayer, and counseling support—with zero legal speculation.",
  },
  {
    audience: "Public & Press FAQ",
    tier: "Governing Elders+",
    summary:
      "Zero-fault holding statement, verified facts only, condolences, four concise FAQ answers, and official press contact.",
  },
];

export default function GraceGuardLanding() {
  const { session, ready } = useCloudAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <GraceGuardLogo className="h-9 w-9 shrink-0" />
            <div>
              <span className="font-serif text-xl font-semibold tracking-tight">GraceGuard</span>
              <span className="ml-2 hidden rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
                PR Copilot
              </span>
            </div>
          </Link>

          <nav
            aria-label="Overview"
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
          >
            <a href="#pillars" className="transition-colors hover:text-foreground">
              Capabilities
            </a>
            <a href="#firewall" className="transition-colors hover:text-foreground">
              Counseling firewall
            </a>
            <a href="#audiences" className="transition-colors hover:text-foreground">
              Four voices
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {ready && session ? (
              <Button asChild size="sm">
                <Link to="/workspace">
                  Open workspace <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/workspace">
                    Try workspace <ArrowRight />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
            <div>
              <Badge
                variant="outline"
                className="mb-5 border-primary/25 bg-card px-3 py-1 text-xs font-medium text-primary"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Crisis & sensitive communications for
                churches
              </Badge>
              <h1 className="font-serif text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Steady, caring words when your church is in crisis.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                GraceGuard helps pastors, elders, and communications leads slow down under
                pressure—separating confirmed facts from rumors, clearing safety interlocks, and
                drafting four careful statements while keeping counseling notes physically
                quarantined.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/workspace">
                    Open crisis workspace <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/auth">
                    <LockKeyhole /> {session ? "Account active" : "Sign in to save cases"}
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Two fictional demo scenarios load immediately—no account required to explore safety
                locks and drafting workflows.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <GraceGuardLogo className="h-7 w-7" />
                  <div>
                    <p className="text-sm font-semibold">Release Readiness Preview</p>
                    <p className="text-xs text-muted-foreground">
                      Youth retreat bus accident · demo
                    </p>
                  </div>
                </div>
                <Badge
                  className="border border-success/30 bg-success/10 text-success"
                  variant="secondary"
                >
                  4 / 4 checks clear
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-success" /> Emergency services &
                    next-of-kin
                  </span>
                  <span className="text-xs text-success">Confirmed</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <ShieldAlert className="h-4 w-4 text-warning-foreground" /> Unconfirmed social
                    posts
                  </span>
                  <span className="text-xs text-warning-foreground">Held internal</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <LockKeyhole className="h-4 w-4 text-destructive" /> Layer 5 counseling vault
                  </span>
                  <span className="text-xs text-destructive">Quarantined</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 text-xs">
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="font-semibold">Elder / Board</p>
                  <p className="text-muted-foreground">Chronology + checklist</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="font-semibold">Staff Pocket Card</p>
                  <p className="text-muted-foreground">30s spoken script</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="font-semibold">Sunday Address</p>
                  <p className="text-muted-foreground">Lament + care support</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="font-semibold">Public & Press</p>
                  <p className="text-muted-foreground">Zero-fault FAQ</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pillars" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Built for the first 60 minutes
            </p>
            <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight">
              Safeguards before speed
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every control in GraceGuard is designed to prevent premature public statements,
              protect clergy-penitent privilege, and keep leadership aligned around verified facts.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="rounded-xl border border-border bg-card p-6 shadow-xs transition-colors hover:border-primary/30"
                >
                  <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="firewall" className="border-y border-border bg-muted/30 py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data segregation architecture
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight">
                  Five information layers. One strict firewall.
                </h2>
              </div>
              <Badge variant="outline" className="border-destructive/30 bg-card text-destructive">
                <LockKeyhole className="mr-1.5 h-3.5 w-3.5" /> Layer 5 never enters AI prompts
              </Badge>
            </div>

            <div className="space-y-3">
              {LAYERS.map((item) => (
                <div
                  key={item.layer}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-xs"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs font-semibold uppercase text-muted-foreground">
                      {item.layer}
                    </span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <Badge variant="outline" className={item.tone}>
                    {item.scope}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="audiences" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Multi-audience draft studio
            </p>
            <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight">
              One incident, four careful voices
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Each audience receives only the clearance-appropriate facts and tone it needs—with
              leader sign-off tracking and print-ready pulpit, pocket-card, and board-packet
              exports.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCE_CARDS.map((card) => (
              <div
                key={card.audience}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs"
              >
                <div>
                  <Badge variant="secondary" className="mb-3 text-[11px]">
                    {card.tier}
                  </Badge>
                  <h3 className="font-semibold">{card.audience}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-muted/40 py-14">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 sm:px-8">
            <div className="max-w-xl">
              <h2 className="font-serif text-2xl font-medium sm:text-3xl">
                Ready to rehearse with your leadership team?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Open the workspace to test fictional scenarios right away, or sign in to create your
                church workspace and invite elders and pastoral staff.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/workspace">
                  <HeartHandshake /> Enter GraceGuard workspace
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/auth">
                  <Users /> Sign in / Team setup
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground sm:px-8">
        GraceGuard PR · Drafts require designated leader review and legal/safeguarding compliance
        before release.
      </footer>
    </div>
  );
}
