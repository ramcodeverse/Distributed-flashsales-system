import { useEffect, useState, useCallback } from 'react';
import { fetchSales, fetchProducts } from '../lib/api';
import type { FlashSale } from '../lib/types';
import { Clock, Tag, ChevronRight, AlertCircle, Zap, Flame, Timer, Search, X } from 'lucide-react';
import { SkeletonSaleCard } from './Skeleton';

interface SaleListProps {
  onSelectSale: (sale: FlashSale) => void;
}

export function SaleList({ onSelectSale }: SaleListProps) {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSales();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSales();
      setSales(data.sales || []);
      const counts: Record<string, number> = {};
      for (const sale of data.sales || []) {
        try {
          const prodData = await fetchProducts(sale.id);
          counts[sale.id] = (prodData.products || []).filter((p: { status: string }) => p.status === 'active').length;
        } catch { counts[sale.id] = 0; }
      }
      setProductCounts(counts);
    } catch { setError('Failed to load flash sales'); }
    finally { setLoading(false); }
  }, []);

  const getTimeRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - now;
    if (diff <= 0) return { text: 'Ended', urgent: false, diff: 0 };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return { text: `${h}h ${m}m ${s}s`, urgent: diff < 3600000, diff };
    if (m > 0) return { text: `${m}m ${s}s`, urgent: diff < 600000, diff };
    return { text: `${s}s`, urgent: true, diff };
  };

  const getTimeUntilStart = (startsAt: string) => {
    const diff = new Date(startsAt).getTime() - now;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `Starts in ${h > 0 ? `${h}h ` : ''}${m}m`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative mb-8 overflow-hidden rounded-xl bg-zinc-900/40 border border-zinc-800/50 p-6 sm:p-8 animate-pulse">
          <div className="h-4 w-24 bg-zinc-800/60 rounded mb-3" />
          <div className="h-8 w-48 bg-zinc-800/60 rounded mb-2" />
          <div className="h-4 w-72 bg-zinc-800/40 rounded" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonSaleCard /><SkeletonSaleCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-red-400">
        <AlertCircle className="w-4 h-4" /><span className="text-sm">{error}</span>
      </div>
    );
  }

  const activeSales = sales.filter(s => s.status === 'active');
  const upcomingSales = sales.filter(s => s.status === 'upcoming');
  const filteredActive = activeSales.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()));
  const filteredUpcoming = upcomingSales.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Hero */}
      <div className="relative mb-6 overflow-hidden rounded-xl bg-zinc-900/40 border border-zinc-800/50 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/[0.02] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest">Live Now</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">Flash Sales</h1>
            <p className="text-zinc-500 text-sm max-w-md">Grab deals before they're gone. Limited stock, zero overselling, real-time updates.</p>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-zinc-600">{activeSales.length} active</span>
            <span className="text-zinc-800">|</span>
            <span className="text-zinc-600">{upcomingSales.length} upcoming</span>
          </div>
        </div>
      </div>

      {/* Search */}
      {sales.length > 2 && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sales..." aria-label="Search sales"
            className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-lg pl-10 pr-10 py-2.5 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/30 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Active sales */}
      {filteredActive.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-white">Active Sales</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredActive.map((sale, i) => {
              const remaining = getTimeRemaining(sale.ends_at);
              const isLastMinute = remaining.diff > 0 && remaining.diff < 120000;
              return (
                <button key={sale.id} onClick={() => onSelectSale(sale)}
                  className={`group relative text-left bg-zinc-900/50 border rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5 animate-slide-up stagger-${i + 1} ${
                    isLastMinute ? 'border-rose-500/30 hover:border-rose-500/40' : 'border-zinc-800/50 hover:border-zinc-700/60'
                  }`}>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-widest ${
                          isLastMinute ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' : 'bg-emerald-500/[0.07] text-emerald-400 border border-emerald-500/15'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLastMinute ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                          {isLastMinute ? 'Ending Soon' : 'Live'}
                        </span>
                        <span className="text-[11px] text-zinc-600 flex items-center gap-1">
                          <Tag className="w-3 h-3" />{productCounts[sale.id] || 0} deals
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 text-[12px] font-mono font-semibold tabular-nums ${
                        isLastMinute ? 'text-rose-400 animate-pulse' : remaining.urgent ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        <Timer className="w-3 h-3" />{remaining.text}
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors duration-200 mb-1">{sale.name}</h3>
                    <p className="text-[13px] text-zinc-600 line-clamp-2 mb-3">{sale.description}</p>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />Max {sale.max_per_user}/user
                      </span>
                      <span className="flex items-center gap-1 text-[12px] font-medium text-amber-500 group-hover:text-amber-400 transition-colors">
                        Shop Now <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming sales */}
      {filteredUpcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Coming Soon</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredUpcoming.map((sale, i) => {
              const untilStart = getTimeUntilStart(sale.starts_at);
              return (
                <button key={sale.id} onClick={() => onSelectSale(sale)}
                  className={`group text-left bg-zinc-900/30 border border-zinc-800/30 rounded-xl p-5 hover:border-zinc-700/40 transition-all duration-300 animate-slide-up stagger-${i + 3}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/[0.07] text-sky-400 border border-sky-500/15 uppercase tracking-widest">Upcoming</span>
                    {untilStart && <span className="text-[11px] text-sky-400/60">{untilStart}</span>}
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-sky-300 transition-colors mb-1">{sale.name}</h3>
                  <p className="text-[13px] text-zinc-600 line-clamp-1">{sale.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sales.length === 0 && (
        <div className="text-center py-20 text-zinc-600">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-15" />
          <p className="text-sm">No flash sales right now. Check back soon!</p>
        </div>
      )}

      {search && filteredActive.length === 0 && filteredUpcoming.length === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No sales match "{search}"</p>
        </div>
      )}
    </div>
  );
}
