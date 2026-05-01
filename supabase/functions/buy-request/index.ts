import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { product_id, flash_sale_id, quantity = 1, idempotency_key } = body;

    if (!product_id || !flash_sale_id || !idempotency_key) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: product_id, flash_sale_id, idempotency_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (quantity < 1 || quantity > 5) {
      return new Response(
        JSON.stringify({ error: "Quantity must be between 1 and 5" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: check using DB
    const { data: rateData } = await supabaseAdmin
      .from("rate_limits")
      .select("request_count, window_start")
      .eq("user_id", user.id)
      .eq("action", "buy")
      .maybeSingle();

    const now = new Date();
    const windowStart = rateData?.window_start ? new Date(rateData.window_start) : null;

    if (rateData && windowStart && (now.getTime() - windowStart.getTime()) < RATE_LIMIT_WINDOW_MS) {
      if (rateData.request_count >= RATE_LIMIT_MAX_REQUESTS) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later.", retry_after_ms: RATE_LIMIT_WINDOW_MS - (now.getTime() - windowStart.getTime()) }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabaseAdmin
        .from("rate_limits")
        .update({ request_count: rateData.request_count + 1 })
        .eq("user_id", user.id)
        .eq("action", "buy");
    } else {
      // Reset or create window
      if (rateData) {
        await supabaseAdmin
          .from("rate_limits")
          .update({ request_count: 1, window_start: now.toISOString() })
          .eq("user_id", user.id)
          .eq("action", "buy");
      } else {
        await supabaseAdmin
          .from("rate_limits")
          .insert({ user_id: user.id, action: "buy", request_count: 1, window_start: now.toISOString() });
      }
    }

    // Idempotency: check if order already exists for this key
    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("id, status, product_id, quantity, unit_price, total_price")
      .eq("idempotency_key", idempotency_key)
      .neq("status", "failed")
      .maybeSingle();

    if (existingOrder) {
      return new Response(
        JSON.stringify({
          order_id: existingOrder.id,
          status: existingOrder.status,
          product_id: existingOrder.product_id,
          quantity: existingOrder.quantity,
          total_price: existingOrder.total_price,
          message: "Order already exists for this idempotency key",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch product and flash sale in one round-trip
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, sale_price, stock, status, flash_sale_id")
      .eq("id", product_id)
      .eq("flash_sale_id", flash_sale_id)
      .maybeSingle();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: "Product not found in this flash sale" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (product.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Product is no longer available", product_status: product.status }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (product.stock < quantity) {
      return new Response(
        JSON.stringify({ error: "Insufficient stock", available: product.stock }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check flash sale is active
    const { data: sale } = await supabaseAdmin
      .from("flash_sales")
      .select("id, status, max_per_user, starts_at, ends_at")
      .eq("id", flash_sale_id)
      .maybeSingle();

    if (!sale || sale.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Flash sale is not active", sale_status: sale?.status ?? "not_found" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check per-user purchase limit using DB function
    const { data: withinLimit } = await supabaseAdmin.rpc("check_user_purchase_limit", {
      p_user_id: user.id,
      p_product_id: product_id,
      p_flash_sale_id: flash_sale_id,
      p_requested: quantity,
      p_max_per_user: sale.max_per_user,
    });

    if (!withinLimit) {
      return new Response(
        JSON.stringify({ error: "Per-user purchase limit exceeded", max_per_user: sale.max_per_user }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Atomic stock decrement - this is the concurrency control
    // Uses UPDATE ... WHERE stock >= quantity to prevent overselling
    const { data: decremented, error: decrementError } = await supabaseAdmin.rpc(
      "decrement_product_stock",
      { p_product_id: product_id, p_quantity: quantity }
    );

    if (decrementError || !decremented) {
      return new Response(
        JSON.stringify({ error: "Stock just ran out. Someone else got there first!", available: 0 }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create order with reserved stock
    const totalPrice = Number(product.sale_price) * quantity;
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: user.id,
        product_id,
        flash_sale_id,
        idempotency_key,
        quantity,
        unit_price: product.sale_price,
        total_price: totalPrice,
        status: "pending",
      })
      .select("id, status, total_price")
      .single();

    if (orderError) {
      // Rollback: release reserved stock
      await supabaseAdmin.rpc("release_reserved_stock", {
        p_product_id: product_id,
        p_quantity: quantity,
      });

      // Check if it's a unique constraint violation (duplicate idempotency key)
      if (orderError.code === "23505") {
        const { data: dupOrder } = await supabaseAdmin
          .from("orders")
          .select("id, status, total_price")
          .eq("idempotency_key", idempotency_key)
          .neq("status", "failed")
          .maybeSingle();

        if (dupOrder) {
          return new Response(
            JSON.stringify({ order_id: dupOrder.id, status: dupOrder.status, total_price: dupOrder.total_price, message: "Order already exists" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: "Failed to create order", details: orderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log order event
    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      event: "order_created",
      metadata: { product_id, quantity, unit_price: product.sale_price },
    });

    // Trigger async order processing (simulate queue by calling process-order)
    // In production, this would go to BullMQ/Kafka
    const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-order`;
    EdgeRuntime.waitUntil(
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ order_id: order.id }),
      }).catch(() => {
        // Fire and forget - order will be picked up by cleanup job if processing fails
      })
    );

    return new Response(
      JSON.stringify({
        order_id: order.id,
        status: order.status,
        total_price: order.total_price,
        product_name: product.name,
        quantity,
        message: "Order placed! Processing payment...",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Buy request error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
