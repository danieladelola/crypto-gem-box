import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoinListItem {
  id: string;          // coingecko id
  symbol: string;      // upper-case
  name: string;
  image: string;
  current_price: number;
  market_cap_rank: number | null;
  disabled?: boolean;  // disabled by admin
}

/**
 * Fetches top ~250 coins from CoinGecko and merges with admin-controlled
 * market_assets table (so admin can disable specific symbols).
 */
export function useCoinList() {
  return useQuery({
    queryKey: ["coin-list"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<CoinListItem[]> => {
      const [marketsRes, assetsRes] = await Promise.all([
        fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false"
        ),
        supabase.from("market_assets").select("symbol,active"),
      ]);
      if (!marketsRes.ok) throw new Error("Failed to load coins");
      const coins = await marketsRes.json();
      const disabledSet = new Set(
        (assetsRes.data ?? []).filter((a: any) => !a.active).map((a: any) => a.symbol.toUpperCase())
      );
      return coins.map((c: any) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        image: c.image,
        current_price: c.current_price,
        market_cap_rank: c.market_cap_rank,
        disabled: disabledSet.has(c.symbol.toUpperCase()),
      }));
    },
  });
}
