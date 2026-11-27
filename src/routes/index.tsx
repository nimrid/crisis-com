import { createFileRoute } from "@tanstack/react-router";

import GraceGuardLanding from "@/components/graceguard/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GraceGuard · Crisis & Sensitive Communications for Churches" },
      {
        name: "description",
        content:
          "Triage incidents, clear safety interlocks, quarantine counseling notes, and prepare audience-specific crisis drafts.",
      },
      {
        property: "og:title",
        content: "GraceGuard · Crisis & Sensitive Communications for Churches",
      },
      {
        property: "og:description",
        content:
          "Triage incidents, apply safety holds, and prepare audience-specific drafts with a pastoral confidentiality firewall.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GraceGuardLanding,
});
