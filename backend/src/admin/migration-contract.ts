// Keep aligned with committed migrations; the installation test verifies this list.
export const requiredMigrations = [
  '20260529180000_paid_beta_foundation',
  '20260530122000_paid_beta_provider_hardening',
  '20260607120000_paid_beta_operator_review',
  '20260608130000_curated_printful_launch_catalog',
  '20260714183000_checkout_reconciliation',
  '20260714233000_order_recovery_operations',
  '20260714234500_refund_and_fulfillment_recovery',
  '20260715010000_secure_public_tables_rls',
  '20260717160000_checkout_policy_acceptance',
  '20260826183018_uploaded_artwork_assets',
  '20260828153000_multi_print_placements',
  '20260903190000_order_notifications_and_shipments',
  '20260904003000_themed_mini_stores',
  '20260904171000_customer_order_access',
  '20260904190500_order_access_purposes',
  '20260904213000_owner_membership_isolation',
] as const;
