import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

import UserLayout from "./layouts/UserLayout";
import Dashboard from "./pages/user/Dashboard";
import Deposit from "./pages/user/Deposit";
import Withdraw from "./pages/user/Withdraw";
import WalletPage from "./pages/user/WalletPage";
import Markets from "./pages/user/Markets";
import Stake from "./pages/user/Stake";
import Settings from "./pages/user/Settings";

import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDeposits from "./pages/admin/AdminDeposits";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/login" element={<Login admin />} />

            <Route path="/app" element={<RequireAuth><UserLayout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="deposit" element={<Deposit />} />
              <Route path="withdraw" element={<Withdraw />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="markets" element={<Markets />} />
              <Route path="stake" element={<Stake />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/admin" element={<RequireAuth adminOnly><AdminLayout /></RequireAuth>}>
              <Route index element={<AdminDashboard />} />
              <Route path="deposits" element={<AdminDeposits />} />
              <Route path="withdrawals" element={<Navigate to="/admin/withdrawals/all" replace />} />
              <Route path="withdrawals/:status" element={<AdminWithdrawals />} />
              <Route path="users" element={<Navigate to="/admin/users/all" replace />} />
              <Route path="users/:filter" element={<AdminUsers />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="signals/add" element={<AdminPlaceholder title="Add Signal" description="Create and broadcast trade signals." />} />
              <Route path="signals/user" element={<AdminPlaceholder title="User Signals" description="Track signals delivered to users." />} />
              <Route path="staking/plans" element={<AdminPlaceholder title="Staking Plans" description="Create and manage staking plans." />} />
              <Route path="staking/users" element={<AdminPlaceholder title="User Staking" description="View all user stakes." />} />
              <Route path="trades/open" element={<AdminPlaceholder title="Open Trades" description="Active trade records." />} />
              <Route path="trades/complete" element={<AdminPlaceholder title="Complete Trades" description="Closed trade records." />} />
              <Route path="copy-experts" element={<AdminPlaceholder title="Copy Experts" description="Manage expert traders." />} />
              <Route path="reports/transactions" element={<AdminPlaceholder title="Transaction History" description="All platform transactions." />} />
              <Route path="reports/logins" element={<AdminPlaceholder title="Login History" description="User login activity." />} />
              <Route path="reports/notifications" element={<AdminPlaceholder title="Notification History" description="All sent notifications." />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
