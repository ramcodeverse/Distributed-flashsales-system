import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { X, Check, AlertTriangle, Info, Zap } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'purchase';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }]);
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration);
      timersRef.current.set(id, timer);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

const iconMap: Record<ToastType, typeof Check> = {
  success: Check, error: X, warning: AlertTriangle, info: Info, purchase: Zap,
};

const styleMap: Record<ToastType, string> = {
  success: 'border-emerald-500/20 bg-emerald-500/[0.07]',
  error: 'border-red-500/20 bg-red-500/[0.07]',
  warning: 'border-amber-500/20 bg-amber-500/[0.07]',
  info: 'border-sky-500/20 bg-sky-500/[0.07]',
  purchase: 'border-amber-500/20 bg-amber-500/[0.07]',
};

const iconColorMap: Record<ToastType, string> = {
  success: 'text-emerald-400', error: 'text-red-400', warning: 'text-amber-400', info: 'text-sky-400', purchase: 'text-amber-400',
};

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast, i) => {
        const Icon = iconMap[toast.type];
        return (
          <div key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg border backdrop-blur-sm animate-slide-up ${styleMap[toast.type]}`}
            style={{ animationDelay: `${i * 50}ms` }}>
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColorMap[toast.type]}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white">{toast.title}</div>
              {toast.message && <div className="text-[11px] text-zinc-400 mt-0.5">{toast.message}</div>}
            </div>
            <button onClick={() => onRemove(toast.id)} className="flex-shrink-0 text-zinc-600 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
