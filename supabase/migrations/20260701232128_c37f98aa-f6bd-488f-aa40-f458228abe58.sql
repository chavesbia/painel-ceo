CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.cash_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  account_name text NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  balance_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_balances TO authenticated;
GRANT ALL ON public.cash_balances TO service_role;

ALTER TABLE public.cash_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cash balances"
ON public.cash_balances
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Operators and admins can create cash balances"
ON public.cash_balances
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators and admins can update cash balances"
ON public.cash_balances
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete cash balances"
ON public.cash_balances
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cash_balances_updated_at
BEFORE UPDATE ON public.cash_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();