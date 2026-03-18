"use client"

import { useState, useCallback, useRef } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { polygon } from "viem/chains"
import { toast } from "sonner"
import {
  createEthersSigner,
  createRelayClient,
  deriveSafeAddress,
  isSafeDeployed,
  deploySafeWallet,
  setAllTokenApprovals,
} from "@/lib/polymarket/relayer"
import {
  getOrCreateApiCredentials,
  createTradingClient,
  placeOrder,
  type TradeParams,
} from "@/lib/polymarket/trading"
import {
  loadSession,
  saveSession,
  clearSession,
  type TradingSession,
} from "@/lib/polymarket/session"
import type { ClobClient } from "@polymarket/clob-client"

type SessionStep = "idle" | "checking" | "deploying" | "credentials" | "approvals" | "complete"

type TradingState = {
  isReady: boolean
  isInitializing: boolean
  isPlacingOrder: boolean
  error: string | null
  lastOrderId: string | null
  safeAddress: string | null
  currentStep: SessionStep
}

export function useTrading() {
  const { authenticated, user } = usePrivy()
  const { wallets } = useWallets()

  const [state, setState] = useState<TradingState>({
    isReady: false,
    isInitializing: false,
    isPlacingOrder: false,
    error: null,
    lastOrderId: null,
    safeAddress: null,
    currentStep: "idle",
  })

  const clientRef = useRef<ClobClient | null>(null)

  const initialize = useCallback(async () => {
    if (!authenticated || wallets.length === 0) {
      setState((s) => ({ ...s, error: "Please sign in first" }))
      return false
    }

    setState((s) => ({ ...s, isInitializing: true, error: null, currentStep: "checking" }))

    try {
      const userWalletAddress = user?.wallet?.address
      const wallet = userWalletAddress
        ? wallets.find((w) => w.address === userWalletAddress) ?? wallets[0]
        : wallets.find((w) => w.walletClientType === "privy") ?? wallets[0]
      if (!wallet) throw new Error("No wallet found")

      const eoaAddress = wallet.address as `0x${string}`
      await wallet.switchChain(polygon.id)

      const provider = await wallet.getEthereumProvider()
      const ethersSigner = createEthersSigner(provider)
      const safeAddress = deriveSafeAddress(eoaAddress)

      const existingSession = loadSession(eoaAddress)
      let session: TradingSession

      if (existingSession?.isSafeDeployed && existingSession?.hasApiCredentials && existingSession?.hasApprovals && existingSession?.apiCredentials) {
        session = existingSession
        toast.success("Trading session restored", { id: "trading-init" })
      } else {
        const relayClient = createRelayClient(ethersSigner)

        setState((s) => ({ ...s, currentStep: "checking" }))
        toast.loading("Checking Safe wallet...", { id: "trading-init" })
        const deployed = await isSafeDeployed(relayClient, safeAddress)

        if (!deployed) {
          setState((s) => ({ ...s, currentStep: "deploying" }))
          toast.loading("Deploying Safe wallet...", { id: "trading-init" })
          await deploySafeWallet(relayClient)
        }

        setState((s) => ({ ...s, currentStep: "credentials" }))
        toast.loading("Creating trading credentials...", { id: "trading-init" })
        const apiCreds = await getOrCreateApiCredentials(ethersSigner)

        setState((s) => ({ ...s, currentStep: "approvals" }))
        toast.loading("Setting token approvals...", { id: "trading-init" })
        await setAllTokenApprovals(relayClient)

        session = {
          eoaAddress,
          safeAddress,
          isSafeDeployed: true,
          hasApiCredentials: true,
          hasApprovals: true,
          apiCredentials: apiCreds,
          lastChecked: Date.now(),
        }
        saveSession(eoaAddress, session)
        toast.success("Trading ready!", { id: "trading-init" })
      }

      const client = createTradingClient(ethersSigner, session.apiCredentials!, safeAddress)
      clientRef.current = client

      setState((s) => ({
        ...s,
        isReady: true,
        isInitializing: false,
        safeAddress,
        currentStep: "complete",
      }))

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize trading"
      toast.error(message, { id: "trading-init" })
      setState((s) => ({ ...s, isInitializing: false, error: message, currentStep: "idle" }))
      return false
    }
  }, [authenticated, wallets, user])

  const trade = useCallback(
    async (params: TradeParams) => {
      setState((s) => ({ ...s, isPlacingOrder: true, error: null, lastOrderId: null }))

      try {
        if (!clientRef.current) {
          const ok = await initialize()
          if (!ok) {
            setState((s) => ({ ...s, isPlacingOrder: false }))
            return null
          }
        }

        const result = await placeOrder(clientRef.current!, params)

        setState((s) => ({
          ...s,
          isPlacingOrder: false,
          lastOrderId: result.orderID ?? null,
        }))

        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : "Order failed"
        setState((s) => ({ ...s, isPlacingOrder: false, error: message }))
        return null
      }
    },
    [initialize],
  )

  const endTradingSession = useCallback(() => {
    const addr = user?.wallet?.address
    if (addr) clearSession(addr)
    clientRef.current = null
    setState({
      isReady: false,
      isInitializing: false,
      isPlacingOrder: false,
      error: null,
      lastOrderId: null,
      safeAddress: null,
      currentStep: "idle",
    })
  }, [user?.wallet?.address])

  return {
    ...state,
    initialize,
    trade,
    endTradingSession,
    isAuthenticated: authenticated,
    walletAddress: user?.wallet?.address ?? null,
  }
}
