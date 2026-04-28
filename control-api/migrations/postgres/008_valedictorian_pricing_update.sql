-- Updates the Valedictorian catalog policy to $15.99/month with 11 included
-- billable students and $0.99 per billable student above 11.
--
-- This migration intentionally does not change stripe_price_id or existing
-- customer subscription items. Stripe recurring prices are immutable; create
-- the new Stripe base price first, then update commercial_plans.stripe_price_id
-- and any active large_monthly subscription items in the rollout step.

SET search_path TO hsm_control_staging;

UPDATE commercial_plans
SET
  description = 'Hosted access for larger schools with a monthly base plus per-student overage after eleven billable students, framed as the top scholastic tier.',
  price_cents = 1599,
  feature_summary_json = '["11 included billable students","$0.99 per billable student above 11","Attendance, grades, reports, and planning","Historical data preserved across school years"]'::jsonb,
  limits_json = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(limits_json, '{}'::jsonb),
        '{includedBillableStudents}',
        '11'::jsonb,
        true
      ),
      '{perStudentOverageCents}',
      '99'::jsonb,
      true
    ),
    '{allowsOverage}',
    'true'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE code = 'large_monthly';
