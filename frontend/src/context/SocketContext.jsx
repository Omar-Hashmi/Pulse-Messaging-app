import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext.jsx';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [, forceRender] = useState(0); // re-render once socket is created

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');

    const socket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token }
    });
    socketRef.current = socket;
    forceRender((n) => n + 1);

    socket.on('presence:online-users', (ids) => setOnlineUsers(ids));

    return () => socket.disconnect();
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
