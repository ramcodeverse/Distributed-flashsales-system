import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const path = url.pathname.replace("/flash-sale-api", "").replace(/^\/+/, "");

    // GET /sales - list active flash sales
    if (path === "sales" && req.method === "GET") {
      const { data, error } = await supabase
        .from("flash_sales")
        .select("id, name, description, starts_at, ends_at, status, max_per_user")
        .in("status", ["active", "upcoming"])
        .order("starts_at", { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ sales: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /products/:saleId - list products for a flash sale
    const productsMatch = path.match(/^products\/([^/]+)$/);
    if (productsMatch && req.method === "GET") {
      const saleId = productsMatch[1];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, original_price, sale_price, stock, reserved_stock, image_url, status")
        .eq("flash_sale_id", saleId)
        .in("status", ["active", "sold_out"])
        .order("sale_price", { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate available stock (total - reserved)
      const products = (data || []).map((p: Record<string, unknown>) => ({
        ...p,
        available_stock: (p.stock as number) - (p.reserved_stock as number),
      }));

      return new Response(JSON.stringify({ products }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /product/:productId - single product detail
    const productMatch = path.match(/^product\/([^/]+)$/);
    if (productMatch && req.method === "GET") {
      const productId = productMatch[1];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, original_price, sale_price, stock, reserved_stock, image_url, status, flash_sale_id")
        .eq("id", productId)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Product not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const product = {
        ...data,
        available_stock: (data.stock as number) - (data.reserved_stock as number),
      };

      return new Response(JSON.stringify({ product }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /orders - user's orders (requires auth)
    if (path === "orders" && req.method === "GET") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("orders")
        .select("id, product_id, quantity, unit_price, total_price, status, failure_reason, created_at, updated_at, products(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ orders: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /stock/:productId - real-time stock check (lightweight)
    const stockMatch = path.match(/^stock\/([^/]+)$/);
    if (stockMatch && req.method === "GET") {
      const productId = stockMatch[1];
      const { data, error } = await supabase
        .from("products")
        .select("id, stock, reserved_stock, status")
        .eq("id", productId)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Product not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          product_id: data.id,
          available: (data.stock as number) - (data.reserved_stock as number),
          stock: data.stock,
          reserved: data.reserved_stock,
          status: data.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Flash sale API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
