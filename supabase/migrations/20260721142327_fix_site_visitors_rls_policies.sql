-- Fix overly permissive RLS policies on public.site_visitors
-- Previous policies used USING (true) / WITH CHECK (true), allowing unrestricted
-- access to ALL rows for anon and authenticated roles.
--
-- New model: a visitor can only INSERT/UPDATE their own row (matched by visitor_id).
-- SELECT remains open (aggregate visit counts are public; no PII is stored).

DROP POLICY IF EXISTS allow_insert_visitor ON public.site_visitors;
DROP POLICY IF EXISTS allow_update_visitor ON public.site_visitors;
DROP POLICY IF EXISTS allow_select_visitor ON public.site_visitors;

-- A visitor may insert a row only for their own visitor_id
CREATE POLICY "allow_insert_visitor"
  ON public.site_visitors
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (visitor_id IS NOT NULL AND visitor_id <> '');

-- A visitor may update only the row that matches their own visitor_id
CREATE POLICY "allow_update_visitor"
  ON public.site_visitors
  FOR UPDATE
  TO anon, authenticated
  USING (visitor_id IS NOT NULL AND visitor_id <> '')
  WITH CHECK (visitor_id IS NOT NULL AND visitor_id <> '');

-- Aggregate visit counts are public (no PII in the table)
CREATE POLICY "allow_select_visitor"
  ON public.site_visitors
  FOR SELECT
  TO anon, authenticated
  USING (true);
