/** @fileOverview Preferences must not hide children during server rendering. @stability stable */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ActiveNetworkProvider, useActiveNetwork } from '@/components/crypto-related/ActiveNetworkContext';
import { ActiveWalletProvider, useActiveWalletOverride } from '@/contexts/active-wallet-context';
import { TradeModeProvider, useTradeMode } from '@/contexts/trade-mode-context';

it('renders page content before network preferences have hydrated', () => {
  function Probe() {
    const { active, isHydrated } = useActiveNetwork();
    return React.createElement('p', null, `Marketplace:${active.kind}:${isHydrated}`);
  }
  expect(renderToString(React.createElement(ActiveNetworkProvider, null, React.createElement(Probe))))
    .toContain('Marketplace:evm:false');
});
it('renders neutral wallet state without reading browser storage on the server', () => {
  function Probe() {
    const { override } = useActiveWalletOverride();
    return React.createElement('p', null, override ? 'Restored wallet' : 'No override');
  }
  expect(renderToString(React.createElement(ActiveWalletProvider, null, React.createElement(Probe))))
    .toContain('No override');
});
it('keeps a deterministic trade preference for initial server markup', () => {
  function Probe() { return React.createElement('p', null, useTradeMode().mode); }
  expect(renderToString(React.createElement(TradeModeProvider, null, React.createElement(Probe))))
    .toContain('p2p');
});
