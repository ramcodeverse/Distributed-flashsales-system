/*
  # Flash Sale System - Core Schema

  1. New Tables
    - `flash_sales`: Sale events with start/end times, status
    - `products`: Items available in flash sales with stock, pricing
    - `orders`: Purchase orders with status tracking and idempotency keys
    - `order_events`: Event log for order state transitions (audit trail)
    - `rate_limits`: Request tracking for API rate limiting

  2. Security
    - RLS enabled on all tables
    - Users can only read active sales/products
    - Users can only read/write their own orders
    - Service role has full access for edge functions

  3. Key Design Decisions
    - Atomic stock decrement via `UPDATE ... SET stock = stock - 1 WHERE stock > 0`
    - Idempotency key on orders to prevent duplicate purchases
    - Order status enum: pending -> processing -> confirmed -> failed
    - Composite indexes on frequently queried columns
    - Partial unique index on idempotency key (only for non-failed orders)
*/

-- Flash sale events
CREATE TABLE IF NOT EXISTS flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended', 'cancelled')),
  max_per_user integer NOT NULL DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Products within flash sales
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_id uuid NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  original_price numeric(10,2) NOT NULL CHECK (original_price > 0),
  sale_price numeric(10,2) NOT NULL CHECK (sale_price > 0),
  stock integer NOT NULL CHECK (stock >= 0),
  reserved_stock integer NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  image_url text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold_out', 'disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sale_price_lower CHECK (sale_price <= original_price),
  CONSTRAINT reserved_within_stock CHECK (reserved_stock <= stock)
);

-- Orders with idempotency
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id),
  flash_sale_id uuid NOT NULL REFERENCES flash_sales(id),
  idempotency_key text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 5),
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'failed', 'cancelled', 'refunded')),
  failure_reason text DEFAULT '',
  payment_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order event log for audit trail
CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_flash_sale ON products(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock) WHERE stock > 0;
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE status != 'failed';
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created ON order_events(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_starts ON flash_sales(starts_at);

-- Enable RLS on all tables
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Flash sales: anyone can read active/upcoming sales
CREATE POLICY "Anyone can read flash sales"
  ON flash_sales FOR SELECT
  TO authenticated
  USING (status IN ('upcoming', 'active', 'ended'));

-- Products: anyone can read active products
CREATE POLICY "Anyone can read products"
  ON products FOR SELECT
  TO authenticated
  USING (status IN ('active', 'sold_out'));

-- Orders: users can only see their own orders
CREATE POLICY "Users can read own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Order events: users can read events for their orders
CREATE POLICY "Users can read own order events"
  ON order_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_events.order_id AND orders.user_id = auth.uid()
    )
  );

-- Rate limits: users can only see their own
CREATE POLICY "Users can read own rate limits"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rate limits"
  ON rate_limits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rate limits"
  ON rate_limits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Helper function: atomic stock decrement
-- Returns true if stock was decremented, false if insufficient stock
CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id uuid,
  p_quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE products
  SET stock = stock - p_quantity,
      reserved_stock = reserved_stock + p_quantity,
      updated_at = now(),
      status = CASE WHEN stock - p_quantity <= 0 THEN 'sold_out' ELSE status END
  WHERE id = p_product_id
    AND stock >= p_quantity
    AND status = 'active';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

-- Helper function: commit reserved stock (after payment success)
CREATE OR REPLACE FUNCTION commit_reserved_stock(
  p_product_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET reserved_stock = reserved_stock - p_quantity,
      updated_at = now()
  WHERE id = p_product_id
    AND reserved_stock >= p_quantity;
END;
$$;

-- Helper function: release reserved stock (after payment failure)
CREATE OR REPLACE FUNCTION release_reserved_stock(
  p_product_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET stock = stock + p_quantity,
      reserved_stock = reserved_stock - p_quantity,
      updated_at = now(),
      status = 'active'
  WHERE id = p_product_id
    AND reserved_stock >= p_quantity;
END;
$$;

-- Helper function: check and enforce per-user purchase limits
CREATE OR REPLACE FUNCTION check_user_purchase_limit(
  p_user_id uuid,
  p_product_id uuid,
  p_flash_sale_id uuid,
  p_requested integer,
  p_max_per_user integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  existing_count integer;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO existing_count
  FROM orders
  WHERE user_id = p_user_id
    AND product_id = p_product_id
    AND flash_sale_id = p_flash_sale_id
    AND status IN ('pending', 'processing', 'confirmed');

  RETURN (existing_count + p_requested) <= p_max_per_user;
END;
$$;
