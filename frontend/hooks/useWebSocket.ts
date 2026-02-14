import { useEffect } from 'react';
import { io } from 'socket.io-client';

const LOG_PREFIX = '[frontend/hooks/useWebSocket.ts]';
const IS_DEV = process.env.NODE_ENV !== 'production';

export const useWebSocket = <T = unknown>(onMessage: (data: T) => void): void => {
  useEffect(() => {
    const wsUrl = process.env.NODE_ENV === 'production'
      ? 'https://dev-veggastare.vercel.app'
      : 'http://localhost:3002';
    
    if (IS_DEV) console.log(LOG_PREFIX, 'Connecting to WebSocket server:', wsUrl);
    const socket = io(wsUrl, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      if (IS_DEV) console.log(LOG_PREFIX, '[WebSocket] Connection opened', socket.id);
    });

    socket.on('disconnect', (reason) => {
      if (IS_DEV) console.log(LOG_PREFIX, '[WebSocket] Connection closed:', reason, socket.id);
    });

    socket.on('WAREHOUSES_UPDATE', (data) => {
      if (IS_DEV) console.log(LOG_PREFIX, '[WebSocket] Message received:', data);
      onMessage(data);
    });

    socket.on('connect_error', (error) => {
      console.error(LOG_PREFIX, '[WebSocket] Connection error:', error);
    });

    socket.on('error', (error) => {
      console.error(LOG_PREFIX, '[WebSocket] Error:', error);
    });

    return () => {
      if (IS_DEV) console.log(LOG_PREFIX, 'Closing WebSocket connection', socket.id);
      socket.disconnect();
    };
  }, [onMessage]);
};// worked