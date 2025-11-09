/**
 * useWebSocket Hook
 * Provides easy access to WebSocket functionality with event listeners
 */

import { useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useWebSocketContext } from '../contexts/WebSocketContext';

export interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  reconnecting: boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  once: (event: string, handler: (...args: any[]) => void) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Hook to interact with WebSocket
 * Provides socket instance and helper methods for event handling
 */
export const useWebSocket = (): UseWebSocketReturn => {
  const { socket, isConnected, error, reconnecting, connect, disconnect } = useWebSocketContext();
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());

  /**
   * Emit an event to the server
   */
  const emit = useCallback((event: string, data?: any) => {
    if (!socket) {
      console.warn('Cannot emit event: WebSocket not connected');
      return;
    }

    if (!isConnected) {
      console.warn('Cannot emit event: WebSocket not connected');
      return;
    }

    try {
      socket.emit(event, data);
    } catch (err) {
      console.error('Error emitting event:', err);
    }
  }, [socket, isConnected]);

  /**
   * Listen for an event from the server
   */
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!socket) {
      console.warn('Cannot listen for event: WebSocket not connected');
      return;
    }

    try {
      socket.on(event, handler);

      // Track listener for cleanup
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)?.add(handler);
    } catch (err) {
      console.error('Error adding event listener:', err);
    }
  }, [socket]);

  /**
   * Remove event listener
   */
  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (!socket) {
      return;
    }

    try {
      if (handler) {
        socket.off(event, handler);
        listenersRef.current.get(event)?.delete(handler);
      } else {
        socket.off(event);
        listenersRef.current.delete(event);
      }
    } catch (err) {
      console.error('Error removing event listener:', err);
    }
  }, [socket]);

  /**
   * Listen for an event once
   */
  const once = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!socket) {
      console.warn('Cannot listen for event: WebSocket not connected');
      return;
    }

    try {
      socket.once(event, handler);
    } catch (err) {
      console.error('Error adding one-time event listener:', err);
    }
  }, [socket]);

  /**
   * Cleanup all listeners on unmount
   */
  useEffect(() => {
    return () => {
      if (socket) {
        // Remove all tracked listeners
        listenersRef.current.forEach((handlers, event) => {
          handlers.forEach(handler => {
            socket.off(event, handler);
          });
        });
        listenersRef.current.clear();
      }
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    error,
    reconnecting,
    emit,
    on,
    off,
    once,
    connect,
    disconnect,
  };
};

/**
 * Hook to listen for a specific event
 * Automatically handles cleanup
 */
export const useWebSocketEvent = (
  event: string,
  handler: (...args: any[]) => void,
  dependencies: any[] = []
) => {
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, isConnected, event, handler, ...dependencies]);
};

/**
 * Hook to emit an event with automatic retry
 */
export const useWebSocketEmit = () => {
  const { socket, isConnected } = useWebSocket();

  const emitWithRetry = useCallback(
    async (event: string, data?: any, maxRetries = 3): Promise<boolean> => {
      if (!socket) {
        console.warn('Cannot emit event: WebSocket not available');
        return false;
      }

      let attempts = 0;
      while (attempts < maxRetries) {
        if (isConnected) {
          try {
            socket.emit(event, data);
            return true;
          } catch (err) {
            console.error('Error emitting event:', err);
          }
        }

        attempts++;
        if (attempts < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      console.error(`Failed to emit event after ${maxRetries} attempts`);
      return false;
    },
    [socket, isConnected]
  );

  return emitWithRetry;
};

/**
 * Hook to request data from server with timeout
 */
export const useWebSocketRequest = () => {
  const { socket, isConnected } = useWebSocket();

  const request = useCallback(
    <T = any>(event: string, data?: any, timeout = 5000): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!socket || !isConnected) {
          reject(new Error('WebSocket not connected'));
          return;
        }

        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, timeout);

        socket.emit(event, data, (response: T) => {
          clearTimeout(timeoutId);
          resolve(response);
        });
      });
    },
    [socket, isConnected]
  );

  return request;
};

export default useWebSocket;
