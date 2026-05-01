import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const path = url.pathname.replace("/admin-api", "").replace(/^\/+/, "");

    // GET /sales - all sales for admin
    if (path === "sales" && req.method === "GET") {
      const { data, error } = await supabase
        .from("flash_sales")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ sales: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /sales - create sale
    if (path === "sales" && req.method === "POST") {
      const body = await req.json();
      const { name, description, starts_at, ends_at, max_per_user } = body;

      if (!name || !starts_at || !ends_at) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data, error } = await supabase
        .from("flash_sales")
        .insert({ name, description: description || "", starts_at, ends_at, max_per_user: max_per_user || 2, status: "upcoming" })
        .select()
        .single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ sale: data }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PATCH /sales/:id - update sale
    const saleMatch = path.match(/^sales\/([^/]+)$/);
    if (saleMatch && req.method === "PATCH") {
      const saleId = saleMatch[1];
      const body = await req.json();

      const { data, error } = await supabase
        .from("flash_sales")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", saleId)
        .select()
        .single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ sale: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /products - create product
    if (path === "products" && req.method === "POST") {
      const body = await req.json();
      const { flash_sale_id, name, description, original_price, sale_price, stock, image_url } = body;

      if (!flash_sale_id || !name || !original_price || !sale_price || stock === undefined) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data, error } = await supabase
        .from("products")
        .insert({
          flash_sale_id,
          name,
          description: description || "",
          original_price,
          sale_price,
          stock,
          image_url: image_url || "",
          status: "active",
        })
        .select()
        .single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ product: data }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PATCH /products/:id - update product (stock, price, status)
    const productMatch = path.match(/^products\/([^/]+)$/);
    if (productMatch && req.method === "PATCH") {
      const productId = productMatch[1];
      const body = await req.json();

      const { data, error } = await supabase
        .from("products")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", productId)
        .select()
        .single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ product: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /orders - all orders for admin
    if (path === "orders" && req.method === "GET") {
      const { data, error } = await supabase
        .from("orders")
        .select("id, user_id, product_id, quantity, unit_price, total_price, status, failure_reason, created_at, updated_at, products(name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ orders: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /stats - dashboard stats
    if (path === "stats" && req.method === "GET") {
      const [salesRes, productsRes, ordersRes] = await Promise.all([
        supabase.from("flash_sales").select("id, status", { count: "exact" }),
        supabase.from("products").select("id, stock, reserved_stock, status", { count: "exact" }),
        supabase.from("orders").select("id, status, total_price").in("status", ["confirmed", "pending", "processing", "failed"]),
      ]);

      const orders = ordersRes.data || [];
      const confirmedOrders = orders.filter((o) => o.status === "confirmed");
      const totalRevenue = confirmedOrders.reduce((sum, o) => sum + Number(o.total_price), 0);
      const totalProducts = productsRes.data || [];
      const totalStock = totalProducts.reduce((sum, p) => sum + (p.stock as number), 0);
      const totalReserved = totalProducts.reduce((sum, p) => sum + (p.reserved_stock as number), 0);

      return new Response(
        JSON.stringify({
          total_sales: salesRes.count || 0,
          active_sales: (salesRes.data || []).filter((s) => s.status === "active").length,
          total_products: productsRes.count || 0,
          total_stock,
          total_reserved: totalReserved,
          total_orders: ordersRes.count || 0,
          confirmed_orders: confirmedOrders.length,
          pending_orders: orders.filter((o) => o.status === "pending" || o.status === "processing").length,
          failed_orders: orders.filter((o) => o.status === "failed").length,
          total_revenue: totalRevenue.toFixed(2),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Admin API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
