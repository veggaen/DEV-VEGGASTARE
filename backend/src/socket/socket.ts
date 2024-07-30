import { Server } from 'socket.io';

const setupSocketIO = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000', // Adjust this if your frontend is served from a different address
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });

    socket.on('message', (message) => {
      console.log('Message received:', message);
      io.emit('message', message);
    });
  });

  return io;
};

export default setupSocketIO;