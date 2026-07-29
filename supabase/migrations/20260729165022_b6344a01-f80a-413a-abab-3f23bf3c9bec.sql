ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vencimento_original date;

CREATE OR REPLACE FUNCTION public.set_vencimento_original()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vencimento_original IS NULL THEN
      NEW.vencimento_original := NEW.data_vencimento;
    END IF;
  ELSE
    IF OLD.vencimento_original IS NOT NULL THEN
      NEW.vencimento_original := OLD.vencimento_original;
    ELSIF NEW.vencimento_original IS NULL THEN
      NEW.vencimento_original := COALESCE(OLD.data_vencimento, NEW.data_vencimento);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_vencimento_original ON public.invoices;
CREATE TRIGGER trg_invoices_vencimento_original
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_vencimento_original();

UPDATE public.invoices
SET vencimento_original = data_vencimento
WHERE vencimento_original IS NULL;