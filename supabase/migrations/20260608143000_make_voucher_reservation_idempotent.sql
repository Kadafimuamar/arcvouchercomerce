CREATE OR REPLACE FUNCTION public.reserve_voucher_inventory(
    order_id_to_assign uuid,
    product_id_to_reserve uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    reserved_inventory_id uuid;
BEGIN
    SELECT id
    INTO reserved_inventory_id
    FROM public.voucher_inventory
    WHERE assigned_order_id = order_id_to_assign
    ORDER BY created_at ASC
    LIMIT 1;

    IF reserved_inventory_id IS NOT NULL THEN
        RETURN reserved_inventory_id;
    END IF;

    SELECT id
    INTO reserved_inventory_id
    FROM public.voucher_inventory
    WHERE product_id = product_id_to_reserve
      AND status = 'available'
      AND assigned_order_id IS NULL
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF reserved_inventory_id IS NULL THEN
        RETURN NULL;
    END IF;

    UPDATE public.voucher_inventory
    SET status = 'reserved',
        assigned_order_id = order_id_to_assign,
        updated_at = now()
    WHERE id = reserved_inventory_id
      AND status = 'available'
      AND assigned_order_id IS NULL;

    IF NOT FOUND THEN
        SELECT id
        INTO reserved_inventory_id
        FROM public.voucher_inventory
        WHERE assigned_order_id = order_id_to_assign
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    RETURN reserved_inventory_id;
END;
$$;
