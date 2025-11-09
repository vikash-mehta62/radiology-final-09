/**
 * WebSocketContext
 * Provides WebSocket connection management for real-time features
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  reconnecting: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  autoConnect = true 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_DELAY = 3000;

  // Detect backend configuration from environment
  const hasBackend = !!(import.meta.env.VITE_API_URL || (import.meta as any).env?.VITE_BACKEND_URL);

  // Check if backend is reachable before attempting WebSocket connection
  const isBackendReachable = useCallback(async (wsUrl: string): Promise<boolean> => {
    try {
      const resp = await fetch(wsUrl, { method: 'HEAD', mode: 'cors' });
      return resp.ok;
    } catch (e) {
      return false;
    }
  }, []);

  /**
   * Get authentication token from storage
   */
  const getAuthToken = useCallback((): string | null => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    // Basic sanity check: ensure token looks like a JWT (header.payload.signature)
    if (!token || token.split('.').length !== 3) {
      return null;
    }
    return token;
  }, []);

  /**
   * Get WebSocket URL from environment
   */
  const getWebSocketUrl = useCallback((): string => {
    // Check if we have a specific WebSocket URL in environment
    const wsUrl = import.meta.env.VITE_WS_URL;
    if (wsUrl) {
      return wsUrl;
    }

    // Construct WebSocket URL from API URL or current location
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) {
      // Remove /api suffix if present
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      return baseUrl;
    }

    // Fallback to current location
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (socketRef.current?.connected) {
      console.log('WebSocket already connected');
      return;
    }
    (async () => {
      try {
        const wsUrl = getWebSocketUrl();
        const token = getAuthToken();

        if (!hasBackend) {
          console.warn('Skipping WebSocket connect: backend URL not configured');
          setError('Backend not configured');
          setIsConnected(false);
          setReconnecting(false);
          return;
        }

        // Guard: do not attempt connection without a token
        if (!token) {
          console.warn('Skipping WebSocket connect: no auth token available');
          setError('Not authenticated: missing token');
          setIsConnected(false);
          setReconnecting(false);
          return;
        }

        const reachable = await isBackendReachable(wsUrl);
        if (!reachable) {
          console.warn('Skipping WebSocket connect: backend unreachable');
          setError('Backend unreachable');
          setIsConnected(false);
          setReconnecting(false);
          return;
        }

        console.log('Connecting to WebSocket:', wsUrl);

        // Create socket connection
        const newSocket = io(wsUrl, {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          auth: {
            token,
          },
          reconnection: true,
          reconnectionDelay: RECONNECT_DELAY,
          reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
          timeout: 10000,
        });

        // Connection event handlers
        newSocket.on('connect', () => {
          console.log('WebSocket connected:', newSocket.id);
          setIsConnected(true);
          setError(null);
          setReconnecting(false);
          reconnectAttemptsRef.current = 0;
        });

        newSocket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          setIsConnected(false);
          
          // Handle different disconnect reasons
          if (reason === 'io server disconnect') {
            setError('Disconnected by server');
          } else if (reason === 'transport close' || reason === 'transport error') {
            setReconnecting(true);
          }
        });

        newSocket.on('connect_error', (err) => {
          console.error('WebSocket connection error:', err.message);
          setError(`Connection error: ${err.message}`);
          setIsConnected(false);
          reconnectAttemptsRef.current++;

          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setError('Failed to connect after multiple attempts');
            setReconnecting(false);
          } else {
            setReconnecting(true);
          }
        });

        newSocket.on('reconnect', (attemptNumber) => {
          console.log('WebSocket reconnected after', attemptNumber, 'attempts');
          setReconnecting(false);
          setError(null);
          reconnectAttemptsRef.current = 0;
        });

        newSocket.on('reconnect_attempt', (attemptNumber) => {
          console.log('WebSocket reconnection attempt:', attemptNumber);
          setReconnecting(true);
        });

        newSocket.on('reconnect_error', (err) => {
          console.error('WebSocket reconnection error:', err.message);
          setError(`Reconnection error: ${err.message}`);
        });

        newSocket.on('reconnect_failed', () => {
          console.error('WebSocket reconnection failed');
          setError('Failed to reconnect to server');
          setReconnecting(false);
        });

        // Authentication response
        newSocket.on('authenticated', () => {
          console.log('WebSocket authenticated successfully');
        });

        newSocket.on('unauthorized', (message) => {
          console.error('WebSocket authentication failed:', message);
          setError('Authentication failed');
          newSocket.disconnect();
        });

        // Error handling
        newSocket.on('error', (err) => {
          console.error('WebSocket error:', err);
          setError(typeof err === 'string' ? err : 'WebSocket error occurred');
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
      } catch (err) {
        console.error('Error creating WebSocket connection:', err);
        setError('Failed to create WebSocket connection');
      }
    })();
  }, [getWebSocketUrl, getAuthToken]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('Disconnecting WebSocket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setReconnecting(false);
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    if (autoConnect) {
      const token = getAuthToken();
      if (token) {
        connect();
      } else {
        console.log('No auth token found, skipping WebSocket connection');
      }
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect, getAuthToken]);

  /**
   * Reconnect when auth token changes
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' || e.key === 'sessionStorage') {
        const token = getAuthToken();
        if (token && !socketRef.current?.connected) {
          console.log('Auth token changed, reconnecting WebSocket');
          connect();
        } else if (!token && socketRef.current?.connected) {
          console.log('Auth token removed, disconnecting WebSocket');
          disconnect();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect, getAuthToken]);

  const value: WebSocketContextValue = {
    socket,
    isConnected,
    error,
    reconnecting,
    connect,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook to access WebSocket context
 */
export const useWebSocketContext = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;
