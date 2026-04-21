import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Balance {
  id: string;
  coin: string;
  available: number;
  staked: number;
}

export function useBalances() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["balances", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Balance[]> => {
      const { data, error } = await supabase
        .from("wallet_balances")
        .select("id,coin,available,staked")
        .order("coin");
      if (error) throw error;
      return (data ?? []).map((b: any) => ({
        ...b,
        available: Number(b.available),
        staked: Number(b.staked),
      }));
    },
  });
}
