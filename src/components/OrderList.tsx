import { useEffect, useState } from 'react';
import { fetchOrders } from '../lib/api';
import type { Order } from '../lib/types';
import { ShoppingBag, AlertCircle, Clock, Check, X, RefreshCw, Search, Download, Filter } from 'lucide-react';
import { SkeletonRow } from './Skeleton';

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchOrders();
      setOrders(data.orders || []);
    } catch { setError('Failed to load orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadOrders(); }, []);

  const statusConfig: Record<string, { color: string; icon: typeof Check; label: string }> = {
    pending: { color: 'text-amber-400 bg-amber-500/[0.07] border-amber-500/15', icon: Clock, label: 'Pending' },
    processing: { color: 'text-sky-400 bg-sky-500/[0.07] border-sky-500/15', icon: RefreshCw, label: 'Processing' },
    confirmed: { color: 'text-emerald-400 bg-emerald-500/[0.07] border-emerald-500/15', icon: Check, label: 'Confirmed' },
    failed: { color: 'text-red-400 bg-red-500/[0.07] border-red-500/15', icon: X, label: 'Failed' },
    cancelled: { color: 'text-zinc-400 bg-zinc-500/[0.07] border-zinc-500/15', icon: X, label: 'Cancelled' },
    refunded: { color: 'text-orange-400 bg-orange-500/[0.07] border-orange-500/15', icon: RefreshCw, label: 'Refunded' },
  };

  const timelineSteps = ['pending', 'processing', 'confirmed'];

  const getTimelineStatus = (orderStatus: string, step: string) => {
    const orderIdx = timelineSteps.indexOf(orderStatus);
    const stepIdx = timelineSteps.indexOf(step);
    if (orderStatus === 'failed' || orderStatus === 'cancelled') {
      return step === 'pending' ? 'failed' : 'inactive';
    }
    if (stepIdx < orderIdx) return 'completed';
    if (stepIdx === orderIdx) return 'current';
    return 'inactive';
  };

  const exportCSV = () => {
    const headers = ['Order ID', 'Product', 'Quantity', 'Unit Price', 'Total', 'Status', 'Date'];
    const rows = filteredOrders.map(o => [o.id, o.products?.name || 'Product', o.quantity, o.unit_price, o.total_price, o.status, o.created_at]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = !search || (o.products?.name || '').toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6 animate-pulse">
          <div><div className="h-6 w-32 bg-zinc-800/60 rounded mb-1" /><div className="h-4 w-24 bg-zinc-800/40 rounded" /></div>
        </div>
        <div className="space-y-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">My Orders</h1>
          <p className="text-zinc-500 text-[13px] mt-0.5">{orders.length} order{orders.length !== 1 ? 's' : ''} placed</p>
        </div>
        <div className="flex items-center gap-1.5">
          {orders.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-600 hover:text-white hover:bg-zinc-800/40 transition-all" aria-label="Export CSV">
              <Download className="w-3 h-3" /> Export
            </button>
          )}
          <button onClick={loadOrders} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-600 hover:text-white hover:bg-zinc-800/40 transition-all" aria-label="Refresh orders">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      {orders.length > 2 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..."
              aria-label="Search orders"
              className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-lg pl-9 pr-9 py-2 text-[12px] text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 transition-all" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors" aria-label="Clear search">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="appearance-none bg-zinc-900/50 border border-zinc-800/50 rounded-lg pl-8 pr-6 py-2 text-[12px] text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 transition-all cursor-pointer">
              <option value="all">All ({orders.length})</option>
              {Object.entries(statusCounts).map(([status, count]) => (
                <option key={status} value={status}>{statusConfig[status]?.label || status} ({count})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredOrders.map((order, i) => {
          const config = statusConfig[order.status] || statusConfig.pending;
          const Icon = config.icon;
          const showTimeline = ['pending', 'processing', 'confirmed'].includes(order.status);

          return (
            <div key={order.id}
              className={`bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 hover:border-zinc-700/50 transition-all animate-slide-up stagger-${Math.min(i + 1, 8)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${config.color}`}>
                      <Icon className={`w-2.5 h-2.5 ${order.status === 'processing' ? 'animate-spin' : ''}`} />
                      {config.label}
                    </span>
                    <span className="text-[11px] text-zinc-600">{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                  <h3 className="text-[13px] text-white font-medium truncate">
                    {order.products?.name || 'Product'}<span className="text-zinc-600 font-normal"> x{order.quantity}</span>
                  </h3>
                  {order.failure_reason && <p className="text-[11px] text-red-400/70 mt-0.5">{order.failure_reason}</p>}

                  {/* Timeline for active orders */}
                  {showTimeline && (
                    <div className="flex items-center gap-1 mt-2.5">
                      {timelineSteps.map((step, idx) => {
                        const stepStatus = getTimelineStatus(order.status, step);
                        return (
                          <div key={step} className="flex items-center gap-1">
                            {idx > 0 && <div className={`w-4 h-px ${stepStatus === 'completed' ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />}
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${
                                stepStatus === 'completed' ? 'bg-emerald-400' :
                                stepStatus === 'current' ? 'bg-amber-400 animate-pulse' :
                                'bg-zinc-700'
                              }`} />
                              <span className={`text-[9px] uppercase tracking-wider ${
                                stepStatus === 'completed' ? 'text-emerald-400/60' :
                                stepStatus === 'current' ? 'text-amber-400' :
                                'text-zinc-700'
                              }`}>{step}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-white">${order.total_price.toFixed(2)}</div>
                  <div className="text-[10px] text-zinc-600">${order.unit_price.toFixed(2)} each</div>
                </div>
              </div>
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-15" />
            <p className="text-sm mb-0.5">No orders yet</p>
            <p className="text-[13px] text-zinc-700">Grab a flash deal to get started!</p>
          </div>
        )}

        {search && filteredOrders.length === 0 && orders.length > 0 && (
          <div className="text-center py-12 text-zinc-600">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No orders match "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
