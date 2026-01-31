'use client';

import { useCallback, useRef, useState, useTransition } from 'react';

/**
 * Hook for handling async operations with optimistic updates, debouncing, and loading states.
 * Prevents double-clicks and handles concurrent requests professionally.
 * 
 * @example
 * ```tsx
 * const { execute, isLoading, optimisticValue, error } = useOptimisticAction<boolean>({
 *   initialValue: false,
 *   action: async () => {
 *     await likePost(postId);
 *     return true;
 *   },
 *   onError: () => toast.error('Failed to like post'),
 * });
 * 
 * // In UI:
 * <button onClick={() => execute(true)} disabled={isLoading}>
 *   {optimisticValue ? 'Liked' : 'Like'}
 * </button>
 * ```
 */

interface UseOptimisticActionOptions<T> {
  /** Initial value before any action */
  initialValue: T;
  /** Async action to execute (should return the server's confirmed value) */
  action: (optimisticValue: T) => Promise<T>;
  /** Callback on error - receives error and previous value for potential rollback messaging */
  onError?: (error: Error, previousValue: T) => void;
  /** Callback on success */
  onSuccess?: (value: T) => void;
  /** Minimum time between executions (debounce) in ms - default 300ms */
  debounceMs?: number;
}

interface UseOptimisticActionResult<T> {
  /** Execute the action with an optimistic value */
  execute: (optimisticValue: T) => void;
  /** Whether the action is currently in progress */
  isLoading: boolean;
  /** Current value (optimistic during action, confirmed after) */
  optimisticValue: T;
  /** Error if the last action failed */
  error: Error | null;
  /** Reset to initial state */
  reset: () => void;
}

export function useOptimisticAction<T>({
  initialValue,
  action,
  onError,
  onSuccess,
  debounceMs = 300,
}: UseOptimisticActionOptions<T>): UseOptimisticActionResult<T> {
  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();
  
  // Refs for debouncing and preventing race conditions
  const lastExecuteTime = useRef<number>(0);
  const pendingAction = useRef<Promise<T> | null>(null);
  const previousValue = useRef<T>(initialValue);
  
  const execute = useCallback((optimisticValue: T) => {
    const now = Date.now();
    
    // Debounce: ignore clicks that are too close together
    if (now - lastExecuteTime.current < debounceMs) {
      return;
    }
    lastExecuteTime.current = now;
    
    // Don't queue if already pending
    if (pendingAction.current) {
      return;
    }
    
    // Store previous value for rollback
    previousValue.current = value;
    
    // Optimistically update UI immediately
    setValue(optimisticValue);
    setError(null);
    
    // Execute the action
    startTransition(() => {
      const actionPromise = action(optimisticValue)
        .then((confirmedValue) => {
          setValue(confirmedValue);
          onSuccess?.(confirmedValue);
          return confirmedValue;
        })
        .catch((err) => {
          // Rollback to previous value
          setValue(previousValue.current);
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error, previousValue.current);
          throw err;
        })
        .finally(() => {
          pendingAction.current = null;
        });
      
      pendingAction.current = actionPromise;
    });
  }, [action, debounceMs, onError, onSuccess, value]);
  
  const reset = useCallback(() => {
    setValue(initialValue);
    setError(null);
    pendingAction.current = null;
  }, [initialValue]);
  
  return {
    execute,
    isLoading: isPending,
    optimisticValue: value,
    error,
    reset,
  };
}

/**
 * Simple hook to prevent double-clicks on buttons.
 * Use this for actions that don't need optimistic updates.
 * 
 * @example
 * ```tsx
 * const { execute, isLoading } = usePreventDoubleClick(async () => {
 *   await deleteItem(id);
 * });
 * 
 * <button onClick={execute} disabled={isLoading}>
 *   {isLoading ? 'Deleting...' : 'Delete'}
 * </button>
 * ```
 */
export function usePreventDoubleClick<T = void>(
  action: () => Promise<T>,
  options?: { debounceMs?: number; onError?: (error: Error) => void }
) {
  const [isLoading, setIsLoading] = useState(false);
  const lastExecuteTime = useRef<number>(0);
  const debounceMs = options?.debounceMs ?? 300;
  
  const execute = useCallback(async () => {
    const now = Date.now();
    
    // Debounce
    if (now - lastExecuteTime.current < debounceMs) {
      return;
    }
    lastExecuteTime.current = now;
    
    // Prevent double-click while loading
    if (isLoading) {
      return;
    }
    
    setIsLoading(true);
    try {
      return await action();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      options?.onError?.(error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [action, debounceMs, isLoading, options]);
  
  return { execute, isLoading };
}

/**
 * Hook for mutations that need to be queued (e.g., sequential order placement).
 * Ensures only one request runs at a time, queuing others.
 * 
 * @example
 * ```tsx
 * const { execute, isLoading, queueLength } = useQueuedMutation(placeOrder);
 * 
 * <button onClick={() => execute(orderData)} disabled={isLoading}>
 *   {queueLength > 0 ? `Processing (${queueLength} in queue)` : 'Place Order'}
 * </button>
 * ```
 */
export function useQueuedMutation<TInput, TOutput>(
  mutation: (input: TInput) => Promise<TOutput>,
  options?: {
    maxQueueSize?: number;
    onQueueFull?: () => void;
  }
) {
  const [isLoading, setIsLoading] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const queue = useRef<Array<{ input: TInput; resolve: (value: TOutput) => void; reject: (error: Error) => void }>>([]);
  const isProcessing = useRef(false);
  const maxQueueSize = options?.maxQueueSize ?? 5;
  
  const processQueue = useCallback(async () => {
    if (isProcessing.current || queue.current.length === 0) {
      return;
    }
    
    isProcessing.current = true;
    setIsLoading(true);
    
    while (queue.current.length > 0) {
      const item = queue.current.shift()!;
      setQueueLength(queue.current.length);
      
      try {
        const result = await mutation(item.input);
        item.resolve(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        item.reject(error);
      }
    }
    
    isProcessing.current = false;
    setIsLoading(false);
  }, [mutation]);
  
  const execute = useCallback((input: TInput): Promise<TOutput> => {
    return new Promise((resolve, reject) => {
      if (queue.current.length >= maxQueueSize) {
        options?.onQueueFull?.();
        reject(new Error('Queue is full, please try again later'));
        return;
      }
      
      queue.current.push({ input, resolve, reject });
      setQueueLength(queue.current.length);
      processQueue();
    });
  }, [maxQueueSize, options, processQueue]);
  
  return { execute, isLoading, queueLength };
}
