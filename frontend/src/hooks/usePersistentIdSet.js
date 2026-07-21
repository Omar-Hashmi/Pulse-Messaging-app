import { useState, useEffect, useCallback, useRef } from 'react';

const EVENT_NAME = 'persistent-id-set-changed';

function readFromStorage(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch {
    return [];
  }
}

/**
 * Keeps an array of ids (e.g. archivedConversations / hiddenConversations)
 * persisted to localStorage AND in sync across every component using this
 * hook on the current page — no page refresh required.
 *
 * Any component that calls usePersistentIdSet('archivedConversations')
 * will immediately see updates made by any other component that calls
 * it with the same key, exactly like the socket keeps lastMessage in sync.
 */
export function usePersistentIdSet(storageKey) {
  const [ids, setIds] = useState(() => readFromStorage(storageKey));
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  useEffect(() => {
    // Same-tab updates from other components using this hook
    const handleLocalChange = (e) => {
      if (e.detail?.key === storageKey) {
        setIds(e.detail.value);
      }
    };

    // Cross-tab updates (native storage event)
    const handleStorageEvent = (e) => {
      if (e.key === storageKey) {
        setIds(readFromStorage(storageKey));
      }
    };

    window.addEventListener(EVENT_NAME, handleLocalChange);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener(EVENT_NAME, handleLocalChange);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [storageKey]);

  const update = useCallback((updater) => {
    setIds((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem(storageKeyRef.current, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { key: storageKeyRef.current, value: next } })
      );
      return next;
    });
  }, []);

  return [ids, update];
}
