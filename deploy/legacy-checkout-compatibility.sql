-- Keep the preceding release writable during rollout and rollback.
CREATE OR REPLACE FUNCTION ms_fill_legacy_order_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.original_total IS NULL THEN
  NEW.original_total := NEW.total;
  NEW.review_status := 'approved';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ms_fill_legacy_order_quote ON orders;
CREATE TRIGGER ms_fill_legacy_order_quote BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION ms_fill_legacy_order_quote();

CREATE OR REPLACE FUNCTION ms_snapshot_legacy_order_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE orders SET original_bill=jsonb_build_object(
  'subtotal',subtotal,'shipping',shipping,'tax',tax,'total',total,'originalTotal',original_total,'reference',number||'/QUOTE',
  'items',coalesce((SELECT jsonb_agg(jsonb_build_object('name_snapshot',i.name_snapshot,'variant_snapshot',i.variant_snapshot,'description_snapshot',i.description_snapshot,'price_snapshot',i.price_snapshot,'quantity',i.quantity) ORDER BY i.id) FROM order_items i WHERE i.order_id=orders.id),'[]'::jsonb)
 ) WHERE id=NEW.id AND original_bill IS NULL;
 RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS ms_snapshot_legacy_order_quote ON orders;
CREATE CONSTRAINT TRIGGER ms_snapshot_legacy_order_quote AFTER INSERT ON orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ms_snapshot_legacy_order_quote();
