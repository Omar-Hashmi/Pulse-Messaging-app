import 'dotenv/config';
import http from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { initSocket } from './sockets/index.js';

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
