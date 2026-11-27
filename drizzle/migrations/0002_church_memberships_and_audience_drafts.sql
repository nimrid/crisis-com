CREATE TABLE public.churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.churches TO authenticated;
GRANT ALL ON public.churches TO service_role;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.church_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('executive', 'elders', 'pastoral', 'volunteers')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (church_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_members TO authenticated;
GRANT ALL ON public.church_members TO service_role;
ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.graceguard_is_church_member(_church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_members AS cm
    WHERE cm.church_id = _church_id
      AND cm.user_id = (SELECT auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.graceguard_is_church_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.graceguard_is_church_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.graceguard_has_church_role(_church_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_members AS cm
    WHERE cm.church_id = _church_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (_roles)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.graceguard_has_church_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.graceguard_has_church_role(uuid, text[]) TO authenticated, service_role;

CREATE POLICY "Church creators and members can view churches"
  ON public.churches FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = created_by OR (SELECT public.graceguard_is_church_member(id)));
CREATE POLICY "Church creators can create churches"
  ON public.churches FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "Church creators can update churches"
  ON public.churches FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = created_by)
  WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "Church creators can delete churches"
  ON public.churches FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = created_by);

CREATE POLICY "Members and creators can view church memberships"
  ON public.church_members FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.graceguard_is_church_member(church_id))
    OR EXISTS (
      SELECT 1
      FROM public.churches AS c
      WHERE c.id = church_members.church_id
        AND c.created_by = (SELECT auth.uid())
    )
  );
CREATE POLICY "Church creators can add memberships"
  ON public.church_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.churches AS c
      WHERE c.id = church_members.church_id
        AND c.created_by = (SELECT auth.uid())
    )
  );
CREATE POLICY "Church creators can update memberships"
  ON public.church_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.churches AS c
      WHERE c.id = church_members.church_id
        AND c.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.churches AS c
      WHERE c.id = church_members.church_id
        AND c.created_by = (SELECT auth.uid())
    )
  );
CREATE POLICY "Church creators can remove memberships"
  ON public.church_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.churches AS c
      WHERE c.id = church_members.church_id
        AND c.created_by = (SELECT auth.uid())
    )
  );

ALTER TABLE public.team_profiles
  ADD COLUMN church_id uuid REFERENCES public.churches(id) ON DELETE SET NULL;
ALTER TABLE public.incident_records
  ADD COLUMN church_id uuid REFERENCES public.churches(id) ON DELETE SET NULL;
ALTER TABLE public.counseling_vault
  ADD COLUMN church_id uuid REFERENCES public.churches(id) ON DELETE SET NULL;

CREATE INDEX churches_created_by_idx ON public.churches (created_by);
CREATE INDEX church_members_user_church_idx ON public.church_members (user_id, church_id);
CREATE INDEX team_profiles_church_id_idx ON public.team_profiles (church_id);
CREATE INDEX incident_records_church_id_idx ON public.incident_records (church_id);
CREATE INDEX counseling_vault_church_id_idx ON public.counseling_vault (church_id);

DROP POLICY IF EXISTS "Owners manage their team profile" ON public.team_profiles;
CREATE POLICY "Owners and church members manage team profiles"
  ON public.team_profiles FOR ALL TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (church_id IS NOT NULL AND (SELECT public.graceguard_is_church_member(church_id)))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (church_id IS NOT NULL AND (SELECT public.graceguard_is_church_member(church_id)))
  );

DROP POLICY IF EXISTS "Owners manage their incident records" ON public.incident_records;
CREATE POLICY "Owners and church members manage incident records"
  ON public.incident_records FOR ALL TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR (church_id IS NOT NULL AND (SELECT public.graceguard_is_church_member(church_id)))
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR (church_id IS NOT NULL AND (SELECT public.graceguard_is_church_member(church_id)))
  );

DROP POLICY IF EXISTS "Owners manage their counseling vault" ON public.counseling_vault;
CREATE POLICY "Owners and approved church members manage counseling vault"
  ON public.counseling_vault FOR ALL TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR (
      church_id IS NOT NULL
      AND (SELECT public.graceguard_has_church_role(church_id, ARRAY['executive', 'pastoral']::text[]))
    )
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR (
      church_id IS NOT NULL
      AND (SELECT public.graceguard_has_church_role(church_id, ARRAY['executive', 'pastoral']::text[]))
    )
  );

CREATE TABLE public.audience_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incident_records(id) ON DELETE CASCADE,
  church_id uuid REFERENCES public.churches(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  audience text NOT NULL CHECK (audience IN ('board', 'staff', 'congregation', 'press')),
  draft_text text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'edited',
  recipient_tier text NOT NULL DEFAULT 'elders',
  confidentiality_acknowledged boolean NOT NULL DEFAULT false,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, audience)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audience_drafts TO authenticated;
GRANT ALL ON public.audience_drafts TO service_role;
ALTER TABLE public.audience_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and church members manage audience drafts"
  ON public.audience_drafts FOR ALL TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR (church_id IS NOT NULL AND (SELECT public.graceguard_is_church_member(church_id)))
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR (church_id IS NOT NULL AND (SELECT public.graceguard_is_church_member(church_id)))
  );

CREATE INDEX audience_drafts_owner_updated_idx ON public.audience_drafts (owner_id, updated_at DESC);
CREATE INDEX audience_drafts_church_id_idx ON public.audience_drafts (church_id);