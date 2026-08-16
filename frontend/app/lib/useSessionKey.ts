"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "../components/WalletProvider";
import { advanceSessionNonce, clearSession, createSession, loadSession, type Session } from "./sessionKey";

export function useSessionKey() {
  const { address, signTypedData } = useWallet();
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadSession(address));
  }, [address]);

  const startSession = useCallback(async () => {
    if (!address) return null;
    setStarting(true);
    setError(null);
    try {
      const s = await createSession(address as `0x${string}`, signTypedData);
      setSession(s);
      return s;
    } catch {
      setError("Session authorization rejected.");
      return null;
    } finally {
      setStarting(false);
    }
  }, [address, signTypedData]);

  const endSession = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const bumpNonce = useCallback(() => {
    setSession((prev) => (prev ? advanceSessionNonce(prev) : prev));
  }, []);

  return { session, starting, error, startSession, endSession, bumpNonce };
}
