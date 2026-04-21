import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogOut, Settings as SettingsIcon, User as UserIcon, Bell, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ROUTE_TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/deposit": "Deposit",
  "/app/withdraw": "Withdraw",
  "/app/wallet": "Wallet",
  "/app/markets": "Markets",
  "/app/stake": "Stake",
  "/app/exchange": "Exchange",
  "/app/profile": "Profile",
  "/app/settings": "Settings",
};

export function UserHeader({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();

  const title = ROUTE_TITLES[loc.pathname] ?? "Dashboard";
  const name = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = name.split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notif-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="h-full px-4 md:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onOpenSidebar && (
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div>
            <div className="text-xs text-muted-foreground hidden sm:block">Vura · {title}</div>
            <h1 className="text-base md:text-lg font-semibold leading-tight">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="ghost" size="icon" className="relative" onClick={() => nav("/app")}>
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-accent transition">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium leading-tight">{name}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight truncate max-w-[160px]">{user?.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <DropdownMenuLabel>
                <div className="font-medium truncate">{name}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/profile" className="cursor-pointer">
                  <UserIcon className="h-4 w-4 mr-2" />View Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/settings" className="cursor-pointer">
                  <SettingsIcon className="h-4 w-4 mr-2" />Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  qc.clear();
                  nav("/");
                }}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
