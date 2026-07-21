// Small shared holder for the Socket.IO server instance so that REST
// controllers (which don't have direct access to the socket layer) can
// still emit realtime events, e.g. notification:new for friend requests.
let ioInstance = null;

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => ioInstance;
