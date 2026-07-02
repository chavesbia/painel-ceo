
-- Índice para acelerar consultas do painel (filtra por situação pendente e data de vencimento)
CREATE INDEX IF NOT EXISTS idx_invoices_open ON public.invoices (data_vencimento) WHERE situacao IN ('Pendente','Protestada');
CREATE INDEX IF NOT EXISTS idx_invoices_kind_venc ON public.invoices (kind, data_vencimento);

-- Permitir que operadores (Bruna) também excluam saldos durante os testes.
DROP POLICY IF EXISTS "cash_balances delete admin" ON public.cash_balances;
DROP POLICY IF EXISTS "cash_balances delete" ON public.cash_balances;
CREATE POLICY "cash_balances delete operator+admin" ON public.cash_balances
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));
