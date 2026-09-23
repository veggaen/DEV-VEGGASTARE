/**
 * @fileOverview Fail-closed boundary for the retired warehouse socket prototype.
 * @stability experimental-disabled
 */
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

export const initWebSocketServer = (server: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(server, {
    serveClient: false,
    maxHttpBufferSize: 4096,
    // There is no scoped session/ticket protocol for this legacy transport.
    // Even same-origin requests must never query DB or receive inventory DTOs.
    allowRequest: (_request, callback) => callback('Legacy realtime is unavailable.', false),
  });
  io.use((_socket, next) => next(new Error('Legacy realtime is unavailable.')));
  return io;
};
