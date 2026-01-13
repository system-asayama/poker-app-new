import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketClient {
  private socket: Socket | null = null;
  
  connect() {
    if (this.socket?.connected) return this.socket;
    
    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    return this.socket;
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  joinGame(gameId: number) {
    this.socket?.emit('join-game', gameId);
  }
  
  leaveGame(gameId: number) {
    this.socket?.emit('leave-game', gameId);
  }
  
  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }
  
  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }
  
  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }
  
  getSocket() {
    return this.socket;
  }
}

export const socketClient = new SocketClient();
