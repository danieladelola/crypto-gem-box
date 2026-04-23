import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_COINS } from "@/lib/paymentCoins";

export type DepositAddressEntry = {
  address: string;
  enabled: boolean;
  network: string;
};

export type DepositAddressMap = Record<string, DepositAddressEntry>;

const DEFAULTS: DepositAddressMap = PAYMENT_COINS.reduce((m, c) => {
  m[c.symbol] = { address: "", enabled: true, network: c.defaultNetwork };
  return m;
}, {} as DepositAddressMap);

export function useDepositAddresses() {
  return useQuery({
    queryKey: ["deposit-addresses"],
    staleTime: 30_000,
    queryFn: async (): Promise<DepositAddressMap> => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "deposit_addresses")
        .maybeSingle();
      const v = (data?.value ?? {}) as Partial<DepositAddressMap>;
      // Merge with defaults so any missing coin still shows up.
      const merged: DepositAddressMap = { ...DEFAULTS };
      for (const sym of Object.keys(DEFAULTS)) {
        merged[sym] = { ...DEFAULTS[sym], ...(v[sym] ?? {}) };
      }
      return merged;
    },
  });
}
