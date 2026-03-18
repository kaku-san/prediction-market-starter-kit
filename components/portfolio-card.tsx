"use client"

import { usePrivy, useFundWallet } from "@privy-io/react-auth"
import { HugeiconsIcon } from "@hugeicons/react"
import { Wallet01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useUsdcBalance } from "@/hooks/use-usdc-balance"
import { deriveSafeAddress } from "@/lib/polymarket/relayer"

export function PortfolioCard() {
  const { user } = usePrivy()
  const { fundWallet } = useFundWallet()
  const eoaAddr = user?.wallet?.address
  const safeAddr = eoaAddr ? deriveSafeAddress(eoaAddr) : undefined
  const { balance, loading } = useUsdcBalance(safeAddr)

  const formattedBalance = balance
    ? `$${Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "$0.00"

  return (
    <div className="rounded-2xl border overflow-hidden">
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Portfolio Value</div>
        <div className="text-3xl font-semibold mt-1">
          {loading ? <Spinner className="size-6" /> : formattedBalance}
        </div>
        <div className="text-xs text-muted-foreground mt-1">USDC.e on Polygon</div>

        <Button
          className="w-full h-11 mt-6"
          onClick={() => {
            if (eoaAddr) fundWallet({ address: eoaAddr })
          }}
          disabled={!eoaAddr}
        >
          <HugeiconsIcon icon={Wallet01Icon} className="size-4" />
          Deposit
        </Button>
      </div>
    </div>
  )
}
