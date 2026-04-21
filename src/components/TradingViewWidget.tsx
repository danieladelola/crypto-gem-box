import { useEffect, useRef, memo } from "react";

function TradingViewWidget({ symbol = "BINANCE:BTCUSDT", height = 500 }: { symbol?: string; height?: number }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      withdateranges: true,
      allow_symbol_change: true,
      support_host: "https://www.tradingview.com",
    });
    container.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="tradingview-widget-container w-full overflow-hidden rounded-lg border border-border" style={{ height }}>
      <div ref={container} className="tradingview-widget-container__widget h-full w-full" />
    </div>
  );
}

export default memo(TradingViewWidget);
