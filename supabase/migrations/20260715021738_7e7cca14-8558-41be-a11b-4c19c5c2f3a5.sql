ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_kind_numero_entidade_doc_data_vencimento_key;

DROP INDEX IF EXISTS public.invoices_kind_numero_entidade_doc_data_vencimento_key;

CREATE UNIQUE INDEX invoices_kind_numero_entidade_doc_data_vencimento_key
  ON public.invoices (kind, numero, entidade_doc, data_vencimento)
  NULLS NOT DISTINCT;