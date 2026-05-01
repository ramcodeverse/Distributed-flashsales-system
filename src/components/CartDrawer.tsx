import { useState } from 'react';
import { useCart } from '../lib/useCart';
import { buyProduct } from '../lib/api';
import type { BuyResult } from '../lib/types';
import { X, Plus, Minus, Trash2, ShoppingCart, Loader2, Check, Zap } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, clearCart, totalPrice, totalItems } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [results, setResults] = useState<BuyResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleCheckout = async () => {
    setCheckingOut(true);
    setResults([]);
    setErrors([]);
    const buyResults: BuyResult[] = [];
    const buyErrors: string[] = [];
    for (const item of items) {
      try {
        const result = await buyProduct(item.product.id, item.saleId, item.quantity);
        buyResults.push(result);
      } catch (err) {
        buyErrors.push(`${item.product.name}: ${err instanceof Error ? err.message : 'Failed'}`);
      }
    }
    setResults(buyResults);
    setErrors(buyErrors);
    setCheckingOut(false);
    if (buyResults.length > 0 && buyErrors.length === 0) {
      setTimeout(() => { clearCart(); onClose(); }, 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-zinc-950 border-l border-zinc-800/40 shadow-2xl animate-slide-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/[0.07] flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Your Cart</h2>
              <p className="text-[11px] text-zinc-600">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-zinc-800/40 flex items-center justify-center text-zinc-600 hover:text-white transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-15" />
              <p className="text-[13px]">Your cart is empty</p>
              <p className="text-[11px] text-zinc-700 mt-0.5">Add some flash deals!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-3 bg-zinc-900/40 border border-zinc-800/30 rounded-lg p-3 animate-slide-up">
                  <img src={item.product.image_url} alt={item.product.name}
                    className="w-14 h-14 rounded-md object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-medium text-white truncate">{item.product.name}</h4>
                    <p className="text-[12px] text-amber-400 font-bold mt-0.5">${item.product.sale_price.toFixed(2)}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-5 h-5 rounded bg-zinc-800/40 hover:bg-zinc-800/60 flex items-center justify-center text-zinc-500 hover:text-white transition-all">
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="w-6 text-center text-[12px] font-medium text-white">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= 5}
                          className="w-5 h-5 rounded bg-zinc-800/40 hover:bg-zinc-800/60 flex items-center justify-center text-zinc-500 hover:text-white transition-all disabled:opacity-30">
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.product.id)}
                        className="w-5 h-5 rounded hover:bg-red-500/10 flex items-center justify-center text-zinc-700 hover:text-red-400 transition-all">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 pt-0.5">
                    <span className="text-[13px] font-bold text-white">${(Number(item.product.sale_price) * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {results.map((r, i) => (
                <div key={i} className="animate-bounce-in bg-emerald-500/[0.07] border border-emerald-500/15 rounded-md px-3 py-2 text-[12px] text-emerald-300 flex items-center gap-2">
                  <Check className="w-3 h-3 flex-shrink-0" />{r.product_name} x{r.quantity} - ${r.total_price}
                </div>
              ))}
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {errors.map((e, i) => (
                <div key={i} className="animate-bounce-in bg-red-500/[0.07] border border-red-500/15 rounded-md px-3 py-2 text-[12px] text-red-300">{e}</div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-zinc-800/40 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-zinc-500">Total</span>
              <span className="text-xl font-bold text-white">${totalPrice.toFixed(2)}</span>
            </div>
            <button onClick={handleCheckout} disabled={checkingOut}
              className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
              {checkingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Zap className="w-3.5 h-3.5" />Checkout ({totalItems})</>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
