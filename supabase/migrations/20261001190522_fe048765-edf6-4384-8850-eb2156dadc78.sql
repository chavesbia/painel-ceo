CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

DROP POLICY IF EXISTS "invoices: autenticado lê" ON public.invoices;
CREATE POLICY "invoices: usuários com papel leem" ON public.invoices FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "imports: autenticado lê" ON public.imports;
CREATE POLICY "imports: usuários com papel leem" ON public.imports FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read import_health_checks" ON public.import_health_checks;
CREATE POLICY "Users with role can read import_health_checks" ON public.import_health_checks FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view cash balances" ON public.cash_balances;
CREATE POLICY "Users with role can view cash balances" ON public.cash_balances FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read snapshots" ON public.dashboard_snapshots;
CREATE POLICY "Users with role can read snapshots" ON public.dashboard_snapshots FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can insert snapshots" ON public.dashboard_snapshots;
CREATE POLICY "Users with role can insert snapshots" ON public.dashboard_snapshots FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));