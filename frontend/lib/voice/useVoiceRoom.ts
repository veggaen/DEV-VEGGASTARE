"use client";

/**
 * @fileOverview useVoiceRoom — binds a component to a VoiceProvider, exposing
 *   reactive room state + action callbacks. Today it instantiates the stub;
 *   when LiveKit lands, swap the factory and every consumer keeps working.
 * @stability experimental
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VoiceProvider, VoiceProviderConfig, VoiceRoomState } from "./types";
import { StubVoiceProvider } from "./stub-provider";
import { LiveKitVoiceProvider } from "./livekit-provider";

/**
 * Factory — the ONE place that decides which backend powers voice. When the
 * public LiveKit URL is configured (keys present), real cross-user audio is used;
 * otherwise we fall back to the fully-working local stub so the UI never breaks.
 */
function createVoiceProvider(cfg: VoiceProviderConfig): VoiceProvider {
  if (process.env.NEXT_PUBLIC_LIVEKIT_URL) {
    return new LiveKitVoiceProvider(cfg);
  }
  return new StubVoiceProvider(cfg);
}

const INITIAL: VoiceRoomState = {
  connection: "disconnected",
  members: [],
  selfId: null,
  error: null,
};

export function useVoiceRoom(cfg: VoiceProviderConfig) {
  const providerRef = useRef<VoiceProvider | null>(null);
  if (!providerRef.current) providerRef.current = createVoiceProvider(cfg);
  const provider = providerRef.current;

  const [state, setState] = useState<VoiceRoomState>(INITIAL);

  useEffect(() => {
    const unsub = provider.subscribe(setState);
    return () => {
      unsub();
      void provider.leave();
    };
    // provider is stable for the component's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const self = useMemo(
    () => state.members.find((m) => m.id === state.selfId) ?? null,
    [state.members, state.selfId],
  );
  const raisedHands = useMemo(
    () =>
      state.members
        .filter((m) => m.handRaised)
        .sort((a, b) => (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0)),
    [state.members],
  );

  const join = useCallback(() => provider.join(), [provider]);
  const leave = useCallback(() => provider.leave(), [provider]);
  const toggleMute = useCallback(() => {
    const me = provider.getState().members.find((m) => m.id === provider.getState().selfId);
    provider.setMuted(!me?.muted);
  }, [provider]);
  const toggleHand = useCallback(() => {
    const me = provider.getState().members.find((m) => m.id === provider.getState().selfId);
    provider.raiseHand(!me?.handRaised);
  }, [provider]);

  // Host actions: the REST endpoints are authoritative (they persist the role and
  // enforce it on the SFU + broadcast over Pusher). The provider call is an
  // optimistic local echo — and the ONLY path the stub needs in demo mode.
  const roomId = cfg.roomId;
  const hostAction = useCallback(
    async (memberId: string, body: Record<string, unknown>, method: "PATCH" | "DELETE") => {
      if (!provider.isStub) {
        try {
          await fetch(`/api/voice/${encodeURIComponent(roomId)}/members/${encodeURIComponent(memberId)}`, {
            method,
            headers: { "Content-Type": "application/json" },
            body: method === "DELETE" ? undefined : JSON.stringify(body),
          });
        } catch {
          /* Pusher/refetch will reconcile; optimistic echo below keeps UI snappy. */
        }
      }
    },
    [provider, roomId],
  );

  const promote = useCallback((id: string) => {
    provider.promote(id);
    void hostAction(id, { action: "promote" }, "PATCH");
  }, [provider, hostAction]);
  const demote = useCallback((id: string) => {
    provider.demote(id);
    void hostAction(id, { action: "demote" }, "PATCH");
  }, [provider, hostAction]);
  const makeModerator = useCallback((id: string) => {
    void hostAction(id, { action: "makeModerator" }, "PATCH");
  }, [hostAction]);
  const muteMember = useCallback((id: string, muted = true) => {
    provider.muteMember(id);
    void hostAction(id, { action: "mute", muted }, "PATCH");
  }, [provider, hostAction]);
  const removeMember = useCallback((id: string) => {
    provider.removeMember(id);
    void hostAction(id, {}, "DELETE");
  }, [provider, hostAction]);

  return {
    ...state,
    self,
    raisedHands,
    isStub: provider.isStub,
    join,
    leave,
    toggleMute,
    toggleHand,
    promote,
    demote,
    makeModerator,
    muteMember,
    removeMember,
    applyServerEvent: provider.applyServerEvent.bind(provider),
  };
}
