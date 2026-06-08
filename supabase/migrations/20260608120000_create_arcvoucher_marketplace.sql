-- Copyright 2025 Circle Internet Group, Inc.  All rights reserved.
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-- SPDX-License-Identifier: Apache-2.0

CREATE TABLE public.products (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    brand text NOT NULL,
    description text,
    price_usdc numeric(18, 6) NOT NULL CHECK (price_usdc > 0),
    image_url text,
    active boolean NOT NULL DEFAULT true,
    stock_count integer NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name text NOT NULL,
    price_usdc numeric(18, 6) NOT NULL CHECK (price_usdc > 0),
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    wallet_address text,
    destination_address text,
    tx_hash text,
    circle_transaction_id text,
    chain_id bigint NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'fulfilled', 'revealed', 'refunded', 'failed')),
    voucher_inventory_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.voucher_inventory (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    code_ciphertext text NOT NULL,
    code_hash text NOT NULL,
    status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'revealed', 'disabled')),
    assigned_order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
ADD CONSTRAINT orders_voucher_inventory_id_fkey
FOREIGN KEY (voucher_inventory_id)
REFERENCES public.voucher_inventory(id)
ON DELETE SET NULL;

CREATE TABLE public.voucher_reveal_events (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    revealed_at timestamptz NOT NULL DEFAULT now(),
    ip_hash text
);

CREATE INDEX idx_products_active ON public.products(active);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_product_id ON public.orders(product_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_tx_hash ON public.orders(tx_hash);
CREATE INDEX idx_orders_circle_transaction_id ON public.orders(circle_transaction_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_voucher_inventory_product_id ON public.voucher_inventory(product_id);
CREATE INDEX idx_voucher_inventory_status ON public.voucher_inventory(status);
CREATE INDEX idx_voucher_reveal_events_order_id ON public.voucher_reveal_events(order_id);
CREATE INDEX idx_voucher_reveal_events_user_id ON public.voucher_reveal_events(user_id);

CREATE UNIQUE INDEX idx_voucher_inventory_code_hash ON public.voucher_inventory(code_hash);
CREATE UNIQUE INDEX idx_orders_tx_hash_unique ON public.orders(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_orders_circle_transaction_id_unique ON public.orders(circle_transaction_id) WHERE circle_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.refresh_product_stock_count(target_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.products
    SET stock_count = COALESCE((
        SELECT count(*)
        FROM public.voucher_inventory
        WHERE product_id = target_product_id
          AND status = 'available'
    ), 0)
    WHERE id = target_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_voucher_inventory_stock_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP <> 'DELETE' THEN
        PERFORM public.refresh_product_stock_count(NEW.product_id);
    END IF;

    IF TG_OP <> 'INSERT' THEN
        PERFORM public.refresh_product_stock_count(OLD.product_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

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
    WHERE id = reserved_inventory_id;

    RETURN reserved_inventory_id;
END;
$$;

CREATE TRIGGER on_products_update
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_orders_update
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_voucher_inventory_update
BEFORE UPDATE ON public.voucher_inventory
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_voucher_inventory_stock_count_change
AFTER INSERT OR UPDATE OR DELETE ON public.voucher_inventory
FOR EACH ROW
EXECUTE FUNCTION public.handle_voucher_inventory_stock_count();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_reveal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow active products to be read publicly"
ON public.products FOR SELECT TO anon, authenticated
USING (active = true);

CREATE POLICY "Allow full product management for service role"
ON public.products FOR ALL TO service_role
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Allow order owners to read their orders"
ON public.orders FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

CREATE POLICY "Allow pending order creation by owner"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (
    user_id = (select auth.uid())
    AND status = 'pending'
    AND voucher_inventory_id IS NULL
);

CREATE POLICY "Allow full order management for service role"
ON public.orders FOR ALL TO service_role
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Allow voucher inventory management for service role"
ON public.voucher_inventory FOR ALL TO service_role
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Allow voucher reveal event management for service role"
ON public.voucher_reveal_events FOR ALL TO service_role
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

GRANT EXECUTE ON FUNCTION public.refresh_product_stock_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_voucher_inventory(uuid, uuid) TO service_role;

INSERT INTO public.products (name, brand, description, price_usdc, image_url, active)
VALUES
    ('Amazon Gift Card $1', 'Amazon', 'Digital Amazon voucher redeemable after verified USDC payment.', 1.000000, NULL, true),
    ('Amazon Gift Card $2', 'Amazon', 'Digital Amazon voucher redeemable after verified USDC payment.', 2.000000, NULL, true),
    ('Google Play Gift Card $1', 'Google Play', 'Digital Google Play voucher redeemable after verified USDC payment.', 1.000000, NULL, true),
    ('Netflix Gift Card $1', 'Netflix', 'Digital Netflix voucher redeemable after verified USDC payment.', 1.000000, NULL, true),
    ('Steam Gift Card $2', 'Steam', 'Digital Steam voucher redeemable after verified USDC payment.', 2.000000, NULL, true);
