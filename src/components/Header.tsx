import { useAuth } from '../lib/useAuth';
import { useCart } from '../lib/useCart';
import { Zap, LogOut, ShoppingBag, User, ShoppingCart, Settings, BookOpen } from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onCartOpen: () => void;
}

export function Header({ currentView, onViewChange, onCartOpen }: HeaderProps) {
  const { user, signOut, isAdmin } = useAuth();
  const { totalItems } = useCart();

  const navItems = [
    { id: 'sales', label: 'Sales', icon: Zap },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'admin', label: 'Admin', icon: Settings, adminOnly: true },
    { id: 'system-design', label: 'Architecture', icon: BookOpen },
  ].filter(item => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-50 glass border-b border-zinc-800/40 hidden md:block" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <button onClick={() => onViewChange('sales')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity" aria-label="Go to sales">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-zinc-950" />
                </div>
                <span className="text-sm font-bold text-white tracking-tight">FlashDeal</span>
              </button>

              <nav className="flex items-center gap-0.5" role="navigation" aria-label="Main navigation">
                {navItems.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => onViewChange(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ${
                      currentView === id
                        ? 'bg-amber-500/[0.08] text-amber-400'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                    aria-current={currentView === id ? 'page' : undefined}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-1.5">
              <button onClick={onCartOpen}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all"
                aria-label={`Shopping cart with ${totalItems} items`}>
                <ShoppingCart className="w-4 h-4" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-amber-500 text-zinc-950 text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm px-1">
                    {totalItems}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 px-2.5 py-1 rounded-md bg-zinc-800/30">
                <User className="w-3 h-3" />
                <span className="max-w-[120px] truncate">{user?.email}</span>
              </div>

              <button onClick={signOut}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[12px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all"
                aria-label="Sign out">
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-zinc-800/40 px-2 pb-[env(safe-area-inset-bottom)]" role="navigation" aria-label="Mobile navigation">
        <div className="flex items-center justify-around h-14">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => onViewChange(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${
                currentView === id ? 'text-amber-400' : 'text-zinc-600'
              }`}
              aria-current={currentView === id ? 'page' : undefined}
              aria-label={label}>
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
          <button onClick={onCartOpen}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all text-zinc-600`}
            aria-label={`Cart with ${totalItems} items`}>
            <div className="relative">
              <ShoppingCart className="w-4 h-4" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-amber-500 text-zinc-950 text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Cart</span>
          </button>
        </div>
      </nav>
    </>
  );
}
