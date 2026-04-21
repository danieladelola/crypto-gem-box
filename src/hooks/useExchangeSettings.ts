import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExchangeSettings {
  enabled: boolean;
  fee_pct: number;
  min_usd: number;
  max_usd: number;
}

const DEFAULT: ExchangeSettings = { enabled: true, fee_pct: 0.5, min_usd: 1, max_usd: 100000 };

export function useExchangeSettings() {
  return useQuery({
    queryKey: ["exchange-settings"],
    queryFn: async (): Promise<ExchangeSettings> => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "exchange")
        .maybeSingle();
      const v = (data?.value ?? {}) as Partial<ExchangeSettings>;
      return { ...DEFAULT, ...v };
    },
    staleTime: 30_000,
  });
}
