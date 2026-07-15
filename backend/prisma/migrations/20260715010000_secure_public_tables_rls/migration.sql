-- Defense in depth for the Supabase Data API.
--
-- The application connects through Prisma as the table owner, so it continues
-- to bypass RLS. No policies are added: anon/authenticated requests through the
-- Supabase Data API receive no rows even if table grants change later.

ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_spend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mockup_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mockup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_sessions ENABLE ROW LEVEL SECURITY;
