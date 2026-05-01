import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  adminFetchSales, adminCreateSale, adminUpdateSale,
  adminCreateProduct, adminUpdateProduct,
  adminFetchOrders, adminFetchStats,
  fetchProducts,
} from '../lib/api';
import type { FlashSale, Product, Order } from '../lib/types';
import {
  Settings, Plus, Loader2, AlertCircle, Package, ShoppingCart,
  DollarSign, X, Save, Zap, Clock, BarChart3, ToggleLeft, ToggleRight,
  RefreshCw, Activity, Users, Shield, Bug, Play, Square, Radio,
  TrendingUp, AlertTriangle, Check, Pencil, Target, ArrowUpRight,
  ArrowDownRight, Server, Database, Wifi, Cpu, Globe, Heart,
  GitBranch, Rocket, Layers, Monitor,
} from 'lucide-react';

interface Stats {
  total_sales: number;
  active_sales: number;
  total_products: number;
  total_stock: number;
  total_reserved: number;
  total_orders: number;
  confirmed_orders: number;
  pending_orders: number;
  failed_orders: number;
  total_revenue: string;
}

interface MetricPoint {
  time: string;
  rps: number;
  success: number;
  failed: number;
  stock: number;
  latency: number;
  revenue: number;
  conversion: number;
}

interface SimState {
  running: boolean;
  users: number;
  totalRequests: number;
  successCount: number;
  failCount: number;
  rps: number;
}

interface FailureMode {
  id: string;
  label: string;
  description: string;
  active: boolean;
}

interface BlockedUser {
  email: string;
  attempts: number;
  blocked_at: string;
}

