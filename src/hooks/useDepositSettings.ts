import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DepositSettings {
  enabled: boolean;
  fee_pct: number;
  min_usd: number;
  max_usd: number;
}

const DEFAULT: DepositSettings = { enabled: true, fee_pct: 0, min_usd: 10, max_usd: 100000 };

export function useDepositSettings() {
  return useQuery({
    queryKey: ["deposit-settings"],
    queryFn: async (): Promise<DepositSettings> => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "deposit")
        .maybeSingle();
      const v = (data?.value ?? {}) as Partial<DepositSettings>;
      return { ...DEFAULT, ...v };
    },
    staleTime: 30_000,
  });
}
