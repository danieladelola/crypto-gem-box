import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Radio, Coins, TrendingUp, Users,
  Bell, UserCheck, FileText, Settings, LogOut, Sparkles, Menu, ChevronDown, ShieldCheck, ArrowLeftRight, Wallet, BadgeCheck
} from "lucide-react";

type Item = { to?: string; label: string; icon: any; end?: boolean; children?: { to: string; label: string }[] };

const items: Item[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { label: "Deposits", icon: ArrowDownToLine, children: [{ to: "/admin/deposits", label: "All Deposits" }] },
  { label: "Withdrawals", icon: ArrowUpFromLine, children: [
    { to: "/admin/withdrawals/pending", label: "Pending" },
    { to: "/admin/withdrawals/approved", label: "Approved" },
    { to: "/admin/withdrawals/rejected", label: "Rejected" },
    { to: "/admin/withdrawals/all", label: "All" },
  ]},
  { to: "/admin/exchange", label: "Exchange", icon: ArrowLeftRight },
  { to: "/admin/balances", label: "User Balances", icon: Wallet },
  { to: "/admin/kyc", label: "KYC Submissions", icon: BadgeCheck },
  { label: "Manage Signals", icon: Radio, children: [
    { to: "/admin/signals/add", label: "Add" },
    { to: "/admin/signals/user", label: "User Signals" },
  ]},
  { label: "Staking", icon: Coins, children: [
    { to: "/admin/staking/plans", label: "Plans" },
    { to: "/admin/staking/users", label: "User Staking" },
  ]},
  { label: "Manage Trades", icon: TrendingUp, children: [
    { to: "/admin/trades/open", label: "Open Trades" },
    { to: "/admin/trades/complete", label: "Complete Trades" },
  ]},
  { label: "Manage Users", icon: Users, children: [
    { to: "/admin/users/active", label: "Active" },
    { to: "/admin/users/banned", label: "Banned" },
    { to: "/admin/users/email-unverified", label: "Email Unverified" },
    { to: "/admin/users/kyc-pending", label: "KYC Pending" },
    { to: "/admin/users/with-balance", label: "With Balance" },
    { to: "/admin/users/all", label: "All Users" },
  ]},
  { to: "/admin/notifications", label: "Send Notification", icon: Bell },
  { to: "/admin/copy-experts", label: "Copy Experts", icon: UserCheck },
  { label: "Reports", icon: FileText, children: [
    { to: "/admin/reports/transactions", label: "Transactions" },
    { to: "/admin/reports/logins", label: "Logins" },
    { to: "/admin/reports/notifications", label: "Notifications" },
  ]},
  { to: "/admin/settings", label: "System Setting", icon: Settings },
];

export default function AdminLayout() {
  const { signOut, user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <>
      <Link to="/" className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
          <ShieldCheck className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <div className="font-bold text-lg text-sidebar-foreground leading-none">Vura</div>
          <div className="text-[10px] text-primary uppercase tracking-wider">Admin</div>
        </div>
      </Link>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((it) =>
          it.children ? (
            <Collapsible key={it.label} defaultOpen={false}>
              <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition group">
                <span className="flex items-center gap-3"><it.icon className="h-4 w-4" />{it.label}</span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-7 mt-1 space-y-0.5">
                {it.children.map((c) => (
                  <NavLink key={c.to} to={c.to} onClick={() => setOpen(false)}
                    className={({ isActive }) => cn(
                      "block px-3 py-2 rounded-md text-xs",
                      isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                    )}>{c.label}</NavLink>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <NavLink key={it.to} to={it.to!} end={it.end} onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground border border-primary/30"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
              <it.icon className="h-4 w-4" />{it.label}
            </NavLink>
          )
        )}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/70 truncate mb-2">{user?.email}</div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground"
          onClick={async () => { await signOut(); nav("/"); }}>
          <LogOut className="h-4 w-4 mr-2" />Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-72 bg-sidebar border-r border-sidebar-border flex-col fixed inset-y-0 z-30">
        <SidebarContent />
      </aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur" />
          <aside className="relative w-72 bg-sidebar border-r border-sidebar-border flex flex-col" onClick={(e) => e.stopPropagation()}>
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 lg:ml-72">
        <header className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-background sticky top-0 z-20">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
          <div className="flex items-center gap-2"><div className="h-7 w-7 rounded-md bg-gradient-primary" /><span className="font-bold">Vura Admin</span></div>
          <div className="w-9" />
        </header>
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in"><Outlet /></main>
      </div>
    </div>
  );
}
