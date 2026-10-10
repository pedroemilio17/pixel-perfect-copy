import { useEffect, useRef, useState } from "react";
import { sensorIds, parts, type ComponentId } from "./model";

export const COMPONENT_DWELL_SECONDS = 12;
export const presentationOrder: ComponentId[] = [
  ...sensorIds,
  ...(Object.keys(parts) as ComponentId[]),
];

export function nextPresentedComponent(current: ComponentId, available: ComponentId[]) {
  if (!available.length) return undefined;
  return available[(available.indexOf(current) + 1) % available.length];
}

export function useComponentTour({
  enabled,
  selected,
  available,
  onSelect,
}: {
  enabled: boolean;
  selected: ComponentId;
  available: ComponentId[];
  onSelect: (id: ComponentId) => void;
}) {
  const latest = useRef({ selected, onSelect });
  latest.current = { selected, onSelect };
  const [remaining, setRemaining] = useState(COMPONENT_DWELL_SECONDS);
  useEffect(() => {
    setRemaining(COMPONENT_DWELL_SECONDS);
    if (!enabled || !available.length) return;
    let seconds = COMPONENT_DWELL_SECONDS;
    const timer = window.setInterval(() => {
      // Pause the reading interval while the user cannot see the presentation.
      if (document.hidden) return;
      seconds -= 1;
      if (seconds === 0) {
        const next = nextPresentedComponent(latest.current.selected, available);
        if (next) latest.current.onSelect(next);
        seconds = COMPONENT_DWELL_SECONDS;
      }
      setRemaining(seconds);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [enabled, available, selected]);
  return remaining;
}
