UPDATE shops SET slot_id=null,active=false WHERE deleted_at IS NOT NULL;
