import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

const adminHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
});

// Public APIs
export async function fetchSales() {
  const res = await fetch(`${FUNCTION_URL}/flash-sale-api/sales`, {
    headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error('Failed to fetch sales');
  return res.json();
}

export async function fetchProducts(saleId: string) {
  const res = await fetch(`${FUNCTION_URL}/flash-sale-api/products/${saleId}`, {
    headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function fetchProduct(productId: string) {
  const res = await fetch(`${FUNCTION_URL}/flash-sale-api/product/${productId}`, {
    headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error('Failed to fetch product');
  return res.json();
}

export async function fetchStock(productId: string) {
  const res = await fetch(`${FUNCTION_URL}/flash-sale-api/stock/${productId}`, {
    headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error('Failed to fetch stock');
  return res.json();
}

export async function buyProduct(productId: string, saleId: string, quantity: number = 1) {
  const headers = await getAuthHeaders();
  const idempotencyKey = `${productId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const res = await fetch(`${FUNCTION_URL}/buy-request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      product_id: productId,
      flash_sale_id: saleId,
      quantity,
      idempotency_key: idempotencyKey,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Purchase failed');
  return data;
}

export async function fetchOrders() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FUNCTION_URL}/flash-sale-api/orders`, { headers });
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}

// Admin APIs
export async function adminFetchSales() {
  const res = await fetch(`${FUNCTION_URL}/admin-api/sales`, { headers: adminHeaders() });
  if (!res.ok) throw new Error('Failed to fetch sales');
  return res.json();
}

export async function adminCreateSale(sale: { name: string; description: string; starts_at: string; ends_at: string; max_per_user: number }) {
  const res = await fetch(`${FUNCTION_URL}/admin-api/sales`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(sale),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create sale');
  return data;
}

export async function adminUpdateSale(saleId: string, updates: Record<string, unknown>) {
  const res = await fetch(`${FUNCTION_URL}/admin-api/sales/${saleId}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update sale');
  return data;
}

export async function adminCreateProduct(product: { flash_sale_id: string; name: string; description: string; original_price: number; sale_price: number; stock: number; image_url: string }) {
  const res = await fetch(`${FUNCTION_URL}/admin-api/products`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(product),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create product');
  return data;
}

export async function adminUpdateProduct(productId: string, updates: Record<string, unknown>) {
  const res = await fetch(`${FUNCTION_URL}/admin-api/products/${productId}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update product');
  return data;
}

export async function adminFetchOrders() {
  const res = await fetch(`${FUNCTION_URL}/admin-api/orders`, { headers: adminHeaders() });
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}

export async function adminFetchStats() {
  const res = await fetch(`${FUNCTION_URL}/admin-api/stats`, { headers: adminHeaders() });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}
