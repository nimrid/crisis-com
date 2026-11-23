CREATE TABLE public.team_profiles (
  user_id uuid PRIMARY KEY,
  church_name text NOT NULL DEFAULT '',
  leadership_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_profiles TO authenticated;
GRANT ALL ON public.team_profiles TO service_role;
ALTER TABLE public.team_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their team profile" ON public.team_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.incident_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  situation_type text NOT NULL,
  intake_notes text NOT NULL DEFAULT '',
  confirmed_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed_parties jsonb NOT NULL DEFAULT '[]'::jsonb,
  unconfirmed_rumors jsonb NOT NULL DEFAULT '[]'::jsonb,
  pastoral_guidance jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  medical_family_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_gates jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_records TO authenticated;
GRANT ALL ON public.incident_records TO service_role;
ALTER TABLE public.incident_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their incident records" ON public.incident_records FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX incident_records_owner_created_idx ON public.incident_records (owner_id, created_at DESC);

CREATE TABLE public.counseling_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (incident_id, owner_id) REFERENCES public.incident_records (id, owner_id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.counseling_vault TO authenticated;
GRANT ALL ON public.counseling_vault TO service_role;
ALTER TABLE public.counseling_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their counseling vault" ON public.counseling_vault FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX counseling_vault_owner_incident_idx ON public.counseling_vault (owner_id, incident_id);