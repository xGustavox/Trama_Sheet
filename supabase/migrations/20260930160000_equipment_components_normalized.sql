BEGIN;

-- Align the already-applied seed with the current chain-mail armor values.
UPDATE public.equipment_items
SET data = jsonb_set(jsonb_set(data, '{armor,ac}', '16'::jsonb), '{armor,dexterity}', '"none"'::jsonb)
WHERE id = 'cota-de-malha';

-- Component membership is stored only in equipment_item_components.
UPDATE public.equipment_items
SET data = data - 'components'
WHERE data ? 'components';

COMMIT;
