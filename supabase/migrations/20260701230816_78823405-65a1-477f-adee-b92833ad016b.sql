
-- 1) Enum de papéis
CREATE TYPE public.app_role AS ENUM ('viewer','operator','admin');

-- 2) Tabela de perfis (nunca guarda papel aqui)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3) Tabela de papéis
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4) Função has_role (SECURITY DEFINER — evita recursão em políticas)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 5) Políticas de profiles
CREATE POLICY "profiles: ler próprio ou admin lê todos"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles: atualizar próprio"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: admin gerencia todos"
ON public.profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) Políticas de user_roles (leitura apenas; escrita via server admin)
CREATE POLICY "user_roles: ler próprios ou admin lê todos"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 7) Trigger para criar profile ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, true)
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8) Ajuste RLS nas tabelas existentes
DROP POLICY IF EXISTS "read invoices" ON public.invoices;
DROP POLICY IF EXISTS "read imports"  ON public.imports;

REVOKE ALL ON public.invoices FROM anon;
REVOKE ALL ON public.imports  FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.imports  TO authenticated;
GRANT DELETE ON public.imports  TO authenticated;

-- invoices: qualquer autenticado lê; operator+admin escrevem; admin apaga
CREATE POLICY "invoices: autenticado lê"
ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices: operator/admin insere"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "invoices: operator/admin atualiza"
ON public.invoices FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "invoices: admin apaga"
ON public.invoices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- imports: mesmo modelo
CREATE POLICY "imports: autenticado lê"
ON public.imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "imports: operator/admin insere"
ON public.imports FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "imports: operator/admin atualiza"
ON public.imports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "imports: admin apaga"
ON public.imports FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));
