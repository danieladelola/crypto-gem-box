import { useQuery } from "@tanstack/react-query";

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
  total_volume: number;
}

const DEFAULT_IDS = ["bitcoin", "ethereum", "tether", "solana", "binancecoin", "ripple"];

export function useMarkets(ids?: string[], limit = 50) {
  return useQuery({
    queryKey: ["markets", ids?.join(",") ?? "top", limit],
    queryFn: async (): Promise<MarketCoin[]> => {
      const url = ids?.length
        ? `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}&order=market_cap_desc&per_page=${ids.length}&page=1&sparkline=false&price_change_percentage=24h`
        : `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load markets");
      return res.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export const SUPPORTED_GECKO_IDS = DEFAULT_IDS;

export const COIN_TO_GECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
};
