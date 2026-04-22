import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Balance {
  id: string;
  coin: string;
  available: number;
  staked: number;
}

/**
 * Returns wallet balances. By default only rows with non-zero available or staked
 * are returned (the signup trigger seeds rows for every active asset, which makes
 * the wallet UI noisy otherwise). Pass `includeZero: true` for the full list.
 */
export function useBalances(opts: { includeZero?: boolean } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["balances", user?.id, !!opts.includeZero],
    enabled: !!user,
    queryFn: async (): Promise<Balance[]> => {
      const { data, error } = await supabase
        .from("wallet_balances")
        .select("id,coin,available,staked")
        .order("coin");
      if (error) throw error;
      const rows = (data ?? []).map((b: any) => ({
        ...b,
        available: Number(b.available),
        staked: Number(b.staked),
      }));
      return opts.includeZero ? rows : rows.filter((b) => b.available > 0 || b.staked > 0);
    },
  });
}
