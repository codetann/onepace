import { useEffect, useState } from "react";

export type SubtitleSize = "small" | "medium" | "large" | "xlarge" | "huge";

export const SUBTITLE_SIZE_KEY = "onepace_subtitles_size";

export interface SubtitleSizeOption {
  id: SubtitleSize;
  label: string;
  desc: string;
  shortLabel: string;
}

export const SUBTITLE_SIZE_OPTIONS: SubtitleSizeOption[] = [
  { id: "small", label: "Small", desc: "75%", shortLabel: "S" },
  { id: "medium", label: "Medium", desc: "100%", shortLabel: "M" },
  { id: "large", label: "Large (Default)", desc: "130%", shortLabel: "L" },
  { id: "xlarge", label: "Extra Large", desc: "160%", shortLabel: "XL" },
  { id: "huge", label: "Huge", desc: "200%", shortLabel: "2XL" },
];

export const SUBTITLE_SIZE_VALUES: Record<SubtitleSize, string> = {
  small: "clamp(1.0rem, 2.0vw, 1.45rem)",
  medium: "clamp(1.3rem, 2.6vw, 1.85rem)",
  large: "clamp(1.65rem, 3.4vw, 2.5rem)",
  xlarge: "clamp(2.05rem, 4.2vw, 3.2rem)",
  huge: "clamp(2.55rem, 5.2vw, 4.0rem)",
};

export const getStoredSubtitleSize = (): SubtitleSize => {
  if (typeof window === "undefined") return "large";
  try {
    const stored = localStorage.getItem(SUBTITLE_SIZE_KEY) as SubtitleSize | null;
    if (stored && stored in SUBTITLE_SIZE_VALUES) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "large";
};

export const applySubtitleSizeToDom = (size: SubtitleSize) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.subtitleSize = size;
  document.documentElement.style.setProperty(
    "--subtitle-font-size",
    SUBTITLE_SIZE_VALUES[size] || SUBTITLE_SIZE_VALUES.large,
  );
};

export const useSubtitleSettings = () => {
  const [subtitleSize, setSubtitleSizeState] = useState<SubtitleSize>(() => {
    const size = getStoredSubtitleSize();
    applySubtitleSizeToDom(size);
    return size;
  });

  useEffect(() => {
    applySubtitleSizeToDom(subtitleSize);
  }, [subtitleSize]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SUBTITLE_SIZE_KEY && e.newValue) {
        if (e.newValue in SUBTITLE_SIZE_VALUES) {
          setSubtitleSizeState(e.newValue as SubtitleSize);
        }
      }
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<SubtitleSize>;
      if (customEvent.detail && customEvent.detail in SUBTITLE_SIZE_VALUES) {
        setSubtitleSizeState(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("onepace:subtitlesize", handleCustomChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("onepace:subtitlesize", handleCustomChange);
    };
  }, []);

  const setSubtitleSize = (newSize: SubtitleSize) => {
    setSubtitleSizeState(newSize);
    try {
      localStorage.setItem(SUBTITLE_SIZE_KEY, newSize);
      applySubtitleSizeToDom(newSize);
      window.dispatchEvent(
        new CustomEvent("onepace:subtitlesize", { detail: newSize }),
      );
    } catch {
      /* ignore */
    }
  };

  return {
    subtitleSize,
    setSubtitleSize,
    subtitleSizeOptions: SUBTITLE_SIZE_OPTIONS,
  };
};
