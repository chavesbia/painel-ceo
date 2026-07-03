CREATE TABLE public.dashboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL UNIQUE,
  saldo_bancario numeric NOT NULL DEFAULT 0,
  a_receber numeric NOT NULL DEFAULT 0,
  a_pagar numeric NOT NULL DEFAULT 0,
  vencidos_valor numeric NOT NULL DEFAULT 0,
  vencidos_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dashboard_snapshots TO authenticated;
GRANT ALL ON public.dashboard_snapshots TO service_role;
ALTER TABLE public.dashboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read snapshots" ON public.dashboard_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert snapshots" ON public.dashboard_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX dashboard_snapshots_date_idx ON public.dashboard_snapshots (snapshot_date DESC);