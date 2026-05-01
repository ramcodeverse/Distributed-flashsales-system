import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_RETRIES = 3;
const PAYMENT_SIMULATE_DELAY_MS = 500;
const PAYMENT_SUCCESS_RATE = 0.92;

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "Missing order_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with product info
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, product_id, flash_sale_id, quantity, unit_price, total_price, status, idempotency_key")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process pending orders (idempotency guard)
    if (order.status !== "pending") {
      return new Response(
        JSON.stringify({ order_id: order.id, status: order.status, message: "Order already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Move to processing
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", order_id)
      .eq("status", "pending");

    if (updateError) {
      // Concurrent processing - another worker got it first
      return new Response(
        JSON.stringify({ order_id, message: "Order already being processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("order_events").insert({
      order_id,
      event: "processing_started",
      metadata: { timestamp: new Date().toISOString() },
    });

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, PAYMENT_SIMULATE_DELAY_MS));

    const paymentSuccess = Math.random() < PAYMENT_SUCCESS_RATE;
    const paymentId = paymentSuccess ? `pay_${Date.now()}_${order.id.substring(0, 8)}` : "";

    if (paymentSuccess) {
      // Payment succeeded - commit reserved stock and confirm order
      await supabase.rpc("commit_reserved_stock", {
        p_product_id: order.product_id,
        p_quantity: order.quantity,
      });

      await supabase
        .from("orders")
        .update({
          status: "confirmed",
          payment_id: paymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      await supabase.from("order_events").insert({
        order_id,
        event: "payment_confirmed",
        metadata: { payment_id: paymentId, amount: order.total_price },
      });
    } else {
      // Payment failed - release reserved stock back to available
      await supabase.rpc("release_reserved_stock", {
        p_product_id: order.product_id,
        p_quantity: order.quantity,
      });

      await supabase
        .from("orders")
        .update({
          status: "failed",
          failure_reason: "Payment declined (simulated)",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      await supabase.from("order_events").insert({
        order_id,
        event: "payment_failed",
        metadata: { reason: "Payment declined (simulated)" },
      });
    }

    return new Response(
      JSON.stringify({
        order_id,
        status: paymentSuccess ? "confirmed" : "failed",
        payment_id: paymentId,
        message: paymentSuccess ? "Payment confirmed!" : "Payment failed - stock released",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Process order error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
