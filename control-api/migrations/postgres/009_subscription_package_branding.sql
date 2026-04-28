-- Renames public subscription packages while preserving stable internal plan
-- codes and existing Stripe price mappings.

SET search_path TO hsm_control_staging;

UPDATE commercial_plans
SET
  name = 'Starter',
  description = 'Hosted access for smaller homeschool families with up to three billable students in the current billing period.',
  feature_summary_json = '["1-3 students","Grades, attendance, and reports","Scheduling and planning tools","Historical records preserved","Secure online access"]'::jsonb,
  updated_at = NOW()
WHERE code = 'starter_monthly';

UPDATE commercial_plans
SET
  name = 'Growth',
  description = 'Hosted access for larger families and small learning groups with up to ten billable students in the current billing period.',
  feature_summary_json = '["4-10 students","Everything in Starter","More room to grow","Great for multi-child households","Ideal for pods and shared teaching groups"]'::jsonb,
  updated_at = NOW()
WHERE code = 'growth_monthly';

UPDATE commercial_plans
SET
  name = 'Co-op Pro',
  description = 'Hosted access for co-ops and larger programs with a monthly base plus per-student overage after eleven billable students.',
  feature_summary_json = '["11 students included","Add students as needed","Full grades, attendance, and reports","Great for organized group instruction","Historical records preserved"]'::jsonb,
  updated_at = NOW()
WHERE code = 'large_monthly';
