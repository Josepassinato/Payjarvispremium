-- ═══════════════════════════════════════════════
-- PAYJARVIS PREMIUM — Tabela profiles
-- Executar no Supabase SQL Editor
-- ═══════════════════════════════════════════════

-- 1. Criar tabela profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,

  -- Empresa (passo 1 do onboarding)
  company_name    TEXT,
  company_sector  TEXT,
  company_size    TEXT,
  company_revenue TEXT,

  -- Desafios (passo 2 do onboarding)
  challenges      TEXT[],           -- array de strings
  main_challenge  TEXT,

  -- Contato (passo 3 do onboarding)
  whatsapp        TEXT,
  referral        TEXT,

  -- Controle
  onboarded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de segurança

-- Usuário lê apenas o próprio perfil
CREATE POLICY "profiles: select own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Usuário insere apenas o próprio perfil
CREATE POLICY "profiles: insert own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Usuário atualiza apenas o próprio perfil
CREATE POLICY "profiles: update own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 4. Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Trigger: cria perfil vazio automaticamente quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════
-- VERIFICAÇÃO — rodar após criar a tabela
-- ═══════════════════════════════════════════════
-- SELECT * FROM public.profiles;
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';
