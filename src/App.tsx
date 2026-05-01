import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/useAuth';
import { CartProvider } from './lib/useCart';
import { ToastProvider } from './lib/useToast';
import { AuthForm } from './components/AuthForm';
import { Header } from './components/Header';
import { SaleList } from './components/SaleList';
import { ProductGrid } from './components/ProductGrid';
import { OrderList } from './components/OrderList';
import { CartDrawer } from './components/CartDrawer';
import { AdminDashboard } from './components/AdminDashboard';
import { SystemDesign } from './components/SystemDesign';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { FlashSale } from './lib/types';
import { Loader2, Zap } from 'lucide-react';

function AppContent() {
  const { user, loading, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState('sales');
  const [selectedSale, setSelectedSale] = useState<FlashSale | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const handleSelectSale = (sale: FlashSale) => {
    setSelectedSale(sale);
    setCurrentView('products');
  };

  const handleViewChange = (view: string) => {
    if (view === 'admin' && !isAdmin) return;
    setCurrentView(view);
    setSelectedSale(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header currentView={currentView} onViewChange={handleViewChange} onCartOpen={() => setCartOpen(true)} />
      <main className="pb-16 md:pb-0">
        <ErrorBoundary>
          {currentView === 'sales' && <SaleList onSelectSale={handleSelectSale} />}
          {currentView === 'products' && selectedSale && <ProductGrid sale={selectedSale} onBack={() => { setSelectedSale(null); setCurrentView('sales'); }} />}
          {currentView === 'orders' && <OrderList />}
          {currentView === 'admin' && isAdmin && <AdminDashboard />}
          {currentView === 'system-design' && <SystemDesign />}
        </ErrorBoundary>
      </main>
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
