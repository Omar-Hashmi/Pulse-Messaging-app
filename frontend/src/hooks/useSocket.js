import { useContext } from 'react';
import { SocketContext } from '../context/SocketContext.jsx';

export const useSocket = () => useContext(SocketContext);
