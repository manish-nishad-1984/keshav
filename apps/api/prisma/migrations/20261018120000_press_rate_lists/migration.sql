-- Press rates become a list per mode (online / offline); the user picks one in Press Entry.
UPDATE "company_settings"
SET "value" = jsonb_build_object(
      'onlineRates', jsonb_build_array(COALESCE(("value"->>'onlineRate')::numeric, 2)),
      'offlineRates', jsonb_build_array(COALESCE(("value"->>'offlineRate')::numeric, 3))
    )
WHERE "scope" = 'press' AND "key" = 'rates' AND "value" ? 'onlineRate';
