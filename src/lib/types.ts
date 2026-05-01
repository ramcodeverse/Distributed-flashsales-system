export interface FlashSale {
  id: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'active' | 'ended' | 'cancelled';
  max_per_user: number;
}

export interface Product {
  id: string;
  flash_sale_id: string;
  name: string;
  description: string;
  original_price: number;
  sale_price: number;
  stock: number;
  reserved_stock: number;
  available_stock: number;
  image_url: string;
  status: 'active' | 'sold_out' | 'disabled';
}

export interface Order {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled' | 'refunded';
  failure_reason: string;
  created_at: string;
  updated_at: string;
  products?: { name: string };
}

export interface BuyResult {
  order_id: string;
  status: string;
  total_price: number;
  product_name: string;
  quantity: number;
  message: string;
}

export interface CartItem {
  product: Product;
  saleId: string;
  quantity: number;
}
