import { useState } from 'react';
import {
  Database, Server, Shield, Zap, Layers,
  Lock, RefreshCw, Clock, BarChart3, GitBranch,
  ChevronDown, ChevronUp, Cpu, Globe, HardDrive,
} from 'lucide-react';

export function SystemDesign() {
  const [expandedSection, setExpandedSection] = useState<string | null>('architecture');

  const toggle = (id: string) => setExpandedSection(prev => prev === id ? null : id);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">System Design</h1>
        <p className="text-zinc-500 text-lg">Architecture, trade-offs, and engineering decisions behind FlashDeal</p>
      </div>

      {/* Architecture Diagram */}
      <Section id="architecture" title="Architecture Overview" icon={Layers} expanded={expandedSection} onToggle={toggle}>
        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-6 mb-6 overflow-x-auto">
          <pre className="text-xs sm:text-sm text-zinc-300 font-mono leading-relaxed whitespace-pre">{`
  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
  │   React SPA  │────▶│  Supabase Edge   │────▶│   PostgreSQL    │
  │  (Vite/TS)   │     │   Functions       │     │   (Supabase)    │
  │              │     │                  │     │                 │
  │ - Product UI │     │ /buy-request     │     │ flash_sales     │
  │ - Cart       │◀───▶│ /process-order   │     │ products        │
  │ - Admin      │     │ /flash-sale-api  │     │ orders          │
  │ - Realtime   │     │ /admin-api       │     │ order_queue     │
  └─────────────┘     └──────────────────┘     └─────────────────┘
        │                      │                       │
        │    WebSocket         │  Atomic Decrement     │ RLS Policies
        │    (Realtime)        │  + Idempotency        │ Auth.uid() checks
        └──────────────────────┴───────────────────────┘
`}</pre>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Globe, title: 'Frontend', desc: 'React SPA with Vite, Tailwind CSS, Supabase JS client, WebSocket subscriptions for real-time stock updates' },
            { icon: Server, title: 'Edge Functions', desc: 'Deno-based serverless functions handling buy requests, order processing, and admin CRUD with JWT auth' },
            { icon: Database, title: 'PostgreSQL', desc: 'Supabase-hosted Postgres with atomic stock decrement, RLS policies, and real-time change feeds' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-zinc-900/30 border border-zinc-800/30 rounded-xl p-4">
              <Icon className="w-5 h-5 text-amber-500 mb-2" />
              <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Concurrency Control */}
      <Section id="concurrency" title="Concurrency Control" icon={Lock} expanded={expandedSection} onToggle={toggle}>
        <div className="space-y-4">
          <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-amber-400 mb-3">Atomic Stock Decrement (The Core Problem)</h4>
            <pre className="text-xs text-zinc-300 font-mono leading-relaxed">{`
-- Single atomic statement: check AND decrement in one operation
UPDATE products
SET stock = stock - :quantity,
    reserved_stock = reserved_stock + :quantity
WHERE id = :product_id
  AND flash_sale_id = :sale_id
  AND stock >= :quantity     -- Prevents overselling
  AND status = 'active'
RETURNING id, stock;         -- Confirm success`}</pre>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">Why This Works</h4>
              <ul className="text-xs text-zinc-400 space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">-</span> Single SQL statement = no race condition window</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">-</span> {"WHERE stock >= qty acts as an implicit lock"}</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">-</span> RETURNING clause confirms the update happened</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">-</span> PostgreSQL row-level locks during UPDATE</li>
              </ul>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-red-400 mb-2">What We Avoided</h4>
              <ul className="text-xs text-zinc-400 space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Read-then-write pattern (TOCTOU race)</li>
                <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Application-level locking (Redis SETNX)</li>
                <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Optimistic concurrency with version columns</li>
                <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Distributed lock managers (extra infra)</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* Why PostgreSQL over Redis */}
      <Section id="postgres-vs-redis" title="Why PostgreSQL Over Redis Locking" icon={Database} expanded={expandedSection} onToggle={toggle}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-500 font-medium">Factor</th>
                <th className="text-left py-3 px-4 text-amber-400 font-medium">PostgreSQL (Our Choice)</th>
                <th className="text-left py-3 px-4 text-zinc-500 font-medium">Redis Locking</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {[
                ['Consistency', 'ACID transactions, guaranteed consistency', 'Eventually consistent, lock release failures possible'],
                ['Infrastructure', 'Single DB (already required)', 'Additional Redis cluster to manage'],
                ['Atomicity', 'UPDATE WHERE stock >= qty is atomic', 'SETNX + Lua scripts, more moving parts'],
                ['Durability', 'Writes persist to WAL immediately', 'Memory-only, data loss on crash'],
                ['Complexity', 'One SQL statement', 'Lock acquisition, TTL, retry logic, deadlock handling'],
                ['Observability', 'Standard SQL monitoring', 'Custom metrics needed'],
                ['Cost', 'Zero additional (Supabase included)', 'Extra infrastructure cost'],
              ].map(([factor, pg, redis]) => (
                <tr key={factor} className="border-b border-zinc-800/30">
                  <td className="py-3 px-4 text-white font-medium">{factor}</td>
                  <td className="py-3 px-4 text-emerald-400">{pg}</td>
                  <td className="py-3 px-4 text-zinc-500">{redis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Order Processing Pipeline */}
      <Section id="pipeline" title="Order Processing Pipeline" icon={GitBranch} expanded={expandedSection} onToggle={toggle}>
        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-6 overflow-x-auto">
          <pre className="text-xs sm:text-sm text-zinc-300 font-mono leading-relaxed">{`
  User Click        Edge Function         PostgreSQL          Queue Worker
     │                   │                    │                    │
     │─── POST /buy ───▶│                    │                    │
     │                   │── Atomic Decrement─▶│                    │
     │                   │◀── RETURNING id ──│                    │
     │                   │── Insert Order ───▶│                    │
     │                   │◀── order_id ──────│                    │
     │◀── 202 order_id ─│                    │                    │
     │                   │                    │                    │
     │                   │         ┌── process-order (cron) ──────│
     │                   │         │        │── Verify stock ────▶│
     │                   │         │        │── Confirm order ───▶│
     │                   │         │        │── Release reserve ─▶│
     │                   │         │        │◀── confirmed ───────│
     │◀── Realtime update (order status change via WebSocket) ────│
`}</pre>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          {[
            { icon: Zap, title: 'Fast Path (< 200ms)', desc: 'Buy request returns immediately with order_id. Stock is reserved atomically. User gets instant feedback.' },
            { icon: RefreshCw, title: 'Async Processing', desc: 'Background worker confirms orders, handles payment simulation, and releases reserved stock on failure.' },
            { icon: Shield, title: 'Idempotency', desc: 'Each request includes a unique idempotency key. Duplicate requests return the same order without double-charging.' },
            { icon: Clock, title: 'Retry + DLQ', desc: 'Failed orders retry up to 3 times with exponential backoff. Permanent failures move to dead letter queue.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-zinc-900/30 border border-zinc-800/30 rounded-xl p-4">
              <Icon className="w-4 h-4 text-amber-500 mb-2" />
              <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Security Model */}
      <Section id="security" title="Security Model" icon={Shield} expanded={expandedSection} onToggle={toggle}>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { title: 'Row Level Security', desc: 'Every table has RLS enabled. Users can only SELECT/UPDATE their own data via auth.uid() checks. No USING(true) shortcuts.', color: 'emerald' },
            { title: 'JWT Authentication', desc: 'All buy endpoints require valid Supabase JWT. Edge functions verify tokens before processing. No anonymous purchases.', color: 'blue' },
            { title: 'Rate Limiting', desc: 'Max 5 buy requests per 30 seconds per user. Tracked via order timestamps. Exceeding limit returns 429 with retry-after header.', color: 'amber' },
            { title: 'Input Validation', desc: 'Server-side validation on all inputs: product_id format, quantity bounds (1-5), sale_id existence, idempotency key uniqueness.', color: 'orange' },
            { title: 'Idempotency Keys', desc: 'Every buy request requires a unique key. Prevents duplicate orders from network retries or double-clicks. Checked before stock decrement.', color: 'rose' },
            { title: 'Atomic Operations', desc: 'Stock decrement and order creation happen in controlled sequence. No partial states possible. Failed decrements never create orders.', color: 'cyan' },
          ].map(({ title, desc, color }) => (
            <div key={title} className={`bg-${color}-500/5 border border-${color}-500/20 rounded-xl p-4`}>
              <h4 className={`text-sm font-semibold text-${color}-400 mb-1`}>{title}</h4>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Trade-offs */}
      <Section id="tradeoffs" title="Trade-offs & Design Decisions" icon={BarChart3} expanded={expandedSection} onToggle={toggle}>
        <div className="space-y-4">
          {[
            {
              title: 'Reserved Stock vs. Direct Decrement',
              choice: 'Reserved Stock Pattern',
              reasoning: 'We increment reserved_stock and decrement stock atomically, then the async worker confirms or releases. This gives us a "soft hold" that prevents overselling while allowing recovery from failures. The alternative (direct decrement only) is simpler but makes it harder to handle payment failures gracefully.',
            },
            {
              title: 'Edge Functions vs. Direct DB Access',
              choice: 'Edge Functions as API Layer',
              reasoning: 'We use Supabase Edge Functions instead of direct client-side DB queries for buy operations. This adds latency (~50ms cold start) but provides: server-side validation, rate limiting, idempotency checks, and prevents exposing business logic to the client. The trade-off is worth it for security.',
            },
            {
              title: 'Polling vs. WebSocket for Stock Updates',
              choice: 'WebSocket (Supabase Realtime)',
              reasoning: 'We use Supabase Realtime (WebSocket) for stock updates instead of polling. This gives instant feedback when stock changes, critical for flash sales where items sell out in seconds. The trade-off is connection management complexity, but Supabase handles reconnection automatically.',
            },
            {
              title: 'Single Table vs. Queue Table for Orders',
              choice: 'Separate order_queue Table',
              reasoning: 'We use a separate queue table with status transitions (pending -> processing -> confirmed/failed) instead of a simple orders table. This enables: retry logic, dead letter queue, backpressure handling, and observability. The trade-off is query complexity, but the operational benefits are significant.',
            },
          ].map(({ title, choice, reasoning }) => (
            <div key={title} className="bg-zinc-900/30 border border-zinc-800/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white">{title}</h4>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{choice}</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{reasoning}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Tech Stack */}
      <Section id="tech" title="Technology Stack" icon={Cpu} expanded={expandedSection} onToggle={toggle}>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { name: 'React 18', purpose: 'UI framework with hooks, context, concurrent features' },
            { name: 'TypeScript', purpose: 'Type safety across frontend and edge functions' },
            { name: 'Vite', purpose: 'Fast dev server and optimized production builds' },
            { name: 'Tailwind CSS', purpose: 'Utility-first styling with custom design system' },
            { name: 'Supabase', purpose: 'PostgreSQL database, auth, realtime, edge functions' },
            { name: 'PostgreSQL', purpose: 'ACID-compliant RDBMS with atomic operations' },
            { name: 'Deno', purpose: 'Edge function runtime (Supabase Functions)' },
            { name: 'Recharts', purpose: 'Real-time data visualization for admin metrics' },
          ].map(({ name, purpose }) => (
            <div key={name} className="flex items-start gap-3 bg-zinc-900/30 border border-zinc-800/30 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{name}</div>
                <div className="text-xs text-zinc-500">{purpose}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ id, title, icon: Icon, expanded, onToggle, children }: {
  id: string; title: string; icon: typeof Layers; expanded: string | null; onToggle: (id: string) => void; children: React.ReactNode;
}) {
  const isOpen = expanded === id;
  return (
    <div className="mb-4">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:border-zinc-700/50 transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-amber-500" />
          <span className="text-base font-semibold text-white">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {isOpen && (
        <div className="mt-2 animate-slide-up">
          {children}
        </div>
      )}
    </div>
  );
}
