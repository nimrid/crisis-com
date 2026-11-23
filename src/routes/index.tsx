import { createFileRoute } from "@tanstack/react-router";

import GraceGuardWorkspace from "@/components/graceguard/workspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GraceGuard · Crisis & Sensitive Communications" },
      { name: "description", content: "A protected crisis-response workspace for churches and ministries." },
      { property: "og:title", content: "GraceGuard · Crisis & Sensitive Communications" },
      { property: "og:description", content: "Triage incidents, apply safety holds, and prepare audience-specific drafts with a pastoral confidentiality firewall." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GraceGuardWorkspace,
});