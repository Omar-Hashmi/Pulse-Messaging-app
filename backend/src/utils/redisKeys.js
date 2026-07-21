// Centralized Redis key names so the whole app agrees on naming
export const ONLINE_USERS_KEY = 'online_users';       // Set of userIds currently online
export const USER_SOCKETS_KEY = 'user_sockets';       // Hash: userId -> number of open sockets (handles multi-tab/device)