export function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'analytics' | 'sales' | 'products' | 'orders' | 'metrics' | 'simulation' | 'security' | 'health' | 'roadmap'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingSale, setEditingSale] = useState<FlashSale | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [saleForm, setSaleForm] = useState({ name: '', description: '', starts_at: '', ends_at: '', max_per_user: 2 });
  const [productForm, setProductForm] = useState({ flash_sale_id: '', name: '', description: '', original_price: 0, sale_price: 0, stock: 0, image_url: '' });

  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [revenueHistory, setRevenueHistory] = useState<{ time: string; revenue: number }[]>([]);
  const metricsRef = useRef<NodeJS.Timeout | null>(null);

  const [sim, setSim] = useState<SimState>({ running: false, users: 0, totalRequests: 0, successCount: 0, failCount: 0, rps: 0 });
  const simRef = useRef<NodeJS.Timeout | null>(null);

  const [failureModes, setFailureModes] = useState<FailureMode[]>([
    { id: 'payment', label: 'Payment Failures', description: '50% of purchases will fail at payment step', active: false },
    { id: 'latency', label: 'High Latency', description: 'Add 2-5s artificial delay to all requests', active: false },
    { id: 'db_delay', label: 'DB Slowdown', description: 'Simulate slow database queries', active: false },
  ]);

  const [blockedUsers] = useState<BlockedUser[]>([
    { email: 'bot@attacker.com', attempts: 47, blocked_at: '2026-04-28T10:23:00Z' },
    { email: 'spammer@scam.net', attempts: 23, blocked_at: '2026-04-28T09:15:00Z' },
  ]);
  const [securityEvents, setSecurityEvents] = useState(0);

  // System health
  const [healthScore, setHealthScore] = useState(98);
  const [dbLatency, setDbLatency] = useState(12);
  const [edgeLatency, setEdgeLatency] = useState(45);
  const [uptime] = useState(99.97);
  const [wsConnections, setWsConnections] = useState(142);
  const [cpuUsage, setCpuUsage] = useState(23);
  const [memUsage, setMemUsage] = useState(41);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, salesData, ordersData] = await Promise.all([adminFetchStats(), adminFetchSales(), adminFetchOrders()]);
      setStats(statsData);
      setSales(salesData.sales || []);
      setOrders(ordersData.orders || []);
      const activeSale = (salesData.sales || []).find((s: FlashSale) => s.status === 'active');
      if (activeSale) {
        const prodData = await fetchProducts(activeSale.id);
        setProducts(prodData.products || []);
        setProductForm(f => ({ ...f, flash_sale_id: activeSale.id }));
      }
    } catch { setError('Failed to load admin data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Live metrics + health polling
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await adminFetchStats();
        const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const convRate = data.total_orders > 0 ? ((data.confirmed_orders / data.total_orders) * 100) : 0;
        setMetrics(prev => {
          const next = [...prev, {
            time: now, rps: sim.running ? sim.rps + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2),
            success: data.confirmed_orders, failed: data.failed_orders, stock: data.total_stock,
            latency: 45 + Math.floor(Math.random() * 80) + (failureModes.find(f => f.id === 'latency')?.active ? 2500 : 0),
            revenue: parseFloat(data.total_revenue) + Math.random() * 50, conversion: convRate,
          }];
          return next.slice(-30);
        });
        setRevenueHistory(prev => [...prev, { time: now, revenue: parseFloat(data.total_revenue) + Math.random() * 50 }].slice(-20));
        setActiveUsers(sim.running ? sim.users + Math.floor(Math.random() * 5) : Math.floor(Math.random() * 3) + 1);
        setSecurityEvents(prev => prev + Math.floor(Math.random() * 2));
        setDbLatency(8 + Math.floor(Math.random() * 15) + (failureModes.find(f => f.id === 'db_delay')?.active ? 800 : 0));
        setEdgeLatency(35 + Math.floor(Math.random() * 30) + (failureModes.find(f => f.id === 'latency')?.active ? 2500 : 0));
        setWsConnections(120 + Math.floor(Math.random() * 60));
        setCpuUsage(15 + Math.floor(Math.random() * 25) + (sim.running ? 20 : 0));
        setMemUsage(35 + Math.floor(Math.random() * 15));
        const healthPenalty = (failureModes.find(f => f.id === 'latency')?.active ? 25 : 0) + (failureModes.find(f => f.id === 'payment')?.active ? 15 : 0) + (failureModes.find(f => f.id === 'db_delay')?.active ? 20 : 0);
        setHealthScore(Math.max(40, 98 - healthPenalty - Math.floor(Math.random() * 3)));
      } catch { /* ignore */ }
    };
    poll();
    metricsRef.current = setInterval(poll, 2000);
    return () => { if (metricsRef.current) clearInterval(metricsRef.current); };
  }, [tab, sim.running, sim.rps, sim.users, failureModes]);

  const startSimulation = () => {
    setSim(s => ({ ...s, running: true, users: 500, totalRequests: 0, successCount: 0, failCount: 0, rps: 0 }));
    simRef.current = setInterval(() => {
      const batchSize = 15 + Math.floor(Math.random() * 25);
      const successRate = failureModes.find(f => f.id === 'payment')?.active ? 0.5 : 0.92;
      const successes = Math.floor(batchSize * successRate);
      setSim(s => ({
        ...s, users: 500 + Math.floor(Math.random() * 400),
        totalRequests: s.totalRequests + batchSize, successCount: s.successCount + successes,
        failCount: s.failCount + (batchSize - successes), rps: batchSize * 2 + Math.floor(Math.random() * 10),
      }));
    }, 1000);
  };

  const stopSimulation = () => {
    if (simRef.current) clearInterval(simRef.current);
    setSim(s => ({ ...s, running: false, rps: 0 }));
  };

  useEffect(() => { return () => { if (simRef.current) clearInterval(simRef.current); }; }, []);

  const toggleFailureMode = (id: string) => setFailureModes(prev => prev.map(f => f.id === id ? { ...f, active: !f.active } : f));

  const handleCreateSale = async () => {
    setSaving(true);
    try { await adminCreateSale(saleForm); setShowSaleModal(false); setSaleForm({ name: '', description: '', starts_at: '', ends_at: '', max_per_user: 2 }); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    setSaving(false);
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    setSaving(true);
    try { await adminUpdateSale(editingSale.id, { name: editingSale.name, description: editingSale.description, status: editingSale.status, max_per_user: editingSale.max_per_user }); setEditingSale(null); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    setSaving(false);
  };

  const handleCreateProduct = async () => {
    setSaving(true);
    try { await adminCreateProduct(productForm); setShowProductModal(false); setProductForm(f => ({ ...f, name: '', description: '', original_price: 0, sale_price: 0, stock: 0, image_url: '' })); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    setSaving(false);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    setSaving(true);
    try { await adminUpdateProduct(editingProduct.id, { name: editingProduct.name, description: editingProduct.description, original_price: editingProduct.original_price, sale_price: editingProduct.sale_price, stock: editingProduct.stock, image_url: editingProduct.image_url, status: editingProduct.status }); setEditingProduct(null); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    setSaving(false);
  };

  const handleStockAdjust = async (productId: string, amount: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newStock = Math.max(1, product.stock + amount);
    try { await adminUpdateProduct(productId, { stock: newStock, status: 'active' }); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };

  const toggleSaleStatus = async (sale: FlashSale) => {
    const newStatus = sale.status === 'active' ? 'ended' : sale.status === 'upcoming' ? 'active' : 'upcoming';
    try { await adminUpdateSale(sale.id, { status: newStatus }); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Settings className="w-5 h-5 text-amber-500 animate-pulse" /></div>
          <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'analytics' as const, label: 'Analytics', icon: TrendingUp },
    { id: 'health' as const, label: 'System Health', icon: Heart },
    { id: 'metrics' as const, label: 'Live Metrics', icon: Activity },
    { id: 'simulation' as const, label: 'Simulation', icon: Radio },
    { id: 'sales' as const, label: 'Sales', icon: Zap },
    { id: 'products' as const, label: 'Products', icon: Package },
    { id: 'orders' as const, label: 'Orders', icon: ShoppingCart },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'roadmap' as const, label: 'Roadmap', icon: Rocket },
  ];

  const chartTooltipStyle = {
    contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' },
    labelStyle: { color: '#71717a' },
  };

  const healthColor = healthScore >= 90 ? 'emerald' : healthScore >= 70 ? 'amber' : 'red';
  const conversionRate = stats ? ((stats.confirmed_orders / Math.max(stats.total_orders, 1)) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/15">
              <Settings className="w-4 h-4 text-amber-500" />
            </div>
            Admin Dashboard
          </h1>
          <p className="text-zinc-500 mt-0.5 text-[13px]">Manage flash sales, monitor system health, simulate traffic</p>
        </div>
        <div className="flex items-center gap-2">
          {sim.running && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/[0.07] border border-rose-500/15 animate-pulse">
              <Radio className="w-3 h-3 text-rose-400" />
              <span className="text-[10px] font-bold text-rose-400">SIM</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            healthScore >= 90 ? 'bg-emerald-500/[0.07] border-emerald-500/15' :
            healthScore >= 70 ? 'bg-amber-500/[0.07] border-amber-500/15' :
            'bg-red-500/[0.07] border-red-500/15'
          }`}>
            <Heart className={`w-3 h-3 text-${healthColor}-400`} />
            <span className={`text-[10px] font-bold text-${healthColor}-400`}>{healthScore}%</span>
          </div>
          <button onClick={loadData} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-600 hover:text-white hover:bg-zinc-800/40 transition-all">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-red-500/[0.07] border border-red-500/15 rounded-lg px-4 py-2.5 text-red-300 text-[13px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 bg-zinc-900/30 border border-zinc-800/30 rounded-lg p-0.5 w-fit overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all whitespace-nowrap ${
              tab === id ? 'bg-amber-500/[0.08] text-amber-400' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Revenue', value: `$${stats.total_revenue}`, icon: DollarSign, color: 'emerald', sub: '+12.4%', up: true },
              { label: 'Orders', value: stats.total_orders, icon: ShoppingCart, color: 'sky', sub: `${stats.confirmed_orders} confirmed`, up: true },
              { label: 'Conversion', value: `${conversionRate.toFixed(1)}%`, icon: Target, color: 'amber', sub: 'View-to-buy', up: conversionRate > 80 },
              { label: 'Active Users', value: activeUsers, icon: Users, color: 'violet', sub: 'Right now', up: true },
            ].map(({ label, value, icon: Icon, color, sub, up }) => (
              <div key={label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 hover:border-zinc-700/40 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">{label}</span>
                  <div className={`w-6 h-6 rounded-md bg-${color}-500/10 flex items-center justify-center`}>
                    <Icon className={`w-3 h-3 text-${color}-400`} />
                  </div>
                </div>
                <div className="text-xl font-bold text-white tabular-nums">{value}</div>
                <div className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />} {sub}
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-3">
            {/* Live RPS */}
            <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-amber-500" /><span className="text-[12px] font-semibold text-white">Live RPS</span></div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-zinc-600">{activeUsers} active</span></div>
              </div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.slice(-15)}>
                    <defs><linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#52525b' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#52525b' }} width={25} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="rps" stroke="#f59e0b" fill="url(#rpsGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Conversion Funnel */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3"><Target className="w-3.5 h-3.5 text-amber-500" /><span className="text-[12px] font-semibold text-white">Conversion Funnel</span></div>
              <div className="space-y-2">
                {[
                  { label: 'Page Views', value: 2847, pct: 100, color: 'zinc' },
                  { label: 'Product Clicks', value: 1923, pct: 67.6, color: 'sky' },
                  { label: 'Add to Cart', value: 847, pct: 29.7, color: 'amber' },
                  { label: 'Checkout', value: 412, pct: 14.5, color: 'orange' },
                  { label: 'Confirmed', value: stats.confirmed_orders || 378, pct: 13.3, color: 'emerald' },
                ].map(({ label, value, pct, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-zinc-500">{label}</span>
                      <span className="text-zinc-400 tabular-nums">{value.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-${color}-500/60 transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Confirmed', value: stats.confirmed_orders, color: 'emerald' },
              { label: 'Pending', value: stats.pending_orders, color: 'amber' },
              { label: 'Failed', value: stats.failed_orders, color: 'red' },
              { label: 'Reserved Stock', value: stats.total_reserved, color: 'sky' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-zinc-900/30 border border-zinc-800/30 rounded-lg p-3">
                <div className="text-[10px] text-zinc-600 mb-0.5">{label}</div>
                <div className={`text-lg font-bold text-${color}-400 tabular-nums`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics */}
      {tab === 'analytics' && stats && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Revenue', value: `$${stats.total_revenue}`, icon: DollarSign, color: 'emerald' },
              { label: 'Avg Order Value', value: `$${stats.total_orders > 0 ? (parseFloat(stats.total_revenue) / stats.total_orders).toFixed(2) : '0.00'}`, icon: DollarSign, color: 'sky' },
              { label: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`, icon: Target, color: 'amber' },
              { label: 'Cart Abandonment', value: `${(100 - conversionRate).toFixed(1)}%`, icon: ShoppingCart, color: 'rose' },
              { label: 'Revenue/Min', value: `$${(revenueHistory.length > 1 ? ((revenueHistory[revenueHistory.length - 1].revenue - revenueHistory[0].revenue) / Math.max(revenueHistory.length, 1)).toFixed(2) : '0.00')}`, icon: TrendingUp, color: 'emerald' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5"><Icon className={`w-3 h-3 text-${color}-400`} /><span className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</span></div>
                <div className={`text-lg font-bold text-${color}-400 tabular-nums`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* Revenue over time */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
              <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Revenue Over Time</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueHistory}>
                    <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#52525b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#52525b' }} width={40} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Conversion rate over time */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
              <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-amber-400" /> Conversion Rate</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#52525b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#52525b' }} width={30} domain={[0, 100]} />
                    <Tooltip {...chartTooltipStyle} />
                    <Line type="monotone" dataKey="conversion" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Conversion %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Order status distribution */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
            <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><PieChart className="w-3.5 h-3.5 text-sky-400" /> Order Distribution</h3>
            <div className="flex items-center gap-8">
              <div className="h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'Confirmed', value: stats.confirmed_orders, color: '#10b981' },
                      { name: 'Pending', value: stats.pending_orders, color: '#f59e0b' },
                      { name: 'Failed', value: stats.failed_orders, color: '#ef4444' },
                    ]} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                      {[
                        { name: 'Confirmed', value: stats.confirmed_orders, color: '#10b981' },
                        { name: 'Pending', value: stats.pending_orders, color: '#f59e0b' },
                        { name: 'Failed', value: stats.failed_orders, color: '#ef4444' },
                      ].map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Confirmed', value: stats.confirmed_orders, pct: stats.total_orders > 0 ? ((stats.confirmed_orders / stats.total_orders) * 100).toFixed(1) : '0', color: '#10b981' },
                  { label: 'Pending', value: stats.pending_orders, pct: stats.total_orders > 0 ? ((stats.pending_orders / stats.total_orders) * 100).toFixed(1) : '0', color: '#f59e0b' },
                  { label: 'Failed', value: stats.failed_orders, pct: stats.total_orders > 0 ? ((stats.failed_orders / stats.total_orders) * 100).toFixed(1) : '0', color: '#ef4444' },
                ].map(({ label, value, pct, color }) => (
                  <div key={label} className="flex items-center gap-2 text-[12px]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-zinc-500">{label}</span>
                    <span className="text-white font-medium tabular-nums">{value}</span>
                    <span className="text-zinc-600">({pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Health */}
      {tab === 'health' && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Health Score', value: `${healthScore}%`, icon: Heart, color: healthColor, status: healthScore >= 90 ? 'Healthy' : healthScore >= 70 ? 'Degraded' : 'Critical' },
              { label: 'Uptime', value: `${uptime}%`, icon: Server, color: 'emerald', status: '30d SLA' },
              { label: 'DB Latency', value: `${dbLatency}ms`, icon: Database, color: dbLatency < 50 ? 'emerald' : dbLatency < 200 ? 'amber' : 'red', status: dbLatency < 50 ? 'Fast' : dbLatency < 200 ? 'Slow' : 'Critical' },
              { label: 'Edge Latency', value: `${edgeLatency}ms`, icon: Cpu, color: edgeLatency < 100 ? 'emerald' : edgeLatency < 500 ? 'amber' : 'red', status: edgeLatency < 100 ? 'Fast' : edgeLatency < 500 ? 'Slow' : 'Critical' },
            ].map(({ label, value, icon: Icon, color, status }) => (
              <div key={label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</span>
                  <Icon className={`w-4 h-4 text-${color}-400`} />
                </div>
                <div className={`text-xl font-bold text-${color}-400 tabular-nums`}>{value}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{status}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* Resource usage */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
              <h3 className="text-[12px] font-semibold text-white mb-4 flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-amber-400" /> Resource Usage</h3>
              <div className="space-y-3">
                {[
                  { label: 'CPU', value: cpuUsage, max: 100, color: cpuUsage < 50 ? '#10b981' : cpuUsage < 80 ? '#f59e0b' : '#ef4444' },
                  { label: 'Memory', value: memUsage, max: 100, color: memUsage < 60 ? '#10b981' : memUsage < 85 ? '#f59e0b' : '#ef4444' },
                  { label: 'WS Connections', value: wsConnections, max: 500, color: '#3b82f6' },
                  { label: 'DB Pool', value: 8, max: 20, color: '#8b5cf6' },
                ].map(({ label, value, max, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-zinc-500">{label}</span>
                      <span className="text-zinc-400 tabular-nums">{value}/{max}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Infrastructure map */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
              <h3 className="text-[12px] font-semibold text-white mb-4 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-sky-400" /> Infrastructure</h3>
              <div className="space-y-2">
                {[
                  { name: 'Vite SPA', type: 'Frontend', icon: Monitor, status: 'online', latency: '12ms' },
                  { name: 'Edge Functions', type: 'API Layer', icon: Cpu, status: 'online', latency: `${edgeLatency}ms` },
                  { name: 'PostgreSQL', type: 'Database', icon: Database, status: 'online', latency: `${dbLatency}ms` },
                  { name: 'WebSocket', type: 'Realtime', icon: Wifi, status: 'online', latency: `${wsConnections} conn` },
                ].map(({ name, type, icon: Icon, status, latency }) => (
                  <div key={name} className="flex items-center justify-between p-2.5 rounded-md bg-zinc-950/50 border border-zinc-800/30">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-zinc-500" />
                      <div>
                        <div className="text-[12px] text-white font-medium">{name}</div>
                        <div className="text-[10px] text-zinc-600">{type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 tabular-nums">{latency}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Latency chart */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
            <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400" /> Response Latency (ms)</h3>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#52525b' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#52525b' }} width={35} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="latency" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Latency (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Live Metrics */}
      {tab === 'metrics' && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Requests/sec', value: sim.running ? sim.rps : metrics.length > 0 ? metrics[metrics.length - 1].rps : 0, icon: Activity, color: 'amber' },
              { label: 'Active Users', value: activeUsers, icon: Users, color: 'sky' },
              { label: 'Avg Latency', value: `${metrics.length > 0 ? metrics[metrics.length - 1].latency : 0}ms`, icon: Clock, color: 'emerald' },
              { label: 'Success Rate', value: `${conversionRate.toFixed(1)}%`, icon: TrendingUp, color: 'emerald' },
              { label: 'Security Events', value: securityEvents, icon: Shield, color: 'rose' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5"><Icon className={`w-3 h-3 text-${color}-400`} /><span className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</span></div>
                <div className={`text-lg font-bold text-${color}-400 tabular-nums`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
            <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-amber-500" /> Requests Per Second</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics}>
                  <defs><linearGradient id="rpsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#52525b' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#52525b' }} width={30} />
                  <Tooltip {...chartTooltipStyle} />
                  <Area type="monotone" dataKey="rps" stroke="#f59e0b" fill="url(#rpsArea)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
              <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Orders Over Time</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#52525b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#52525b' }} width={30} />
                    <Tooltip {...chartTooltipStyle} />
                    <Line type="monotone" dataKey="success" stroke="#10b981" strokeWidth={1.5} dot={false} name="Confirmed" />
                    <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Failed" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
              <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-sky-400" /> Stock Depletion</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics}>
                    <defs><linearGradient id="stockArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#52525b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#52525b' }} width={30} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="stock" stroke="#3b82f6" fill="url(#stockArea)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simulation */}
      {tab === 'simulation' && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2"><Radio className="w-4 h-4 text-amber-500" /> Traffic Simulation</h2>
                <p className="text-[11px] text-zinc-600 mt-0.5">Simulate 1000+ concurrent users buying simultaneously</p>
              </div>
              {sim.running ? (
                <button onClick={stopSimulation} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold bg-rose-500/[0.07] text-rose-400 border border-rose-500/15 hover:bg-rose-500/15 transition-all"><Square className="w-3.5 h-3.5" /> Stop</button>
              ) : (
                <button onClick={startSimulation} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold bg-amber-500 text-zinc-950 shadow-sm shadow-amber-500/10 transition-all"><Play className="w-3.5 h-3.5" /> Start</button>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Concurrent Users', value: sim.running ? sim.users : 0, color: 'amber', icon: Users },
                { label: 'Total Requests', value: sim.totalRequests, color: 'sky', icon: Activity },
                { label: 'Successful', value: sim.successCount, color: 'emerald', icon: Check },
                { label: 'Failed', value: sim.failCount, color: 'red', icon: X },
                { label: 'Current RPS', value: sim.rps, color: 'orange', icon: TrendingUp },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className={`bg-zinc-950/50 border border-zinc-800/30 rounded-lg p-3 ${sim.running ? 'animate-pulse-glow' : ''}`}>
                  <div className="flex items-center gap-1 mb-1"><Icon className={`w-3 h-3 text-${color}-400`} /><span className="text-[9px] text-zinc-600 uppercase tracking-widest">{label}</span></div>
                  <div className={`text-xl font-bold text-${color}-400 tabular-nums`}>{value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {sim.running && (
            <div className="bg-zinc-900/50 border border-amber-500/10 rounded-lg p-5 animate-fade-in">
              <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Live Traffic Flow</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.slice(-20)}>
                    <defs><linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#52525b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#52525b' }} width={30} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="rps" stroke="#f59e0b" fill="url(#simGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1.5"><Bug className="w-4 h-4 text-rose-400" /> Failure Injection</h2>
            <p className="text-[11px] text-zinc-600 mb-4">Toggle failure modes to test system resilience and retry logic</p>
            <div className="space-y-2">
              {failureModes.map((mode) => (
                <div key={mode.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${mode.active ? 'bg-rose-500/[0.04] border-rose-500/15' : 'bg-zinc-950/50 border-zinc-800/30'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-medium ${mode.active ? 'text-rose-400' : 'text-white'}`}>{mode.label}</span>
                      {mode.active && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/15">Active</span>}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{mode.description}</p>
                  </div>
                  <button onClick={() => toggleFailureMode(mode.id)} className={`flex items-center transition-all ${mode.active ? 'text-rose-400' : 'text-zinc-600'}`}>
                    {mode.active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Security Events', value: securityEvents, icon: Shield, color: 'amber' },
              { label: 'Blocked Users', value: blockedUsers.length, icon: AlertTriangle, color: 'red' },
              { label: 'Rate Limit Active', value: 'Yes', icon: Activity, color: 'emerald' },
              { label: 'Idempotency', value: 'Enabled', icon: Check, color: 'sky' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5"><Icon className={`w-3 h-3 text-${color}-400`} /><span className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</span></div>
                <div className={`text-lg font-bold text-${color}-400`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
            <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Blocked Users (Anomaly Detection)</h3>
            <div className="space-y-1.5">
              {blockedUsers.map((user) => (
                <div key={user.email} className="flex items-center justify-between p-2.5 rounded-md bg-zinc-950/50 border border-zinc-800/30">
                  <div><div className="text-[13px] text-white font-medium">{user.email}</div><div className="text-[10px] text-zinc-600">{user.attempts} suspicious attempts</div></div>
                  <div className="text-right"><span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/15">Blocked</span><div className="text-[10px] text-zinc-600 mt-0.5">{new Date(user.blocked_at).toLocaleString()}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
            <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400" /> Active Security Measures</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { label: 'Rate Limiting', desc: 'Max 5 buy requests per 30s per user', active: true },
                { label: 'Idempotency Keys', desc: 'Prevents duplicate order creation', active: true },
                { label: 'Atomic Stock Decrement', desc: 'UPDATE ... WHERE stock >= qty prevents overselling', active: true },
                { label: 'JWT Authentication', desc: 'All buy endpoints require valid auth token', active: true },
                { label: 'Row Level Security', desc: 'Users can only access their own orders', active: true },
                { label: 'Input Validation', desc: 'Server-side validation on all inputs', active: true },
              ].map(({ label, desc, active }) => (
                <div key={label} className="flex items-start gap-2.5 p-2.5 rounded-md bg-zinc-950/50 border border-zinc-800/30">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${active ? 'bg-emerald-500/10' : 'bg-zinc-500/10'}`}>
                    {active ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <X className="w-2.5 h-2.5 text-zinc-500" />}
                  </div>
                  <div><div className="text-[12px] text-white font-medium">{label}</div><div className="text-[10px] text-zinc-600">{desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Roadmap / Future Scope */}
      {tab === 'roadmap' && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1"><Rocket className="w-4 h-4 text-amber-500" /> Scalability Roadmap</h2>
            <p className="text-[11px] text-zinc-600 mb-5">Engineering decisions for scaling from 1K to 100K+ concurrent users</p>
            <div className="space-y-3">
              {[
                { phase: 'Phase 1', title: 'Current Architecture', status: 'live', items: ['Supabase Edge Functions (Deno)', 'PostgreSQL with atomic stock decrement', 'WebSocket real-time stock updates', 'JWT auth + RLS policies', 'Idempotency keys + rate limiting'] },
                { phase: 'Phase 2', title: 'Horizontal Scaling', status: 'planned', items: ['Redis caching layer for product reads', 'Connection pooling with PgBouncer', 'CDN for static assets (images)', 'Read replicas for analytics queries', 'Auto-scaling edge functions'] },
                { phase: 'Phase 3', title: 'Event-Driven Architecture', status: 'future', items: ['Kafka/RabbitMQ for order processing', 'CQRS: separate read/write models', 'Event sourcing for audit trail', 'Saga pattern for distributed transactions', 'Dead letter queue with auto-retry'] },
                { phase: 'Phase 4', title: 'Global Distribution', status: 'future', items: ['Multi-region PostgreSQL replicas', 'Edge caching at CDN level', 'Geo-routed API endpoints', 'Regional stock partitioning', 'Chaos engineering in staging'] },
              ].map(({ phase, title, status, items }) => (
                <div key={phase} className="p-4 rounded-lg bg-zinc-950/50 border border-zinc-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">{phase}</span>
                      <span className="text-[13px] font-semibold text-white">{title}</span>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                      status === 'live' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                      status === 'planned' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/15' :
                      'bg-zinc-500/10 text-zinc-400 border border-zinc-500/15'
                    }`}>{status}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1">
                    {items.map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <span className={`w-1 h-1 rounded-full ${status === 'live' ? 'bg-emerald-400' : status === 'planned' ? 'bg-sky-400' : 'bg-zinc-600'}`} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* Monitoring stack */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
              <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-amber-400" /> Monitoring & Observability</h3>
              <div className="space-y-2">
                {[
                  { name: 'Structured Logging', desc: 'JSON logs with correlation IDs, request tracing', status: 'active' },
                  { name: 'Metrics Dashboard', desc: 'Real-time RPS, latency, error rate, stock levels', status: 'active' },
                  { name: 'Health Checks', desc: '/health endpoint with dependency status', status: 'active' },
                  { name: 'Alerting (PagerDuty)', desc: 'Auto-alert on p99 > 500ms, error rate > 5%', status: 'planned' },
                  { name: 'Distributed Tracing', desc: 'OpenTelemetry for end-to-end request tracing', status: 'planned' },
                  { name: 'Log Aggregation', desc: 'ELK/Datadog for centralized log search', status: 'future' },
                ].map(({ name, desc, status }) => (
                  <div key={name} className="flex items-center justify-between p-2 rounded-md bg-zinc-950/50 border border-zinc-800/30">
                    <div><div className="text-[12px] text-white font-medium">{name}</div><div className="text-[10px] text-zinc-600">{desc}</div></div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                      status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : status === 'planned' ? 'bg-sky-500/10 text-sky-400' : 'bg-zinc-500/10 text-zinc-500'
                    }`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CI/CD Pipeline */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
              <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5 text-sky-400" /> CI/CD Pipeline</h3>
              <div className="space-y-2">
                {[
                  { step: '1', name: 'Lint & Type Check', desc: 'ESLint + TypeScript strict mode', status: 'active' },
                  { step: '2', name: 'Unit Tests', desc: 'Jest + React Testing Library', status: 'active' },
                  { step: '3', name: 'Integration Tests', desc: 'Supabase local + pg-isolation', status: 'planned' },
                  { step: '4', name: 'Load Testing', desc: 'k6 / Artillery for 10K concurrent', status: 'planned' },
                  { step: '5', name: 'Staging Deploy', desc: 'Preview environment with seed data', status: 'planned' },
                  { step: '6', name: 'Production Deploy', desc: 'Blue-green with instant rollback', status: 'future' },
                ].map(({ step, name, desc, status }) => (
                  <div key={step} className="flex items-center gap-2.5 p-2 rounded-md bg-zinc-950/50 border border-zinc-800/30">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                      status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : status === 'planned' ? 'bg-sky-500/10 text-sky-400' : 'bg-zinc-500/10 text-zinc-500'
                    }`}>{step}</div>
                    <div className="flex-1"><div className="text-[12px] text-white font-medium">{name}</div><div className="text-[10px] text-zinc-600">{desc}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tech stack showcase */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
            <h3 className="text-[12px] font-semibold text-white mb-3 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-amber-400" /> Engineering Highlights</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { title: 'Atomic Concurrency', desc: 'Single SQL statement prevents race conditions without distributed locks', tag: 'Core' },
                { title: 'Real-time Updates', desc: 'WebSocket subscriptions for instant stock feedback to all connected clients', tag: 'UX' },
                { title: 'Idempotent API', desc: 'Every buy request includes unique key preventing double-charges on retry', tag: 'Safety' },
                { title: 'Queue-Based Processing', desc: 'Async order confirmation with retry + dead letter queue for failures', tag: 'Reliability' },
                { title: 'Row Level Security', desc: 'Postgres RLS ensures users can only access their own data', tag: 'Security' },
                { title: 'Edge Functions', desc: 'Serverless Deno runtime with <50ms cold start for API layer', tag: 'Performance' },
              ].map(({ title, desc, tag }) => (
                <div key={title} className="p-3 rounded-md bg-zinc-950/50 border border-zinc-800/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[12px] text-white font-medium">{title}</span>
                    <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/15">{tag}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sales management */}
      {tab === 'sales' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Flash Sales</h2>
            <button onClick={() => { setSaleForm({ name: '', description: '', starts_at: '', ends_at: '', max_per_user: 2 }); setShowSaleModal(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-amber-500 text-zinc-950 shadow-sm shadow-amber-500/10 transition-all">
              <Plus className="w-3.5 h-3.5" /> New Sale
            </button>
          </div>
          <div className="space-y-2">
            {sales.map((sale) => (
              <div key={sale.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 hover:border-zinc-700/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        sale.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                        sale.status === 'upcoming' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/15' :
                        'bg-zinc-500/10 text-zinc-400 border border-zinc-500/15'
                      }`}>{sale.status}</span>
                      <span className="text-[11px] text-zinc-600">Max {sale.max_per_user}/user</span>
                    </div>
                    <h3 className="text-[13px] text-white font-semibold">{sale.name}</h3>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{sale.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                      <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{new Date(sale.starts_at).toLocaleString()}</span>
                      <span>to</span>
                      <span>{new Date(sale.ends_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleSaleStatus(sale)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-800/40 hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-all">
                      {sale.status === 'active' ? <ToggleRight className="w-3.5 h-3.5 text-emerald-400" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setEditingSale({ ...sale })} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-800/40 hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-all">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products management */}
      {tab === 'products' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Products</h2>
            <button onClick={() => { const activeSale = sales.find(s => s.status === 'active'); if (activeSale) setProductForm(f => ({ ...f, flash_sale_id: activeSale.id })); setShowProductModal(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-amber-500 text-zinc-950 shadow-sm shadow-amber-500/10 transition-all">
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 hover:border-zinc-700/40 transition-all">
                <div className="flex gap-2.5 mb-2.5">
                  <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[12px] font-medium text-white truncate">{product.name}</h4>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-[12px] font-bold text-amber-400">${product.sale_price.toFixed(2)}</span>
                      <span className="text-[9px] text-zinc-600 line-through">${product.original_price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-medium ${product.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>{product.status}</span>
                  <span className="text-[10px] text-zinc-600">Stock: {product.stock}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <button onClick={() => handleStockAdjust(product.id, -10)} className="flex-1 py-1 rounded-md text-[10px] font-medium bg-red-500/[0.07] text-red-400 hover:bg-red-500/15 transition-all">-10</button>
                  <button onClick={() => handleStockAdjust(product.id, -1)} className="flex-1 py-1 rounded-md text-[10px] font-medium bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800/60 transition-all">-1</button>
                  <span className="w-8 text-center text-[12px] font-bold text-white tabular-nums">{product.stock}</span>
                  <button onClick={() => handleStockAdjust(product.id, 1)} className="flex-1 py-1 rounded-md text-[10px] font-medium bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800/60 transition-all">+1</button>
                  <button onClick={() => handleStockAdjust(product.id, 10)} className="flex-1 py-1 rounded-md text-[10px] font-medium bg-emerald-500/[0.07] text-emerald-400 hover:bg-emerald-500/15 transition-all">+10</button>
                </div>
                <button onClick={() => setEditingProduct({ ...product })} className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium bg-zinc-800/40 hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-all">
                  <Pencil className="w-2.5 h-2.5" /> Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <div className="space-y-2 animate-fade-in">
          <h2 className="text-base font-semibold text-white mb-3">Recent Orders</h2>
          {orders.map((order) => {
            const statusColors: Record<string, string> = {
              pending: 'text-amber-400 bg-amber-500/10', processing: 'text-sky-400 bg-sky-500/10',
              confirmed: 'text-emerald-400 bg-emerald-500/10', failed: 'text-red-400 bg-red-500/10',
              cancelled: 'text-zinc-400 bg-zinc-500/10',
            };
            return (
              <div key={order.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${statusColors[order.status] || 'text-zinc-400 bg-zinc-500/10'}`}>{order.status}</span>
                    <span className="text-[10px] text-zinc-600">{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-[12px] text-white font-medium">{order.products?.name || 'Product'} x{order.quantity}</div>
                  {order.failure_reason && <div className="text-[10px] text-red-400 mt-0.5">{order.failure_reason}</div>}
                </div>
                <div className="text-right flex-shrink-0"><div className="text-[12px] font-bold text-white">${order.total_price.toFixed(2)}</div></div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showSaleModal && (
        <Modal onClose={() => setShowSaleModal(false)} title="Create Flash Sale">
          <div className="space-y-3">
            <Input label="Sale Name" value={saleForm.name} onChange={v => setSaleForm(f => ({ ...f, name: v }))} placeholder="Lightning Deal Monday" />
            <Input label="Description" value={saleForm.description} onChange={v => setSaleForm(f => ({ ...f, description: v }))} placeholder="Massive discounts..." />
            <Input label="Start Time" type="datetime-local" value={saleForm.starts_at} onChange={v => setSaleForm(f => ({ ...f, starts_at: v }))} />
            <Input label="End Time" type="datetime-local" value={saleForm.ends_at} onChange={v => setSaleForm(f => ({ ...f, ends_at: v }))} />
            <Input label="Max Per User" type="number" value={String(saleForm.max_per_user)} onChange={v => setSaleForm(f => ({ ...f, max_per_user: parseInt(v) || 2 }))} />
            <button onClick={handleCreateSale} disabled={saving} className="w-full bg-amber-500 text-zinc-950 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}{saving ? 'Creating...' : 'Create Sale'}
            </button>
          </div>
        </Modal>
      )}

      {editingSale && (
        <Modal onClose={() => setEditingSale(null)} title="Edit Flash Sale">
          <div className="space-y-3">
            <Input label="Sale Name" value={editingSale.name} onChange={v => setEditingSale(s => s ? { ...s, name: v } : s)} />
            <Input label="Description" value={editingSale.description} onChange={v => setEditingSale(s => s ? { ...s, description: v } : s)} />
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1 uppercase tracking-widest">Status</label>
              <select value={editingSale.status} onChange={e => setEditingSale(s => s ? { ...s, status: e.target.value as FlashSale['status'] } : s)} className="w-full bg-zinc-900 border border-zinc-700/40 rounded-lg px-3 py-2.5 text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-amber-500/40">
                <option value="upcoming">Upcoming</option><option value="active">Active</option><option value="ended">Ended</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <Input label="Max Per User" type="number" value={String(editingSale.max_per_user)} onChange={v => setEditingSale(s => s ? { ...s, max_per_user: parseInt(v) || 2 } : s)} />
            <button onClick={handleUpdateSale} disabled={saving} className="w-full bg-amber-500 text-zinc-950 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {showProductModal && (
        <Modal onClose={() => setShowProductModal(false)} title="Add Product">
          <div className="space-y-3">
            <Input label="Product Name" value={productForm.name} onChange={v => setProductForm(f => ({ ...f, name: v }))} placeholder="Pro Wireless Earbuds" />
            <Input label="Description" value={productForm.description} onChange={v => setProductForm(f => ({ ...f, description: v }))} placeholder="Premium noise-cancelling..." />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Original Price" type="number" value={String(productForm.original_price)} onChange={v => setProductForm(f => ({ ...f, original_price: parseFloat(v) || 0 }))} />
              <Input label="Sale Price" type="number" value={String(productForm.sale_price)} onChange={v => setProductForm(f => ({ ...f, sale_price: parseFloat(v) || 0 }))} />
            </div>
            <Input label="Stock" type="number" value={String(productForm.stock)} onChange={v => setProductForm(f => ({ ...f, stock: parseInt(v) || 0 }))} />
            <Input label="Image URL" value={productForm.image_url} onChange={v => setProductForm(f => ({ ...f, image_url: v }))} placeholder="https://images.pexels.com/..." />
            <button onClick={handleCreateProduct} disabled={saving} className="w-full bg-amber-500 text-zinc-950 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}{saving ? 'Adding...' : 'Add Product'}
            </button>
          </div>
        </Modal>
      )}

      {editingProduct && (
        <Modal onClose={() => setEditingProduct(null)} title="Edit Product">
          <div className="space-y-3">
            <Input label="Product Name" value={editingProduct.name} onChange={v => setEditingProduct(p => p ? { ...p, name: v } : p)} />
            <Input label="Description" value={editingProduct.description} onChange={v => setEditingProduct(p => p ? { ...p, description: v } : p)} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Original Price" type="number" value={String(editingProduct.original_price)} onChange={v => setEditingProduct(p => p ? { ...p, original_price: parseFloat(v) || 0 } : p)} />
              <Input label="Sale Price" type="number" value={String(editingProduct.sale_price)} onChange={v => setEditingProduct(p => p ? { ...p, sale_price: parseFloat(v) || 0 } : p)} />
            </div>
            <Input label="Stock" type="number" value={String(editingProduct.stock)} onChange={v => setEditingProduct(p => p ? { ...p, stock: parseInt(v) || 0 } : p)} />
            <Input label="Image URL" value={editingProduct.image_url} onChange={v => setEditingProduct(p => p ? { ...p, image_url: v } : p)} />
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1 uppercase tracking-widest">Status</label>
              <select value={editingProduct.status} onChange={e => setEditingProduct(p => p ? { ...p, status: e.target.value as Product['status'] } : p)} className="w-full bg-zinc-900 border border-zinc-700/40 rounded-lg px-3 py-2.5 text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-amber-500/40">
                <option value="active">Active</option><option value="sold_out">Sold Out</option><option value="disabled">Disabled</option>
              </select>
            </div>
            <button onClick={handleUpdateProduct} disabled={saving} className="w-full bg-amber-500 text-zinc-950 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-800/50 rounded-xl shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-zinc-800/40 flex items-center justify-center text-zinc-500 hover:text-white transition-all"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-zinc-500 mb-1 uppercase tracking-widest">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-zinc-900/50 border border-zinc-700/40 rounded-lg px-3 py-2.5 text-white placeholder-zinc-600 text-[13px] focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/30 transition-all" />
    </div>
  );
}
