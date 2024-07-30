import { Socket } from 'socket.io';

const LOG_PREFIX = '[backend/src/utils/keepAlive.ts]';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export const setupKeepAlive = (socket: Socket) => {
  console.log(LOG_PREFIX, 'Setting up keep-alive for', socket.id);

  const sendHeartbeat = () => {
    console.log(LOG_PREFIX, 'Sending heartbeat to', socket.id);
    socket.emit('heartbeat', { message: 'keep-alive' });
  };

  const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

  socket.on('disconnect', (reason) => {
    clearInterval(heartbeatInterval);
    console.log(LOG_PREFIX, 'Cleared heartbeat for', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error(LOG_PREFIX, 'Error in keep-alive for', socket.id, ':', error);
  });
};