import { useEffect, useState } from 'react';

/**
 * Keeps content mounted long enough for exit animations to finish.
 * Returns `true` while animating out so components can fade/slide before unmounting.
 */
export const useDelayedRender = (isOpen: boolean, delayMs = 220) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }

    const timeout = window.setTimeout(() => setShouldRender(false), delayMs);
    return () => window.clearTimeout(timeout);
  }, [isOpen, delayMs]);

  return shouldRender;
};
