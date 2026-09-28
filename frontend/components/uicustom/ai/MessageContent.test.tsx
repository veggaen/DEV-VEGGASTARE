// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { MessageContent } from './MessageContent';
it('renders structured text without raw HTML, unsafe links or automatic remote images', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(<MessageContent content={'## Result\n\n**Clear** text.\n\n```js\nconst value = 42;\n```\n\n| Key | Value |\n| --- | --- |\n| a | b |\n\n[bad](javascript:alert(1))\n\n![External](https://example.com/tracker.png)\n\n<script>alert(1)</script>'} />));
    expect(host.querySelector('h3')?.textContent).toBe('Result'); expect(host.querySelector('strong')?.textContent).toBe('Clear');
    expect(host.querySelector('pre')?.textContent).toContain('const value'); expect(host.querySelector('table')).not.toBeNull();
    expect(host.querySelectorAll('script,img')).toHaveLength(0); expect(host.querySelector('[href^="javascript:"]')).toBeNull();
    expect(host.querySelector('[href="https://example.com/tracker.png"]')?.getAttribute('rel')).toContain('noreferrer');
  } finally { await act(async () => root.unmount()); }
});
