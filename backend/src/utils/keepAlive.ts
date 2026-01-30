import { Socket } from 'socket.io';

export const setupKeepAlive = (socket: Socket): void => {
  setInterval(() => {
    socket.emit('keep-alive');
  }, 5000); // Send keep-alive message every 5 seconds
};