import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoinListItem, useCoinList } from "@/hooks/useCoinList";

export type AssetOption = {
  symbol: string;        // 'USD' or coin symbol upper-case
  name: string;
  image?: string;
  isFiat?: boolean;
  current_price?: number; // USD price (1 for USD)
  disabled?: boolean;
};

interface Props {
  value: string;
  onChange: (option: AssetOption) => void;
  includeFiat?: boolean;
  excludeSymbol?: string;
  placeholder?: string;
}

export function AssetSelector({ value, onChange, includeFiat = true, excludeSymbol, placeholder = "Select asset" }: Props) {
  const [open, setOpen] = useState(false);
  const { data: coins = [], isLoading } = useCoinList();

  const options: AssetOption[] = useMemo(() => {
    const opts: AssetOption[] = coins
      .filter((c) => !c.disabled)
      .map((c) => ({
        symbol: c.symbol,
        name: c.name,
        image: c.image,
        current_price: c.current_price,
      }));
    if (includeFiat) {
      opts.unshift({ symbol: "USD", name: "US Dollar", isFiat: true, current_price: 1 });
    }
    return opts.filter((o) => o.symbol !== excludeSymbol);
  }, [coins, includeFiat, excludeSymbol]);

  const selected = options.find((o) => o.symbol === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-12">
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.isFiat ? (
                <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <DollarSign className="h-3.5 w-3.5" />
                </span>
              ) : (
                <img src={selected.image} alt={selected.symbol} className="h-6 w-6 rounded-full" />
              )}
              <span className="font-medium">{selected.symbol}</span>
              <span className="text-xs text-muted-foreground truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover" align="start">
        <Command>
          <CommandInput placeholder="Search by name or symbol..." />
          <CommandList>
            <CommandEmpty>{isLoading ? "Loading…" : "No coin found."}</CommandEmpty>
            <CommandGroup>
              {options.slice(0, 200).map((o) => (
                <CommandItem
                  key={o.symbol}
                  value={`${o.symbol} ${o.name}`}
                  onSelect={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {o.isFiat ? (
                    <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mr-2">
                      <DollarSign className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <img src={o.image} alt={o.symbol} className="h-6 w-6 rounded-full mr-2" />
                  )}
                  <span className="font-medium mr-2">{o.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{o.name}</span>
                  {o.current_price && !o.isFiat && (
                    <span className="text-xs text-muted-foreground ml-2">${o.current_price.toLocaleString()}</span>
                  )}
                  <Check className={cn("ml-2 h-4 w-4", value === o.symbol ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
