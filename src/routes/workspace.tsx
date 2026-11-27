import { createFileRoute } from "@tanstack/react-router";

import GraceGuardWorkspace from "@/components/graceguard/workspace";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace · GraceGuard PR" },
      {
        name: "description",
        content:
          "Triage incidents, clear safety interlocks, and prepare audience-specific crisis drafts.",
      },
      { property: "og:title", content: "Workspace · GraceGuard PR" },
      {
        property: "og:description",
        content:
          "Triage incidents, clear safety interlocks, and prepare audience-specific crisis drafts.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: GraceGuardWorkspace,
});
