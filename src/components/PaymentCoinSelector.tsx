import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePaymentCoinPrices, PaymentCoinPrice } from "@/hooks/usePaymentCoinPrices";
import { useDepositAddresses } from "@/hooks/useDepositAddresses";

interface Props {
  value: string;
  onChange: (coin: PaymentCoinPrice) => void;
  /** When true (deposit flow), hide coins admin marked disabled. */
  respectDisabled?: boolean;
}

/**
 * Selector restricted to the 7 supported payment coins (BTC, ETH, USDT, USDC, SOL, TRX, XRP).
 * Used in Deposit + Withdraw — these are payment methods, not user balances.
 */
export function PaymentCoinSelector({ value, onChange, respectDisabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const { data: coins = [], isLoading } = usePaymentCoinPrices();
  const { data: addresses } = useDepositAddresses();

  const visible = respectDisabled
    ? coins.filter((c) => addresses?.[c.symbol]?.enabled !== false)
    : coins;

  const selected = visible.find((c) => c.symbol === value) ?? coins.find((c) => c.symbol === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-12">
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              {selected.image && <img src={selected.image} alt={selected.symbol} className="h-6 w-6 rounded-full flex-shrink-0" />}
              <span className="font-medium">{selected.symbol}</span>
              <span className="text-xs text-muted-foreground truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{isLoading ? "Loading…" : "Select payment coin"}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-[60]"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Search payment coin..." />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>{isLoading ? "Loading…" : "No coin found."}</CommandEmpty>
            <CommandGroup>
              {visible.map((c) => (
                <CommandItem
                  key={c.symbol}
                  value={`${c.symbol} ${c.name}`}
                  onSelect={() => { onChange(c); setOpen(false); }}
                  className="cursor-pointer"
                >
                  {c.image && <img src={c.image} alt={c.symbol} className="h-6 w-6 rounded-full mr-2" />}
                  <span className="font-medium mr-2">{c.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{c.name}</span>
                  {c.current_price > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">${c.current_price.toLocaleString()}</span>
                  )}
                  <Check className={cn("ml-2 h-4 w-4", value === c.symbol ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
