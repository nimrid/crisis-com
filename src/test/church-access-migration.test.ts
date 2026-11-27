import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0002_church_memberships_and_audience_drafts.sql"),
  "utf8",
);

describe("GraceGuard church access migration", () => {
  it("limits church memberships to the four approved tiers", () => {
    expect(migration).toContain(
      "CHECK (role IN ('executive', 'elders', 'pastoral', 'volunteers'))",
    );
  });

  it("shares incidents and profiles with church members but keeps counseling notes restricted", () => {
    expect(migration).toMatch(
      /CREATE POLICY "Owners and church members manage incident records"[\s\S]*?owner_id = \(SELECT auth\.uid\(\)\)[\s\S]*?graceguard_is_church_member\(church_id\)/,
    );
    expect(migration).toMatch(
      /CREATE POLICY "Owners and church members manage team profiles"[\s\S]*?user_id = \(SELECT auth\.uid\(\)\)[\s\S]*?graceguard_is_church_member\(church_id\)/,
    );

    const counselingPolicy = migration.match(
      /CREATE POLICY "Owners and approved church members manage counseling vault"[\s\S]*?;/,
    );
    expect(counselingPolicy).not.toBeNull();
    if (!counselingPolicy) return;

    expect(counselingPolicy[0]).toContain("owner_id = (SELECT auth.uid())");
    expect(counselingPolicy[0]).toContain("ARRAY['executive', 'pastoral']::text[]");
    expect(counselingPolicy[0]).not.toContain("'elders'");
  });

  it("limits saved drafts to the four approved audiences and owner/member access", () => {
    expect(migration).toContain(
      "CHECK (audience IN ('board', 'staff', 'congregation', 'press'))",
    );
    expect(migration).toMatch(
      /CREATE POLICY "Owners and church members manage audience drafts"[\s\S]*?owner_id = \(SELECT auth\.uid\(\)\)[\s\S]*?graceguard_is_church_member\(church_id\)/,
    );
  });
});