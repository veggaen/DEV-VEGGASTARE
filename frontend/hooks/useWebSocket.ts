'use client';

import { useEffect, useRef } from 'react';
const LOG_PREFIX = '[frontend/hooks/useWebSocket.ts]';

export const useWebSocket = (onMessage: (data: any) => void) => {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    ws.current = new WebSocket(wsUrl !!);

    ws.current.onopen = () => {
      console.log(LOG_PREFIX, '[WebSocket] Connection opened');
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(LOG_PREFIX, '[WebSocket] Message received:', data);
      onMessage(data);
    };

    ws.current.onclose = () => {
      console.log(LOG_PREFIX, '[WebSocket] Connection closed');
    };

    ws.current.onerror = (error) => {
      console.error(LOG_PREFIX, '[WebSocket] Error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [onMessage]);

  return ws.current;
};