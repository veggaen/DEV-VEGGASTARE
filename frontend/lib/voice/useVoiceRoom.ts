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

/** Factory — the ONE place that decides which backend powers voice. */
function createVoiceProvider(cfg: VoiceProviderConfig): VoiceProvider {
  // When LiveKit env keys exist, return new LiveKitVoiceProvider(cfg) here.
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

  return {
    ...state,
    self,
    raisedHands,
    isStub: provider.isStub,
    join,
    leave,
    toggleMute,
    toggleHand,
    promote: provider.promote.bind(provider),
    demote: provider.demote.bind(provider),
    muteMember: provider.muteMember.bind(provider),
    removeMember: provider.removeMember.bind(provider),
  };
}
