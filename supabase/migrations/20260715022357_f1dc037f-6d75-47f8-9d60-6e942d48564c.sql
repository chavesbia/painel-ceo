REVOKE ALL ON FUNCTION public.run_daily_import_health_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_daily_import_health_check() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_import_health_check() TO service_role;