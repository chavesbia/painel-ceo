-- 1. Colunas adicionais na tabela de importações
ALTER TABLE public.imports
  ADD COLUMN IF NOT EXISTS rows_inserted integer,
  ADD COLUMN IF NOT EXISTS rows_updated  integer;

-- 2. Tabela de checagens de saúde
CREATE TABLE IF NOT EXISTS public.import_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('import','cron')),
  import_id uuid REFERENCES public.imports(id) ON DELETE SET NULL,
  rows_inserted integer,
  rows_updated  integer,
  rows_skipped  integer,
  duplicate_groups        integer NOT NULL DEFAULT 0,
  duplicate_excess_rows   integer NOT NULL DEFAULT 0,
  duplicate_excess_valor  numeric(14,2) NOT NULL DEFAULT 0,
  details jsonb
);

GRANT SELECT, INSERT ON public.import_health_checks TO authenticated;
GRANT ALL ON public.import_health_checks TO service_role;

ALTER TABLE public.import_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read import_health_checks"
  ON public.import_health_checks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages import_health_checks"
  ON public.import_health_checks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS import_health_checks_checked_at_idx
  ON public.import_health_checks (checked_at DESC);

-- 3. Função que executa a checagem diária (usada pelo pg_cron)
CREATE OR REPLACE FUNCTION public.run_daily_import_health_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_groups integer;
  v_excess integer;
  v_valor  numeric(14,2);
BEGIN
  WITH dups AS (
    SELECT kind, numero, entidade, unidade_negocio, data_vencimento, valor_parcela,
           COUNT(*) AS qtd
    FROM public.invoices
    GROUP BY kind, numero, entidade, unidade_negocio, data_vencimento, valor_parcela
    HAVING COUNT(*) > 1
  )
  SELECT COUNT(*)::int,
         COALESCE(SUM(qtd - 1), 0)::int,
         COALESCE(SUM((qtd - 1) * COALESCE(valor_parcela,0)), 0)::numeric(14,2)
  INTO v_groups, v_excess, v_valor
  FROM dups;

  INSERT INTO public.import_health_checks
    (source, duplicate_groups, duplicate_excess_rows, duplicate_excess_valor)
  VALUES ('cron', v_groups, v_excess, v_valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_daily_import_health_check() TO service_role;
