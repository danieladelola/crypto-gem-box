import { useQuery } from "@tanstack/react-query";
import { PAYMENT_COINS } from "@/lib/paymentCoins";

export type PaymentCoinPrice = {
  symbol: string;
  name: string;
  image: string;
  current_price: number; // USD per 1 unit
};

/**
 * Lightweight CoinGecko fetch for ONLY the supported payment coins.
 * Used by the Deposit / Withdraw selectors so we don't load 250 markets
 * just to render 7 options.
 */
export function usePaymentCoinPrices() {
  return useQuery({
    queryKey: ["payment-coin-prices"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<PaymentCoinPrice[]> => {
      const ids = PAYMENT_COINS.map((c) => c.coingecko_id).join(",");
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load payment coin prices");
      const list = await res.json();
      // Re-order to match PAYMENT_COINS order
      const bySym: Record<string, any> = {};
      list.forEach((c: any) => { bySym[c.symbol.toUpperCase()] = c; });
      return PAYMENT_COINS.map((p) => {
        const c = bySym[p.symbol];
        return {
          symbol: p.symbol,
          name: p.name,
          image: c?.image ?? "",
          current_price: c?.current_price ?? (p.symbol === "USDT" || p.symbol === "USDC" ? 1 : 0),
        };
      });
    },
  });
}
