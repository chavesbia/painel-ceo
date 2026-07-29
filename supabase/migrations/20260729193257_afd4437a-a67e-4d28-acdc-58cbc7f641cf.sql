-- 1) Remove duplicata legítima apenas do tipo "a receber" (prorrogação): mantém o vencimento mais recente
DELETE FROM public.invoices a
USING public.invoices b
WHERE a.kind = 'receivable'
  AND b.kind = 'receivable'
  AND a.numero = b.numero
  AND a.entidade_doc IS NOT DISTINCT FROM b.entidade_doc
  AND a.unidade_negocio IS NOT DISTINCT FROM b.unidade_negocio
  AND (a.data_vencimento IS NULL OR (b.data_vencimento IS NOT NULL AND a.data_vencimento < b.data_vencimento));

-- 2) Coluna gerada: vencimento entra na identidade apenas para "a pagar"
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS dedupe_vencimento date
  GENERATED ALWAYS AS (CASE WHEN kind = 'payable'::invoice_kind THEN data_vencimento ELSE NULL END) STORED;

-- 3) Nova chave única por tipo
DROP INDEX IF EXISTS public.invoices_kind_numero_entidade_doc_data_vencimento_key;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_identity_key
  ON public.invoices (kind, numero, entidade_doc, unidade_negocio, dedupe_vencimento)
  NULLS NOT DISTINCT;
