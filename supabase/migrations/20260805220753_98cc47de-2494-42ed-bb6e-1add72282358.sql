-- 1. Identificar e remover linhas que se tornariam duplicatas após a normalização
WITH normalized_groups AS (
  SELECT 
    id,
    ROW_NUMBER() OVER(
      PARTITION BY 
        kind, 
        numero, 
        entidade_doc, 
        CASE 
          WHEN unidade_negocio ILIKE 'PreverMed' THEN '28309721000105'
          WHEN unidade_negocio LIKE '%|%' THEN regexp_replace(split_part(unidade_negocio, '|', 1), '\D', '', 'g')
          ELSE unidade_negocio
        END,
        dedupe_vencimento
      ORDER BY 
        CASE WHEN situacao = 'Paga' THEN 0 ELSE 1 END,
        updated_at DESC
    ) as rnk
  FROM invoices
)
DELETE FROM invoices 
WHERE id IN (SELECT id FROM normalized_groups WHERE rnk > 1);

-- 2. Agora que não há mais conflitos, aplicar a normalização
UPDATE invoices
SET unidade_negocio = CASE 
  WHEN unidade_negocio ILIKE 'PreverMed' THEN '28309721000105'
  WHEN unidade_negocio LIKE '%|%' THEN regexp_replace(split_part(unidade_negocio, '|', 1), '\D', '', 'g')
  ELSE unidade_negocio
END
WHERE unidade_negocio ILIKE 'PreverMed' OR unidade_negocio LIKE '%|%';
