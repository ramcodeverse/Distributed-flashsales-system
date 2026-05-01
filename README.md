# FlashDeal - Lightning Flash Sales

A modern e-commerce platform for running time-limited flash sales with real-time inventory management, admin dashboard, and seamless checkout experience.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178c6?style=flat&logo=typescript)
![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat&logo=react)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat&logo=vite)

## ✨ Features

### For Customers
- 🔥 **Flash Sales** - Browse and participate in time-limited deals
- 🛒 **Shopping Cart** - Add products and manage quantities
- 👤 **Authentication** - Secure sign-in/sign-up flow
- 📦 **Order Tracking** - View order history and status

### For Administrators
- 📊 **Dashboard** - Real-time sales analytics and metrics
- ⚡ **Sale Management** - Create and manage flash sales
- 📋 **Order Processing** - Process and fulfill customer orders
- 💰 **Inventory Control** - Real-time stock tracking

### System Features
- 🎨 **Modern UI** - Beautiful dark theme with Tailwind CSS
- 📱 **Responsive** - Works on desktop and mobile
- 🔔 **Toast Notifications** - Instant feedback on actions
- ⚛️ **Error Handling** - Graceful error boundaries
- 🔄 **Real-time Updates** - Live data synchronization

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at http://localhost:5173

### Building for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── AdminDashboard.tsx
│   ├── AuthForm.tsx
│   ├── CartDrawer.tsx
│   ├── ErrorBoundary.tsx
│   ├── Header.tsx
│   ├── OrderList.tsx
│   ├── ProductGrid.tsx
│   ├── SaleList.tsx
│   ├── Skeleton.tsx
│   └── SystemDesign.tsx
├── lib/                 # Core utilities
│   ├── api.ts           # API client
│   ├── supabase.ts     # Supabase config
│   ├── types.ts         # TypeScript types
│   ├── useAuth.tsx     # Authentication
│   ├── useCart.tsx     # Cart management
│   └── useToast.tsx    # Toast notifications
└── main.tsx            # Entry point
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Backend**: Supabase (PostgreSQL, Auth, Storage)

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check |

## 🔐 Security

- All dependencies audited and up-to-date
- No vulnerable packages in production
- Secure authentication flow
- SQL injection protected via Supabase

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using React, TypeScript, and Vite
