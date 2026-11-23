# GraceGuard PR implementation plan

## Build
- Replace the starter screen with a focused crisis-response workspace: incident intake, demo scenarios, safety interlocks, five segregated data layers, audience-specific draft studio, red-line review, and media sparring.
- Provide two preloaded fictional scenarios and visibly identify all demo details as fictional. Keep counseling/confessional notes physically separate from every generation request.
- Require safety checks before public-facing drafts become available; distinguish verified facts, unknowns, and rumors, and keep outputs labeled as unapproved drafts.
- Add signed-in access for real incident records and private storage with owner-scoped policies. Keep the demo usable without saving real case information. Include AI drafting only through a server-side Lovable AI call that accepts explicitly permitted layers and audience context; never accept counseling notes in that input.
- Add unique route metadata, mobile-friendly layouts, and focused tests for the safety and privacy rules.

## Technical details
- Use TanStack Start server functions for authenticated persistence and server-side AI generation; keep Lovable AI credentials and prompt construction off the browser.
- Store confidential counseling notes in a separate table with owner-only access. Keep incident layers and authorization state in a separate owner-scoped record. Never select counseling notes in drafting functions.
- Add database grants and row-level security policies for every application table; keep demo scenarios as fictional client-side fixtures rather than saved case records.
- If team profile information is needed, add only the profile fields confirmed by the user; otherwise use the authenticated account identity without a separate profile table.
- Use the project's existing Tailwind/shadcn tokens and controls, then verify route behavior, key gates, mobile layout, and the generated draft path.
