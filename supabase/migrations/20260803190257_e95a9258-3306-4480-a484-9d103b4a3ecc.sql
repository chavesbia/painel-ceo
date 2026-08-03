-- Limpeza dos 323 grupos duplicados por normalização de espaço
-- Regra: Remover as linhas antigas (29/07) e manter as novas (03/08)
-- nos grupos onde a única diferença é o espaço duplo em unidade_negocio

WITH to_delete AS (
    SELECT old.id
    FROM public.invoices old
    JOIN public.invoices new ON 
        old.kind = new.kind AND 
        old.numero = new.numero AND 
        old.entidade_doc = new.entidade_doc AND 
        (old.dedupe_vencimento IS NOT DISTINCT FROM new.dedupe_vencimento)
    WHERE 
        old.id != new.id AND
        old.unidade_negocio LIKE '%  %' AND
        new.unidade_negocio NOT LIKE '%  %' AND
        old.created_at < '2026-08-01' AND
        new.created_at >= '2026-08-01'
)
DELETE FROM public.invoices
WHERE id IN (SELECT id FROM to_delete);

-- Atualiza o último registro de saúde para refletir que as duplicatas foram limpas
UPDATE public.import_health_checks
SET 
  duplicate_groups = 0,
  duplicate_excess_rows = 0,
  duplicate_excess_valor = 0,
  details = details || '{"cleaned": true, "reason": "normalization_cleanup"}'::jsonb
WHERE id = (SELECT id FROM public.import_health_checks ORDER BY checked_at DESC LIMIT 1);
