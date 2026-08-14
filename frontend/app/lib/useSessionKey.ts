"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "../components/WalletProvider";
import { clearSession, createSession, loadSession, type Session } from "./sessionKey";

export function useSessionKey() {
  const { address, signMessage } = useWallet();
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
      const s = await createSession(address, signMessage);
      setSession(s);
      return s;
    } catch {
      setError("Session authorization rejected.");
      return null;
    } finally {
      setStarting(false);
    }
  }, [address, signMessage]);

  const endSession = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  return { session, starting, error, startSession, endSession };
}
