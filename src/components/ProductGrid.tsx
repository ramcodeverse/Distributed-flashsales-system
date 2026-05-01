import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchProducts, buyProduct } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useCart } from '../lib/useCart';
import type { FlashSale, Product, BuyResult } from '../lib/types';
import {
  ArrowLeft, Loader2, AlertCircle, Check, X, Flame, Package,
  Plus, Timer, Zap, Users, Radio, AlertTriangle, RefreshCw, Search,
} from 'lucide-react';
import { SkeletonCard } from './Skeleton';

interface ProductGridProps {
  sale: FlashSale;
  onBack: () => void;
}

type BuyPhase = 'idle' | 'queueing' | 'reserving' | 'confirming' | 'success' | 'failed' | 'out_of_stock' | 'rate_limited';

interface BuyState {
  phase: BuyPhase;
  message: string;
  productId: string | null;
}

interface StockEvent {
  productId: string;
  from: number;
  to: number;
  buyer: string;
  timestamp: number;
}

export function ProductGrid({ sale, onBack }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const { addItem, isInCart } = useCart();

  const [activeViewers, setActiveViewers] = useState(0);
  const [activeBuyers, setActiveBuyers] = useState(0);
  const [stockEvents, setStockEvents] = useState<StockEvent[]>([]);
  const [buyState, setBuyState] = useState<BuyState>({ phase: 'idle', message: '', productId: null });
  const [result, setResult] = useState<BuyResult | null>(null);
  const [search, setSearch] = useState('');
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const buyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const updateCounts = () => {
      setActiveViewers(prev => Math.max(18, Math.min(280, prev + Math.floor(Math.random() * 7) - 3)));
      setActiveBuyers(prev => Math.max(2, Math.min(38, prev + Math.floor(Math.random() * 5) - 2)));
    };
    setActiveViewers(60 + Math.floor(Math.random() * 40));
    setActiveBuyers(6 + Math.floor(Math.random() * 10));
    const interval = setInterval(updateCounts, 2500 + Math.random() * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const simulateBuy = () => {
      if (products.length === 0) return;
      const eligible = products.filter(p => p.stock > 5 && p.status === 'active');
      if (eligible.length === 0) return;
      const product = eligible[Math.floor(Math.random() * eligible.length)];
      const bought = 1;
      const newStock = Math.max(1, product.stock - bought);
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, stock: newStock, available_stock: newStock - p.reserved_stock } : p
      ));
      setStockEvents(prev => [{
        productId: product.id, from: product.stock, to: newStock,
        buyer: `user_${Math.random().toString(36).substring(2, 6)}`, timestamp: Date.now(),
      }, ...prev].slice(0, 6));
    };
    const interval = setInterval(simulateBuy, 4000 + Math.random() * 5000);
    return () => clearInterval(interval);
  }, [products]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetchProducts(sale.id);
      setProducts(data.products || []);
    } catch { setError('Failed to load products'); }
    finally { setLoading(false); }
  }, [sale.id]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    const channel = supabase
      .channel('stock-updates')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'products',
        filter: `flash_sale_id=eq.${sale.id}`,
      }, (payload) => {
        const updated = payload.new as Record<string, unknown>;
        setProducts(prev => prev.map(p =>
          p.id === updated.id ? {
            ...p, stock: updated.stock as number, reserved_stock: updated.reserved_stock as number,
            available_stock: (updated.stock as number) - (updated.reserved_stock as number),
            status: updated.status as Product['status'],
          } : p
        ));
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [sale.id]);

  const handleBuyNow = async (product: Product) => {
    const available = product.available_stock ?? (product.stock - product.reserved_stock);
    if (available <= 0) {
      setBuyState({ phase: 'out_of_stock', message: 'Stock just ran out. Another buyer took it first.', productId: product.id });
      return;
    }
    setBuyState({ phase: 'queueing', message: 'Entering purchase queue...', productId: product.id });
    setResult(null);
    await delay(500 + Math.random() * 300);
    setBuyState({ phase: 'reserving', message: 'Reserving stock atomically...', productId: product.id });
    await delay(350 + Math.random() * 250);
    setBuyState({ phase: 'confirming', message: 'Confirming order...', productId: product.id });
    try {
      const data = await buyProduct(product.id, sale.id, 1);
      if (data.status === 'confirmed' || data.status === 'pending') {
        setBuyState({ phase: 'success', message: `${data.product_name} x${data.quantity} confirmed`, productId: product.id });
        setResult(data);
        await loadProducts();
      } else if (data.status === 'failed') {
        setBuyState({ phase: 'failed', message: data.message || 'Order failed - stock sold out by another buyer.', productId: product.id });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
        setBuyState({ phase: 'rate_limited', message: 'Rate limited. Wait 30s and try again.', productId: product.id });
      } else if (msg.toLowerCase().includes('out of stock') || msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('no stock')) {
        setBuyState({ phase: 'out_of_stock', message: 'Out of stock. Another buyer just took the last item.', productId: product.id });
      } else {
        setBuyState({ phase: 'failed', message: msg, productId: product.id });
      }
    }
    if (buyTimeoutRef.current) clearTimeout(buyTimeoutRef.current);
    buyTimeoutRef.current = setTimeout(() => {
      setBuyState({ phase: 'idle', message: '', productId: null });
    }, 4500);
  };

  const handleAddToCart = (product: Product) => { addItem(product, sale.id); };

  const discountPercent = (p: Product) => Math.round(((p.original_price - p.sale_price) / p.original_price) * 100);

  const stockLevel = (p: Product) => {
    const avail = p.available_stock ?? (p.stock - p.reserved_stock);
    if (avail <= 0) return 'none';
    if (avail < 20) return 'critical';
    if (avail < 100) return 'low';
    return 'healthy';
  };

  const stockBarWidth = (p: Product) => {
    const avail = p.available_stock ?? (p.stock - p.reserved_stock);
    const total = avail + p.reserved_stock;
    return total === 0 ? 0 : Math.max(2, (avail / total) * 100);
  };

  const getTimeRemaining = () => {
    const diff = new Date(sale.ends_at).getTime() - now;
    if (diff <= 0) return 'Ended';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="h-8 w-32 bg-zinc-800/60 rounded animate-pulse mb-6" />
        <div className="h-24 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors mb-6 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to sales
      </button>

      {/* Sale header */}
      <div className="relative mb-6 overflow-hidden rounded-xl bg-zinc-900/60 border border-zinc-800/60 p-5 sm:p-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
              <span className="text-[11px] text-zinc-600">Max {sale.max_per_user}/user</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{sale.name}</h1>
            <p className="text-zinc-500 mt-0.5 text-sm">{sale.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/[0.07] border border-rose-500/15">
              <Users className="w-3.5 h-3.5 text-rose-400" />
              <div>
                <div className="text-[11px] font-semibold text-rose-400 leading-tight">{activeBuyers} buying</div>
                <div className="text-[10px] text-rose-400/50 leading-tight">{activeViewers} viewing</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
              <Timer className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-sm font-mono font-semibold text-amber-400 tabular-nums">{getTimeRemaining()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live activity feed */}
      {stockEvents.length > 0 && (
        <div className="mb-5 bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Live Activity</span>
          </div>
          <div className="space-y-0.5 max-h-20 overflow-y-auto">
            {stockEvents.map((event, i) => {
              const product = products.find(p => p.id === event.productId);
              return (
                <div key={`${event.timestamp}-${i}`} className="flex items-center gap-1.5 text-[11px] animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <span className="w-1 h-1 rounded-full bg-emerald-400/60 flex-shrink-0" />
                  <span className="text-zinc-600">{event.buyer}</span>
                  <span className="text-zinc-700">bought</span>
                  <span className="text-zinc-300 font-medium">{product?.name || 'item'}</span>
                  <span className="text-zinc-700">stock:</span>
                  <span className="text-amber-400/80 font-mono">{event.from}</span>
                  <span className="text-zinc-700">{'>'}</span>
                  <span className={`font-mono ${event.to < 20 ? 'text-red-400' : 'text-emerald-400/70'}`}>{event.to}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Buy state notification */}
      {buyState.phase !== 'idle' && (
        <div className={`mb-5 animate-bounce-in rounded-lg px-4 py-3 text-sm flex items-center gap-3 border ${
          buyState.phase === 'queueing' ? 'bg-sky-500/[0.07] border-sky-500/15 text-sky-300' :
          buyState.phase === 'reserving' ? 'bg-amber-500/[0.07] border-amber-500/15 text-amber-300' :
          buyState.phase === 'confirming' ? 'bg-cyan-500/[0.07] border-cyan-500/15 text-cyan-300' :
          buyState.phase === 'success' ? 'bg-emerald-500/[0.07] border-emerald-500/15 text-emerald-300' :
          buyState.phase === 'out_of_stock' ? 'bg-red-500/[0.07] border-red-500/15 text-red-300' :
          buyState.phase === 'rate_limited' ? 'bg-orange-500/[0.07] border-orange-500/15 text-orange-300' :
          'bg-red-500/[0.07] border-red-500/15 text-red-300'
        }`}>
          {buyState.phase === 'queueing' && <Users className="w-4 h-4 flex-shrink-0 animate-pulse" />}
          {buyState.phase === 'reserving' && <Zap className="w-4 h-4 flex-shrink-0 animate-pulse" />}
          {buyState.phase === 'confirming' && <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />}
          {buyState.phase === 'success' && <Check className="w-4 h-4 flex-shrink-0" />}
          {buyState.phase === 'out_of_stock' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {buyState.phase === 'rate_limited' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {buyState.phase === 'failed' && <X className="w-4 h-4 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[13px]">
              {buyState.phase === 'queueing' && 'Entering Purchase Queue...'}
              {buyState.phase === 'reserving' && 'Reserving Stock (Atomic Decrement)...'}
              {buyState.phase === 'confirming' && 'Confirming Order...'}
              {buyState.phase === 'success' && 'Order Confirmed!'}
              {buyState.phase === 'out_of_stock' && 'Race Condition Lost - Out of Stock!'}
              {buyState.phase === 'rate_limited' && 'Rate Limited!'}
              {buyState.phase === 'failed' && 'Purchase Failed!'}
            </div>
            <div className="text-[11px] opacity-70 mt-0.5">{buyState.message}</div>
          </div>
          {(buyState.phase === 'out_of_stock' || buyState.phase === 'failed' || buyState.phase === 'rate_limited') && (
            <button onClick={() => setBuyState({ phase: 'idle', message: '', productId: null })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/5 hover:bg-white/10 transition-all flex-shrink-0">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
        </div>
      )}

      {result && buyState.phase === 'success' && (
        <div className="mb-5 animate-bounce-in bg-emerald-500/[0.07] border border-emerald-500/15 rounded-lg px-4 py-3 text-emerald-300 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          {result.product_name} x{result.quantity} - ${result.total_price} | Status: {result.status}
        </div>
      )}

      {error && (
        <div className="mb-5 animate-bounce-in bg-red-500/[0.07] border border-red-500/15 rounded-lg px-4 py-3 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Search */}
      {products.length > 3 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
            aria-label="Search products"
            className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-lg pl-10 pr-10 py-2.5 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/30 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((product, i) => {
          const available = product.available_stock ?? (product.stock - product.reserved_stock);
          const level = stockLevel(product);
          const isSoldOut = available <= 0 || product.status === 'sold_out';
          const isBuying = buyState.productId === product.id && buyState.phase !== 'idle' && buyState.phase !== 'success';
          const inCart = isInCart(product.id);
          const discount = discountPercent(product);
          const isFailed = buyState.productId === product.id && (buyState.phase === 'out_of_stock' || buyState.phase === 'failed' || buyState.phase === 'rate_limited');

          return (
            <div key={product.id}
              className={`group relative bg-zinc-900/50 border rounded-xl overflow-hidden transition-all duration-300 animate-slide-up stagger-${Math.min(i + 1, 8)} ${
                isSoldOut ? 'border-zinc-800/30 opacity-40' :
                isFailed ? 'border-red-500/20' :
                isBuying ? 'border-amber-500/20' :
                'border-zinc-800/50 hover:border-zinc-700/60 hover:-translate-y-0.5'
              }`}>
              <div className="relative aspect-[4/3] bg-zinc-800/50 overflow-hidden cursor-zoom-in" onClick={() => setZoomImage(product.image_url)}>
                <img src={product.image_url} alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 via-transparent to-transparent" />

                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                  <span className="bg-rose-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 backdrop-blur-sm">
                    <Flame className="w-2.5 h-2.5" />-{discount}%
                  </span>
                  {level === 'critical' && !isSoldOut && (
                    <span className="bg-amber-500/90 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 backdrop-blur-sm">
                      <Zap className="w-2.5 h-2.5" />Few left
                    </span>
                  )}
                </div>

                {!isSoldOut && (
                  <div className="absolute top-2.5 right-2.5">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-950/80 backdrop-blur-sm border border-zinc-700/20">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-white tabular-nums">{available}</span>
                    </div>
                  </div>
                )}

                {isSoldOut && (
                  <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center backdrop-blur-[2px]">
                    <span className="text-white/80 font-bold text-sm tracking-widest uppercase">Sold Out</span>
                  </div>
                )}

                {isBuying && (
                  <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center">
                    {buyState.phase === 'queueing' && (
                      <div className="text-center"><Users className="w-6 h-6 text-sky-400 mx-auto mb-1 animate-pulse" /><span className="text-[10px] font-semibold text-sky-300">Queueing...</span></div>
                    )}
                    {buyState.phase === 'reserving' && (
                      <div className="text-center"><Zap className="w-6 h-6 text-amber-400 mx-auto mb-1 animate-pulse" /><span className="text-[10px] font-semibold text-amber-300">Reserving...</span></div>
                    )}
                    {buyState.phase === 'confirming' && (
                      <div className="text-center"><Loader2 className="w-6 h-6 text-cyan-400 mx-auto mb-1 animate-spin" /><span className="text-[10px] font-semibold text-cyan-300">Confirming...</span></div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3.5">
                <h3 className="text-white font-semibold text-[13px] mb-0.5 truncate">{product.name}</h3>
                <p className="text-zinc-600 text-[11px] mb-2.5 line-clamp-1">{product.description}</p>

                <div className="flex items-baseline gap-1.5 mb-2.5">
                  <span className="text-lg font-bold text-amber-400">${product.sale_price.toFixed(2)}</span>
                  <span className="text-[11px] text-zinc-600 line-through">${product.original_price.toFixed(2)}</span>
                  <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded ml-auto">-${(product.original_price - product.sale_price).toFixed(2)}</span>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className={`flex items-center gap-1 font-medium ${level === 'none' ? 'text-red-400' : level === 'critical' ? 'text-amber-400' : 'text-zinc-500'}`}>
                      <Package className="w-3 h-3" />{available} left
                    </span>
                    {product.reserved_stock > 0 && (
                      <span className="text-amber-500/50 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-amber-500/60 animate-pulse" />{product.reserved_stock} reserved
                      </span>
                    )}
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ease-out ${
                      level === 'none' ? 'bg-red-500' : level === 'critical' ? 'bg-amber-500' : level === 'low' ? 'bg-yellow-600' : 'bg-emerald-500/70'
                    }`} style={{ width: `${stockBarWidth(product)}%` }} />
                  </div>
                  {level === 'critical' && !isSoldOut && (
                    <div className="text-[10px] text-amber-400/60 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" />{activeBuyers} users competing
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => handleAddToCart(product)} disabled={isSoldOut}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                      isSoldOut ? 'bg-zinc-800/30 text-zinc-700 cursor-not-allowed' :
                      inCart ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-zinc-700/30'
                    }`}>
                    {inCart ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {inCart ? 'In Cart' : 'Add to Cart'}
                  </button>

                  <button onClick={() => handleBuyNow(product)} disabled={isSoldOut || isBuying}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                      isSoldOut ? 'bg-zinc-800/30 text-zinc-700 cursor-not-allowed' :
                      isBuying ? buyState.phase === 'queueing' ? 'bg-sky-500/10 text-sky-400 cursor-wait' :
                        buyState.phase === 'reserving' ? 'bg-amber-500/10 text-amber-400 cursor-wait' :
                        'bg-cyan-500/10 text-cyan-400 cursor-wait' :
                      isFailed ? 'bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/15' :
                      'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-sm hover:shadow-amber-500/10 active:scale-[0.97]'
                    }`}>
                    {isBuying ? <Loader2 className="w-3 h-3 animate-spin" /> :
                     isSoldOut ? <X className="w-3 h-3" /> :
                     isFailed ? <RefreshCw className="w-3 h-3" /> :
                     <Zap className="w-3 h-3" />}
                    {isBuying ? (buyState.phase === 'queueing' ? 'Queue...' : buyState.phase === 'reserving' ? 'Reserve...' : 'Confirm...') :
                     isSoldOut ? 'Sold Out' : isFailed ? 'Retry' : 'Buy Now'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="text-center py-20 text-zinc-600">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-15" />
          <p className="text-sm">No products in this sale yet.</p>
        </div>
      )}

      {/* Image zoom overlay */}
      {zoomImage && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="Zoomed product" className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl" />
          <button className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-700/40 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" onClick={() => setZoomImage(null)} aria-label="Close zoom">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
