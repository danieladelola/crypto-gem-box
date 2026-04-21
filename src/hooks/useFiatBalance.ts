import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useFiatBalance(currency = "USD") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fiat-balance", user?.id, currency],
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      const { data } = await supabase
        .from("fiat_balances")
        .select("available")
        .eq("currency", currency)
        .maybeSingle();
      return Number(data?.available ?? 0);
    },
  });
}
