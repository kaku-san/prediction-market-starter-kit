"use client"

import { usePrivy, useFundWallet } from "@privy-io/react-auth"
import { HugeiconsIcon } from "@hugeicons/react"
import { Wallet01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useUsdcBalance } from "@/hooks/use-usdc-balance"
import { useReadyTimeout } from "@/hooks/use-ready-timeout"
import { usePrivyConfig } from "@/components/privy-provider"
import { deriveSafeAddress } from "@/lib/polymarket/relayer"

export function PortfolioCard() {
  const { enabled } = usePrivyConfig()

  if (!enabled) {
    return <PortfolioCardPlaceholder message="Portfolio is unavailable until NEXT_PUBLIC_PRIVY_APP_ID is configured." />
  }

  return <PrivyPortfolioCard />
}

function PrivyPortfolioCard() {
  const { ready } = usePrivy()
  const timedOut = useReadyTimeout(ready)

  if (!ready) {
    return (
      <PortfolioCardPlaceholder
        message={
          timedOut
            ? "Privy did not initialize. Check NEXT_PUBLIC_PRIVY_APP_ID and the allowed origins for this local URL."
            : "Initializing wallet access..."
        }
        pending={!timedOut}
      />
    )
  }

  return <PortfolioCardReady />
}

function PortfolioCardReady() {
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

function PortfolioCardPlaceholder({ message, pending = false }: { message: string; pending?: boolean }) {
  return (
    <div className="rounded-2xl border overflow-hidden">
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Portfolio Value</div>
        <div className="text-3xl font-semibold mt-1">
          {pending ? <Spinner className="size-6" /> : "$0.00"}
        </div>
        <div className="text-xs text-muted-foreground mt-1">USDC.e on Polygon</div>
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>

        <Button className="w-full h-11 mt-6" disabled>
          <HugeiconsIcon icon={Wallet01Icon} className="size-4" />
          Deposit
        </Button>
      </div>
    </div>
  )
}
