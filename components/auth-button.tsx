"use client"

import Link from "next/link"
import { usePrivy } from "@privy-io/react-auth"
import { HugeiconsIcon } from "@hugeicons/react"
import { Login01Icon, Logout01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Avatar from "boring-avatars"
import { useUsdcBalance } from "@/hooks/use-usdc-balance"
import { deriveSafeAddress } from "@/lib/polymarket/relayer"

function UserAvatar({ seed }: { seed: string }) {
  return (
    <div className="size-7 shrink-0">
      <Avatar name={seed} variant="beam" size={28} />
    </div>
  )
}

export function AuthButton() {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const walletAddr = user?.wallet?.address
  const safeAddress = walletAddr ? deriveSafeAddress(walletAddr) : undefined
  const { balance, loading: balanceLoading } = useUsdcBalance(safeAddress)

  if (!ready) {
    return (
      <Button size="sm" disabled>
        <Spinner />
      </Button>
    )
  }

  if (authenticated && user) {
    const displayName =
      user.email?.address ??
      (walletAddr ? walletAddr.slice(0, 6) + "..." + walletAddr.slice(-4) : null) ??
      "Account"

    const formattedBalance = balance
      ? `$${Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "$0.00"

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm mr-1">
          <span className="text-xs text-muted-foreground">Portfolio:</span>
          <span className="font-medium">
            {balanceLoading ? <Spinner className="size-3" /> : formattedBalance}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <UserAvatar seed={walletAddr ?? displayName} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">{formattedBalance}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/portfolio" className="cursor-pointer">
                Portfolio
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
              <HugeiconsIcon icon={Logout01Icon} className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <Button size="sm" onClick={login}>
      <HugeiconsIcon icon={Login01Icon} className="size-4" />
      Sign In
    </Button>
  )
}
