
CREATE TYPE public.invoice_kind AS ENUM ('receivable','payable');

CREATE TABLE public.imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind public.invoice_kind NOT NULL,
  filename TEXT NOT NULL,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.imports TO anon, authenticated;
GRANT ALL ON public.imports TO service_role;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read imports" ON public.imports FOR SELECT USING (true);

CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind public.invoice_kind NOT NULL,
  numero TEXT NOT NULL,
  unidade_negocio TEXT,
  entidade TEXT,
  entidade_doc TEXT,
  valor_parcela NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_pago NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_fatura NUMERIC(14,2),
  situacao TEXT,
  data_competencia DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  forma_pagamento TEXT,
  conta_bancaria TEXT,
  plano_contas TEXT,
  centro_custos TEXT,
  origem TEXT,
  descricao TEXT,
  numero_nota TEXT,
  data_cadastro DATE,
  criado_por TEXT,
  import_id UUID REFERENCES public.imports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, numero, entidade_doc, data_vencimento)
);

CREATE INDEX invoices_kind_venc_idx ON public.invoices (kind, data_vencimento);
CREATE INDEX invoices_situacao_idx ON public.invoices (situacao);

GRANT SELECT ON public.invoices TO anon, authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read invoices" ON public.invoices FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
