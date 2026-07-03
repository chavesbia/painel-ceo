DROP POLICY IF EXISTS "Authenticated can insert snapshots" ON public.dashboard_snapshots;
CREATE POLICY "Authenticated can insert snapshots"
  ON public.dashboard_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);