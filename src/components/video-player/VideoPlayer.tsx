/**
 * VideoPlayer.tsx — Custom Video Component with HeroUI v3
 *
 * Features:
 * - Live video frame + subtitle preview when hovering/scrubbing the progress bar
 * - Double-tap / double-click left or right to skip -10s / +10s (with cumulative multi-tap ripple)
 * - Horizontal scroll (trackpad two-finger swipe, Shift+Wheel, or wheel on timeline) to scrub smoothly
 * - Press-and-hold (pointer or Spacebar) for temporary 2× playback speed
 * - Quick -10s, +10s, +85s (Skip OP), and Next Episode controls
 * - High-resolution video frame screenshot capture
 * - Frame-by-frame stepping (, and .) while paused
 * - Clickable timestamp to toggle remaining time & estimated finish time
 * - Comprehensive keyboard shortcuts with interactive '?' cheat-sheet overlay
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { Button, Chip, Spinner, Tooltip } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  JellyfinPlaybackInfoResponse,
  SubtitleTrackInfo,
} from "@/api/jellyfin/types";
import { jellyfinClient, jellyfinSecondsToTicks } from "@/api/jellyfin";
import {
  useSubtitleSettings,
  SUBTITLE_SIZE_VALUES,
  type SubtitleSize,
} from "@/hooks";
import {
  BiCheck,
  BiCog,
  BiExitFullscreen,
  BiFullscreen,
  BiPause,
  BiPlay,
  BiVolumeFull,
  BiVolumeLow,
  BiVolumeMute,
  BiWindows,
  BiX,
} from "react-icons/bi";
import {
  MdAirplay,
  MdCameraAlt,
  MdCast,
  MdCastConnected,
  MdFastForward,
  MdForward10,
  MdKeyboard,
  MdReplay10,
  MdSkipNext,
  MdSubtitles,
  MdSubtitlesOff,
} from "react-icons/md";

// ─── Icons ───────────────────────────────────────────────────────────────────

const PlayIcon = () => <BiPlay className="size-6" />;
const PauseIcon = () => <BiPause className="size-6" />;

const VolumeIcon = ({ muted, vol }: { muted: boolean; vol: number }) => {
  if (muted || vol === 0) return <BiVolumeMute className="size-5" />;
  if (vol < 0.5) return <BiVolumeLow className="size-5" />;
  return <BiVolumeFull className="size-5" />;
};

const FullscreenIcon = ({ active }: { active?: boolean }) =>
  active ? (
    <BiExitFullscreen className="size-5" />
  ) : (
    <BiFullscreen className="size-5" />
  );

const SettingsIcon = () => <BiCog className="size-5" />;
const PopOutIcon = () => <BiWindows className="size-5" />;
const AirplayIcon = () => <MdAirplay className="size-5" />;

const CastIcon = ({ connected = false }: { connected?: boolean }) =>
  connected ? (
    <MdCastConnected className="size-5 text-accent" />
  ) : (
    <MdCast className="size-5" />
  );

// ─── Device detection helpers ────────────────────────────────────────────────

const isIPhoneDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPod/i.test(navigator.userAgent);
};

const isAppleDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod|Macintosh/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (s: number): string => {
  if (!Number.isFinite(s) || isNaN(s) || s < 0) return "0:00";
  const totalSec = Math.floor(s);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const fmtDelta = (deltaSec: number): string => {
  const sign = deltaSec >= 0 ? "+" : "-";
  const abs = Math.abs(Math.round(deltaSec));
  if (abs < 60) return `${sign}${abs}s`;
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${s.toString().padStart(2, "0")}`;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WebKitVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitEnterFullScreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitExitFullScreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  webkitSupportsFullscreen?: boolean;
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

export interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

export interface FullscreenHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export interface TargetAvailabilityEvent extends Event {
  availability?: "available" | "not-available";
}

export interface WindowWithAirPlay extends Window {
  WebKitPlaybackTargetAvailabilityEvent?: unknown;
}

export interface VideoPlayerProps {
  src: string;
  qualities?: { label: string; src: string }[];
  poster?: string;
  title?: string;
  subtitle?: string;
  autoPlay?: boolean;
  loop?: boolean;
  /** Tailwind aspect-ratio class, e.g. "aspect-video" (default) or "aspect-[4/3]" */
  aspectRatio?: string;
  className?: string;
  playbackInfo?: JellyfinPlaybackInfoResponse;
  /** Jellyfin episode/item id (UUID) — required with `playbackInfo` for session reporting. */
  jellyfinItemId?: string;
  /** Min interval between `Sessions/Playing/Progress` calls while playing (ms). */
  playbackProgressIntervalMs?: number;
  /**
   * Jellyfin `UserData.PlaybackPositionTicks` when already known (skips an extra `getItem`).
   * Otherwise resume position is loaded via `getItem(…, { Fields: "UserData" })` when `jellyfinItemId` is set.
   */
  initialPlaybackPositionTicks?: number;
  /** Callback triggered when countdown finishes or user clicks start next */
  onNextEpisode?: () => void;
  /** Title for the next episode in the auto-advance countdown card */
  nextEpisodeTitle?: string;
  /** Subtitle tracks (sidecar or embedded). If omitted, extracted automatically from playbackInfo. */
  subtitles?: SubtitleTrackInfo[];
}

interface SkipFeedbackState {
  side: "left" | "right";
  seconds: number;
  key: number;
}

interface HudToastState {
  text: string;
  subtext?: string;
  key: number;
}

interface WheelScrubState {
  targetTime: number;
  deltaSeconds: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  subtitle,
  autoPlay = true,
  loop = false,
  aspectRatio = "aspect-video",
  className = "",
  playbackInfo,
  jellyfinItemId,
  playbackProgressIntervalMs = 10_000,
  initialPlaybackPositionTicks,
  onNextEpisode,
  nextEpisodeTitle,
  subtitles,
}) => {
  const jellyfinMediaSourceId = playbackInfo?.MediaSources?.[0]?.Id;

  const videoRef = useRef<WebKitVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRegionRef = useRef<"left" | "center" | "right" | null>(null);
  const playContextRef = useRef({ playbackInfo, jellyfinItemId, src });
  playContextRef.current = { playbackInfo, jellyfinItemId, src };
  const progressIntervalRef = useRef(playbackProgressIntervalMs);
  progressIntervalRef.current = playbackProgressIntervalMs;
  const jellyfinStartedRef = useRef(false);
  const jellyfinStoppedRef = useRef(false);
  const jellyfinLastProgressAtRef = useRef(0);
  const jellyfinLastPositionTicksRef = useRef(0);
  const activeJellyfinSessionRef = useRef<{
    playSessionId: string;
    itemId: string;
    mediaSourceId: string;
  } | null>(null);

  const pendingResumeSecondsRef = useRef<number | null>(null);
  const resumeAppliedRef = useRef(false);
  const preMuteVolumeRef = useRef(0.8);

  const [playing, setPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasStarted, setHasStarted] = useState(autoPlay);
  const [showCenterFlash, setShowCenterFlash] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [showRemainingTime, setShowRemainingTime] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);

  // Double-tap / skip ripple feedback state
  const [skipFeedback, setSkipFeedback] = useState<SkipFeedbackState | null>(
    null,
  );
  const skipResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transient HUD pill (volume, speed, frame step, etc.)
  const [hudToast, setHudToast] = useState<HudToastState | null>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHudToast = useCallback((text: string, subtext?: string) => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    setHudToast({ text, subtext, key: Date.now() });
    hudTimerRef.current = setTimeout(() => {
      setHudToast(null);
    }, 1100);
  }, []);

  // Press-and-hold 2× speed state
  const [isHoldSpeeding, setIsHoldSpeeding] = useState(false);
  const holdSpeedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preHoldRateRef = useRef(1);
  const wasHoldSpeedingRef = useRef(false);

  // Horizontal wheel scrub state
  const [wheelScrub, setWheelScrub] = useState<WheelScrubState | null>(null);
  const wheelScrubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelScrubStartRef = useRef<number | null>(null);
  const wheelScrubCurrentRef = useRef<number | null>(null);

  // Timeline hover preview state
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState<number>(0);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewCueText, setPreviewCueText] = useState<string | null>(null);
  const previewCacheRef = useRef<Map<number, string>>(new Map());
  const isPreviewSeekingRef = useRef(false);
  const desiredPreviewBucketRef = useRef<number | null>(null);
  const activePreviewTimeRef = useRef<number | null>(null);

  const availableSubtitles = useMemo<SubtitleTrackInfo[]>(() => {
    if (subtitles && subtitles.length > 0) return subtitles;
    return jellyfinClient.extractSubtitles(playbackInfo, jellyfinItemId);
  }, [subtitles, playbackInfo, jellyfinItemId]);

  const hasSubtitles = availableSubtitles.length > 0;

  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(
    null,
  );
  const activeSubtitleIndexRef = useRef<number | null>(null);
  activeSubtitleIndexRef.current = activeSubtitleIndex;

  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const { subtitleSize, setSubtitleSize, subtitleSizeOptions } =
    useSubtitleSettings();

  // Sync preference with available subtitles
  useEffect(() => {
    if (!hasSubtitles) {
      setActiveSubtitleIndex(null);
      return;
    }

    try {
      const enabledPref = localStorage.getItem("onepace_subtitles_enabled");
      const langPref = localStorage.getItem("onepace_subtitles_language");

      if (enabledPref === "false") {
        setActiveSubtitleIndex(null);
        return;
      }

      if (enabledPref === "true") {
        const match =
          (langPref
            ? availableSubtitles.find((s) => s.language === langPref)
            : null) ||
          availableSubtitles.find((s) => s.isDefault) ||
          availableSubtitles[0];

        setActiveSubtitleIndex(match ? match.index : null);
        return;
      }

      const defaultTrack = availableSubtitles.find((s) => s.isDefault);
      if (defaultTrack) {
        setActiveSubtitleIndex(defaultTrack.index);
      } else {
        setActiveSubtitleIndex(null);
      }
    } catch {
      setActiveSubtitleIndex(null);
    }
  }, [availableSubtitles, hasSubtitles]);

  const applySubtitleTrack = useCallback(
    (index: number | null) => {
      setActiveSubtitleIndex(index);
      activeSubtitleIndexRef.current = index;

      try {
        if (index === null) {
          localStorage.setItem("onepace_subtitles_enabled", "false");
        } else {
          localStorage.setItem("onepace_subtitles_enabled", "true");
          const found = availableSubtitles.find((s) => s.index === index);
          if (found?.language) {
            localStorage.setItem("onepace_subtitles_language", found.language);
          }
        }
      } catch {
        /* ignore */
      }

      const v = videoRef.current;
      if (!v || !v.textTracks) return;

      for (let i = 0; i < v.textTracks.length; i++) {
        const tt = v.textTracks[i];
        const matchingSub = availableSubtitles[i];
        const shouldShow =
          index !== null && matchingSub && matchingSub.index === index;

        tt.mode = shouldShow ? "showing" : "hidden";
      }

      const activeSession = activeJellyfinSessionRef.current;
      if (activeSession) {
        void jellyfinClient.reportPlaybackProgress({
          PlaySessionId: activeSession.playSessionId,
          ItemId: activeSession.itemId,
          MediaSourceId: activeSession.mediaSourceId,
          PositionTicks: jellyfinSecondsToTicks(v.currentTime),
          IsPaused: v.paused,
          IsMuted: v.muted,
          VolumeLevel: Math.round(v.volume * 100),
          CanSeek: Number.isFinite(v.duration) && v.duration > 0,
          SubtitleStreamIndex: index,
        });
      }
    },
    [availableSubtitles],
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !v.textTracks) return;

    const syncTracks = () => {
      for (let i = 0; i < v.textTracks.length; i++) {
        const tt = v.textTracks[i];
        const matchingSub = availableSubtitles[i];
        const shouldShow =
          activeSubtitleIndex !== null &&
          matchingSub &&
          matchingSub.index === activeSubtitleIndex;
        // Keep first track at least "hidden" so cues are loaded for timeline hover preview
        tt.mode = shouldShow ? "showing" : i === 0 ? "hidden" : "disabled";
      }
    };

    syncTracks();

    const handleTrackChange = () => {
      let showingIndex: number | null = null;
      for (let i = 0; i < v.textTracks.length; i++) {
        const tt = v.textTracks[i];
        if (tt.mode === "showing") {
          const matchingSub = availableSubtitles[i];
          if (matchingSub) {
            showingIndex = matchingSub.index;
          }
          break;
        }
      }

      if (
        showingIndex !== null &&
        showingIndex !== activeSubtitleIndexRef.current
      ) {
        setActiveSubtitleIndex(showingIndex);
        activeSubtitleIndexRef.current = showingIndex;
        try {
          localStorage.setItem("onepace_subtitles_enabled", "true");
          const found = availableSubtitles.find(
            (s) => s.index === showingIndex,
          );
          if (found?.language) {
            localStorage.setItem("onepace_subtitles_language", found.language);
          }
        } catch {
          /* ignore */
        }
      } else if (
        showingIndex === null &&
        activeSubtitleIndexRef.current !== null
      ) {
        setActiveSubtitleIndex(null);
        activeSubtitleIndexRef.current = null;
        try {
          localStorage.setItem("onepace_subtitles_enabled", "false");
        } catch {
          /* ignore */
        }
      }
    };

    const textTracks = v.textTracks;
    textTracks.addEventListener?.("change", handleTrackChange);
    textTracks.addEventListener?.("addtrack", syncTracks);

    return () => {
      textTracks.removeEventListener?.("change", handleTrackChange);
      textTracks.removeEventListener?.("addtrack", syncTracks);
    };
  }, [activeSubtitleIndex, availableSubtitles]);

  const activeSubtitleLabel = useMemo(() => {
    if (activeSubtitleIndex === null) return null;
    return (
      availableSubtitles.find((s) => s.index === activeSubtitleIndex)?.label ||
      "On"
    );
  }, [availableSubtitles, activeSubtitleIndex]);

  const handleSubtitleButtonClick = useCallback(() => {
    if (availableSubtitles.length === 1) {
      if (activeSubtitleIndex !== null) {
        applySubtitleTrack(null);
        triggerHudToast("Subtitles Off");
      } else {
        applySubtitleTrack(availableSubtitles[0].index);
        triggerHudToast(`Subtitles: ${availableSubtitles[0].label}`);
      }
    } else {
      setShowSettings(false);
      setShowSubtitleMenu((prev) => !prev);
    }
  }, [
    availableSubtitles,
    activeSubtitleIndex,
    applySubtitleTrack,
    triggerHudToast,
  ]);

  const [isAirPlayAvailable, setIsAirPlayAvailable] = useState(false);
  const [isAirPlayConnected, setIsAirPlayConnected] = useState(false);
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCastConnected, setIsCastConnected] = useState(false);

  const [useNativeControls, setUseNativeControls] = useState<boolean>(() => {
    try {
      return localStorage.getItem("onepace_native_player") === "true";
    } catch {
      return false;
    }
  });
  const useNativeControlsRef = useRef(useNativeControls);
  useNativeControlsRef.current = useNativeControls;

  useEffect(() => {
    try {
      localStorage.setItem(
        "onepace_native_player",
        useNativeControls ? "true" : "false",
      );
    } catch {
      /* ignore */
    }
    const v = videoRef.current;
    if (v && !v.webkitDisplayingFullscreen) {
      v.controls = useNativeControls;
    }
  }, [useNativeControls]);

  const [isNextCancelled, setIsNextCancelled] = useState(false);
  const nextTriggeredRef = useRef(false);

  useEffect(() => {
    setIsNextCancelled(false);
    nextTriggeredRef.current = false;
    previewCacheRef.current.clear();
    setPreviewDataUrl(null);
    isPreviewSeekingRef.current = false;
    desiredPreviewBucketRef.current = null;
    if (autoPlay) {
      setHasStarted(true);
    }
  }, [src, jellyfinItemId, autoPlay]);

  // ── Preview Frame Extractor (Hover & Scrub Thumbnail) ──────────────────────

  const extractCueAtTime = useCallback((targetTime: number): string | null => {
    const v = videoRef.current;
    if (!v || !v.textTracks) return null;
    for (let i = 0; i < v.textTracks.length; i++) {
      const track = v.textTracks[i];
      if (!track.cues || track.cues.length === 0) continue;
      for (let j = 0; j < track.cues.length; j++) {
        const cue = track.cues[j] as VTTCue;
        if (targetTime >= cue.startTime && targetTime <= cue.endTime) {
          const clean = (cue.text || "")
            .replace(/<[^>]+>/g, "")
            .replace(/\{[^}]+\}/g, "")
            .trim();
          if (clean) return clean;
        }
      }
    }
    return null;
  }, []);

  const requestPreviewFrame = useCallback(
    (targetTime: number) => {
      if (!Number.isFinite(targetTime) || targetTime < 0) return;
      activePreviewTimeRef.current = targetTime;
      setPreviewCueText(extractCueAtTime(targetTime));

      const bucket = Math.floor(targetTime / 2) * 2;
      const cache = previewCacheRef.current;

      if (cache.has(bucket)) {
        setPreviewDataUrl(cache.get(bucket)!);
        return;
      }

      // Show closest cached frame within 8s immediately while exact bucket seeks
      for (const offset of [2, -2, 4, -4, 6, -6]) {
        const near = cache.get(bucket + offset);
        if (near) {
          setPreviewDataUrl(near);
          break;
        }
      }

      desiredPreviewBucketRef.current = bucket;
      const pv = previewVideoRef.current;
      if (!pv || pv.readyState < 1) return;

      if (!isPreviewSeekingRef.current) {
        isPreviewSeekingRef.current = true;
        try {
          pv.currentTime = Math.min(
            Math.max(0.1, bucket),
            Math.max(0.1, (pv.duration || duration || 1) - 0.1),
          );
        } catch {
          isPreviewSeekingRef.current = false;
        }
      }
    },
    [duration, extractCueAtTime],
  );

  useEffect(() => {
    const pv = previewVideoRef.current;
    if (!pv || !src) return;

    if (!previewCanvasRef.current && typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = 240;
      c.height = 135;
      previewCanvasRef.current = c;
    }

    const handlePreviewSeeked = () => {
      const canvas = previewCanvasRef.current;
      const soughtBucket = Math.floor(pv.currentTime / 2) * 2;

      if (canvas && pv.videoWidth > 0 && pv.videoHeight > 0) {
        try {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(pv, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
            if (dataUrl && dataUrl.length > 100) {
              if (previewCacheRef.current.size > 160) {
                const oldestKey = previewCacheRef.current.keys().next().value;
                if (oldestKey !== undefined) {
                  previewCacheRef.current.delete(oldestKey);
                }
              }
              previewCacheRef.current.set(soughtBucket, dataUrl);
              const activeTime = activePreviewTimeRef.current;
              if (
                activeTime !== null &&
                Math.abs(activeTime - soughtBucket) <= 4
              ) {
                setPreviewDataUrl(dataUrl);
              }
            }
          }
        } catch {
          // Cross-origin taint or browser security restriction; live previewVideo element still renders
        }
      }

      const nextDesired = desiredPreviewBucketRef.current;
      if (nextDesired !== null && Math.abs(nextDesired - soughtBucket) >= 2) {
        desiredPreviewBucketRef.current = null;
        try {
          pv.currentTime = Math.min(
            Math.max(0.1, nextDesired),
            Math.max(0.1, (pv.duration || 1) - 0.1),
          );
          return;
        } catch {
          /* ignore */
        }
      }

      isPreviewSeekingRef.current = false;
    };

    const handlePreviewError = () => {
      isPreviewSeekingRef.current = false;
    };

    pv.addEventListener("seeked", handlePreviewSeeked);
    pv.addEventListener("error", handlePreviewError);
    return () => {
      pv.removeEventListener("seeked", handlePreviewSeeked);
      pv.removeEventListener("error", handlePreviewError);
    };
  }, [src]);

  // ── Play / pause & Seek ───────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setShowCenterFlash(true);
    setTimeout(() => setShowCenterFlash(false), 550);
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  }, []);

  const seekBy = useCallback((secondsDelta: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const next = Math.min(Math.max(0, v.currentTime + secondsDelta), v.duration);
    v.currentTime = next;
    setCurrentTime(next);
    jellyfinLastPositionTicksRef.current = jellyfinSecondsToTicks(next);
  }, []);

  const triggerSkipWithFeedback = useCallback(
    (deltaSeconds: number) => {
      seekBy(deltaSeconds);
      const side: "left" | "right" = deltaSeconds < 0 ? "left" : "right";
      const absSec = Math.abs(deltaSeconds);

      setSkipFeedback((prev) => {
        const accumulated =
          prev && prev.side === side ? prev.seconds + absSec : absSec;
        return {
          side,
          seconds: accumulated,
          key: Date.now(),
        };
      });

      if (skipResetTimerRef.current) clearTimeout(skipResetTimerRef.current);
      skipResetTimerRef.current = setTimeout(() => {
        setSkipFeedback(null);
        skipResetTimerRef.current = null;
      }, 750);
    },
    [seekBy],
  );

  const stepFrame = useCallback(
    (direction: -1 | 1) => {
      const v = videoRef.current;
      if (!v) return;
      if (!v.paused) v.pause();
      const frameDuration = 1 / 24;
      seekBy(direction * frameDuration);
      triggerHudToast(
        direction > 0 ? "Next Frame (+1f)" : "Previous Frame (-1f)",
        fmt(v.currentTime),
      );
    },
    [seekBy, triggerHudToast],
  );

  const captureScreenshot = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0 || v.videoHeight === 0) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const safeTitle = (title || "One-Pace").replace(/[^a-z0-9-_ ]/gi, "");
      const timeStamp = fmt(v.currentTime).replace(/:/g, "-");
      link.download = `${safeTitle}-${timeStamp}.png`;
      link.href = dataUrl;
      link.click();

      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 250);
      triggerHudToast("Screenshot Saved", `${v.videoWidth}×${v.videoHeight}`);
    } catch {
      triggerHudToast("Screenshot unavailable");
    }
  }, [title, triggerHudToast]);

  const tryApplyPendingResume = useCallback(() => {
    const v = videoRef.current;
    if (!v || resumeAppliedRef.current) return;
    const pending = pendingResumeSecondsRef.current;
    if (pending == null || pending <= 0) return;
    if (!Number.isFinite(v.duration) || v.duration <= 0) return;
    if (pending >= v.duration - 0.5) {
      resumeAppliedRef.current = true;
      pendingResumeSecondsRef.current = null;
      return;
    }
    const t = Math.min(Math.max(0, pending), Math.max(0, v.duration - 0.25));
    v.currentTime = t;
    setCurrentTime(t);
    jellyfinLastPositionTicksRef.current = jellyfinSecondsToTicks(t);
    resumeAppliedRef.current = true;
  }, []);

  useEffect(() => {
    resumeAppliedRef.current = false;

    if (
      typeof initialPlaybackPositionTicks === "number" &&
      initialPlaybackPositionTicks > 0
    ) {
      pendingResumeSecondsRef.current =
        initialPlaybackPositionTicks / 10_000_000;
      queueMicrotask(() => tryApplyPendingResume());
      return;
    }

    pendingResumeSecondsRef.current = null;

    if (!jellyfinItemId) return;

    let cancelled = false;
    void (async () => {
      try {
        const item = await jellyfinClient.getItem(jellyfinItemId, undefined, {
          Fields: "UserData",
        });
        if (cancelled) return;
        const ud = item.UserData;
        if (!ud || ud.Played) {
          pendingResumeSecondsRef.current = null;
        } else {
          const ticks = ud.PlaybackPositionTicks;
          if (typeof ticks === "number" && ticks > 0) {
            pendingResumeSecondsRef.current = ticks / 10_000_000;
          } else {
            pendingResumeSecondsRef.current = null;
          }
        }
        queueMicrotask(() => tryApplyPendingResume());
      } catch {
        pendingResumeSecondsRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    jellyfinItemId,
    initialPlaybackPositionTicks,
    src,
    tryApplyPendingResume,
  ]);

  useEffect(() => {
    const prev = activeJellyfinSessionRef.current;
    const nextPlay = playbackInfo?.PlaySessionId;
    const nextItem = jellyfinItemId;
    const nextMs = jellyfinMediaSourceId;

    if (
      prev &&
      (prev.playSessionId !== nextPlay ||
        prev.itemId !== nextItem ||
        prev.mediaSourceId !== nextMs)
    ) {
      void jellyfinClient.reportPlaybackStopped({
        PlaySessionId: prev.playSessionId,
        ItemId: prev.itemId,
        MediaSourceId: prev.mediaSourceId,
        PositionTicks: jellyfinLastPositionTicksRef.current,
        Played: false,
      });
      activeJellyfinSessionRef.current = null;
    }

    jellyfinStartedRef.current = false;
    jellyfinStoppedRef.current = false;
    jellyfinLastProgressAtRef.current = 0;
  }, [playbackInfo?.PlaySessionId, jellyfinItemId, jellyfinMediaSourceId, src]);

  // ── Volume ────────────────────────────────────────────────────────────────

  const volumeBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const handleVolumeChange = useCallback(
    (val: number, showFeedback = false) => {
      const v = videoRef.current;
      const clamped = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
      if (v) {
        v.volume = clamped;
        if (clamped > 0) {
          preMuteVolumeRef.current = clamped;
          v.muted = false;
          setMuted(false);
        } else {
          v.muted = true;
          setMuted(true);
        }
      }
      setVolume(clamped);
      if (clamped === 0) {
        setMuted(true);
      }
      if (showFeedback) {
        triggerHudToast(
          clamped === 0 ? "Muted" : `Volume ${Math.round(clamped * 100)}%`,
        );
      }
    },
    [triggerHudToast],
  );

  const updateVolumeFromPointer = useCallback(
    (clientX: number) => {
      if (!volumeBarRef.current) return;
      const rect = volumeBarRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const raw = (clientX - rect.left) / rect.width;
      handleVolumeChange(raw);
    },
    [handleVolumeChange],
  );

  const onVolumePointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setIsDraggingVolume(true);
    updateVolumeFromPointer(e.clientX);
  };

  const onVolumePointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (isDraggingVolume) {
      e.stopPropagation();
      updateVolumeFromPointer(e.clientX);
    }
  };

  const onVolumePointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (isDraggingVolume) {
      e.stopPropagation();
      setIsDraggingVolume(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const onVolumeWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const current = muted ? 0 : volume;
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    handleVolumeChange(current + delta, true);
  };

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || muted || volume === 0) {
      const next =
        preMuteVolumeRef.current > 0.05 ? preMuteVolumeRef.current : 0.5;
      v.muted = false;
      v.volume = next;
      setMuted(false);
      setVolume(next);
      triggerHudToast(`Volume ${Math.round(next * 100)}%`);
    } else {
      preMuteVolumeRef.current = v.volume > 0 ? v.volume : volume;
      v.muted = true;
      v.volume = 0;
      setMuted(true);
      setVolume(0);
      triggerHudToast("Muted");
    }
  }, [muted, volume, triggerHudToast]);

  // ── Seek ──────────────────────────────────────────────────────────────────

  const handleSeek = useCallback((val: number | number[]) => {
    const v = videoRef.current;
    const t = Array.isArray(val) ? val[0] : val;
    if (!v) return;
    v.currentTime = t;
    setCurrentTime(t);
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current as FullscreenHTMLElement | null;
    const v = videoRef.current;

    if (!container && !v) return;

    const doc = document as FullscreenDocument;
    const isStandardFs = Boolean(
      doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement,
    );
    const isVideoFs = Boolean(v?.webkitDisplayingFullscreen);

    if (isStandardFs || isVideoFs) {
      if (isVideoFs) {
        if (typeof v?.webkitExitFullscreen === "function") {
          v.webkitExitFullscreen();
          return;
        }
        if (typeof v?.webkitExitFullScreen === "function") {
          v.webkitExitFullScreen();
          return;
        }
      }
      if (doc.exitFullscreen) {
        await doc.exitFullscreen().catch(() => {});
        return;
      }
      if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
        return;
      }
      return;
    }

    const isIPhone = isIPhoneDevice();

    if (!isIPhone && container) {
      try {
        if (typeof container.requestFullscreen === "function") {
          await container.requestFullscreen();
          return;
        }
        if (typeof container.webkitRequestFullscreen === "function") {
          container.webkitRequestFullscreen();
          return;
        }
      } catch (err) {
        console.warn(
          "Container requestFullscreen failed, falling back to native video player:",
          err,
        );
      }
    }

    if (v) {
      try {
        v.controls = true;
        if (typeof v.webkitEnterFullscreen === "function") {
          v.webkitEnterFullscreen();
          return;
        }
        if (typeof v.webkitEnterFullScreen === "function") {
          v.webkitEnterFullScreen();
          return;
        }
        if (typeof v.requestFullscreen === "function") {
          await v.requestFullscreen();
          return;
        }
        if (typeof v.webkitRequestFullscreen === "function") {
          v.webkitRequestFullscreen();
          return;
        }
      } catch (err) {
        console.warn("Native video fullscreen failed:", err);
      }
    }
  }, []);

  // ── AirPlay & Cast ────────────────────────────────────────────────────────

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    try {
      v.setAttribute("x-webkit-airplay", "allow");
      v.setAttribute("webkit-playsinline", "true");
    } catch {
      /* ignore */
    }

    const hasAirPlayPicker =
      typeof v.webkitShowPlaybackTargetPicker === "function";
    const win =
      typeof window !== "undefined"
        ? (window as WindowWithAirPlay)
        : undefined;
    const hasAvailabilityEvent =
      typeof win?.WebKitPlaybackTargetAvailabilityEvent !== "undefined";

    if (hasAirPlayPicker || hasAvailabilityEvent || isAppleDevice()) {
      if (hasAirPlayPicker || isAppleDevice()) {
        setIsAirPlayAvailable(true);
      }

      if (hasAvailabilityEvent) {
        const onAvailability = (e: Event) => {
          const targetEvent = e as TargetAvailabilityEvent;
          setIsAirPlayAvailable(targetEvent.availability === "available");
        };
        const onWirelessChange = () => {
          setIsAirPlayConnected(
            Boolean(v.webkitCurrentPlaybackTargetIsWireless),
          );
        };
        v.addEventListener(
          "webkitplaybacktargetavailabilitychanged",
          onAvailability,
        );
        v.addEventListener(
          "webkitcurrentplaybacktargetiswirelesschanged",
          onWirelessChange,
        );
        return () => {
          v.removeEventListener(
            "webkitplaybacktargetavailabilitychanged",
            onAvailability,
          );
          v.removeEventListener(
            "webkitcurrentplaybacktargetiswirelesschanged",
            onWirelessChange,
          );
        };
      }
    }
  }, [src]);

  const handleAirPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (typeof v.webkitShowPlaybackTargetPicker === "function") {
        v.webkitShowPlaybackTargetPicker();
      } else if (v.remote && typeof v.remote.prompt === "function") {
        v.remote.prompt().catch(() => {});
      }
    } catch (e) {
      console.warn("AirPlay failed:", e);
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const remote = v.remote;
    if (
      !remote ||
      typeof window === "undefined" ||
      !("RemotePlayback" in window)
    ) {
      return;
    }

    const win = window as WindowWithAirPlay;
    const isSafari =
      typeof win.WebKitPlaybackTargetAvailabilityEvent !== "undefined" ||
      (typeof v.webkitShowPlaybackTargetPicker === "function" &&
        isAppleDevice());

    if (isSafari) return;

    let watchId: number | null = null;
    let cancelled = false;

    if (typeof remote.watchAvailability === "function") {
      remote
        .watchAvailability((available: boolean) => {
          if (!cancelled) {
            setIsCastAvailable(available);
          }
        })
        .then((id: number) => {
          watchId = id;
        })
        .catch(() => {
          if (!cancelled && typeof remote.prompt === "function") {
            setIsCastAvailable(true);
          }
        });
    } else if (typeof remote.prompt === "function") {
      setIsCastAvailable(true);
    }

    const onConnect = () => setIsCastConnected(true);
    const onDisconnect = () => setIsCastConnected(false);

    remote.addEventListener?.("connect", onConnect);
    remote.addEventListener?.("disconnect", onDisconnect);

    return () => {
      cancelled = true;
      if (
        watchId !== null &&
        typeof remote.cancelWatchAvailability === "function"
      ) {
        remote.cancelWatchAvailability(watchId).catch(() => {});
      }
      remote.removeEventListener?.("connect", onConnect);
      remote.removeEventListener?.("disconnect", onDisconnect);
    };
  }, [src]);

  const handleCast = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.remote) return;
    try {
      if (typeof v.remote.prompt === "function") {
        await v.remote.prompt();
      }
    } catch {
      /* user dismissed cast prompt */
    }
  }, []);

  const canUsePictureInPicture =
    typeof document !== "undefined" &&
    typeof HTMLVideoElement !== "undefined" &&
    "requestPictureInPicture" in HTMLVideoElement.prototype &&
    document.pictureInPictureEnabled;

  const togglePictureInPicture = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !canUsePictureInPicture) return;
    try {
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
      setShowSettings(false);
    } catch {
      /* user denied or not allowed */
    }
  }, [canUsePictureInPicture]);

  // ── Playback rate ─────────────────────────────────────────────────────────

  const applyRate = useCallback(
    (rate: number, showToast = true) => {
      const v = videoRef.current;
      if (!v) return;
      v.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSettings(false);
      if (showToast) {
        triggerHudToast(`Speed ${rate}×`);
      }
    },
    [triggerHudToast],
  );

  // ── Auto-hide controls ────────────────────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (!hasStarted) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowSettings(false);
        setShowSubtitleMenu(false);
      }
    }, 3000);
  }, [hasStarted]);

  // ── Horizontal Scroll / Trackpad Scrubbing ────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasStarted || useNativeControls) return;

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("[data-player-menu]") ||
          target.closest("[data-volume-control]"))
      ) {
        return;
      }

      const isOverTimeline = Boolean(
        timelineRef.current &&
          target &&
          timelineRef.current.contains(target),
      );

      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      const isHorizontalScroll = absX > absY && absX > 1.5;
      const isShiftScroll = e.shiftKey && absY > 1.5;
      const isTimelineWheel = isOverTimeline && (absX > 1 || absY > 1);

      if (!isHorizontalScroll && !isShiftScroll && !isTimelineWheel) {
        return;
      }

      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;

      e.preventDefault();
      e.stopPropagation();

      const rawDelta =
        absX >= absY ? e.deltaX : e.shiftKey || isOverTimeline ? e.deltaY : 0;
      if (Math.abs(rawDelta) < 0.5) return;

      if (wheelScrubStartRef.current === null) {
        wheelScrubStartRef.current = v.currentTime;
        wheelScrubCurrentRef.current = v.currentTime;
      }

      // Smooth proportional scrub: ~0.15s per pixel of scroll delta, capped at ±12s per event
      const stepSeconds = Math.max(-12, Math.min(12, rawDelta * 0.14));
      const baseTime = wheelScrubCurrentRef.current ?? v.currentTime;
      const nextTime = Math.min(
        Math.max(0, baseTime + stepSeconds),
        v.duration,
      );

      wheelScrubCurrentRef.current = nextTime;
      v.currentTime = nextTime;
      setCurrentTime(nextTime);
      jellyfinLastPositionTicksRef.current = jellyfinSecondsToTicks(nextTime);

      const totalDelta = nextTime - (wheelScrubStartRef.current ?? nextTime);
      setWheelScrub({
        targetTime: nextTime,
        deltaSeconds: totalDelta,
      });
      requestPreviewFrame(nextTime);
      resetHideTimer();

      if (wheelScrubTimerRef.current) {
        clearTimeout(wheelScrubTimerRef.current);
      }
      wheelScrubTimerRef.current = setTimeout(() => {
        setWheelScrub(null);
        wheelScrubStartRef.current = null;
        wheelScrubCurrentRef.current = null;
      }, 650);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [hasStarted, useNativeControls, requestPreviewFrame, resetHideTimer]);

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasStarted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K": {
          e.preventDefault();
          if (e.repeat) {
            if (!isHoldSpeeding && videoRef.current && !videoRef.current.paused) {
              preHoldRateRef.current = playbackRate;
              videoRef.current.playbackRate = 2;
              setIsHoldSpeeding(true);
            }
            return;
          }
          togglePlay();
          resetHideTimer();
          break;
        }
        case "ArrowRight":
        case "l":
        case "L": {
          e.preventDefault();
          triggerSkipWithFeedback(10);
          resetHideTimer();
          break;
        }
        case "ArrowLeft":
        case "j":
        case "J": {
          e.preventDefault();
          triggerSkipWithFeedback(-10);
          resetHideTimer();
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          handleVolumeChange((muted ? 0 : volume) + 0.05, true);
          resetHideTimer();
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          handleVolumeChange((muted ? 0 : volume) - 0.05, true);
          resetHideTimer();
          break;
        }
        case "m":
        case "M": {
          e.preventDefault();
          toggleMute();
          break;
        }
        case "f":
        case "F": {
          e.preventDefault();
          void toggleFullscreen();
          break;
        }
        case "c":
        case "C": {
          if (hasSubtitles) {
            e.preventDefault();
            if (activeSubtitleIndex !== null) {
              applySubtitleTrack(null);
              triggerHudToast("Subtitles Off");
            } else {
              const targetTrack =
                availableSubtitles.find((s) => s.isDefault) ||
                availableSubtitles[0];
              if (targetTrack) {
                applySubtitleTrack(targetTrack.index);
                triggerHudToast(`Subtitles: ${targetTrack.label}`);
              }
            }
          }
          break;
        }
        case "p":
        case "P": {
          e.preventDefault();
          void togglePictureInPicture();
          break;
        }
        case "s":
        case "S": {
          e.preventDefault();
          captureScreenshot();
          break;
        }
        case ",":
        case "<": {
          e.preventDefault();
          stepFrame(-1);
          break;
        }
        case ".":
        case ">": {
          e.preventDefault();
          stepFrame(1);
          break;
        }
        case "1": {
          e.preventDefault();
          applyRate(1);
          break;
        }
        case "2": {
          e.preventDefault();
          applyRate(2);
          break;
        }
        case "?":
        case "/": {
          if (e.key === "?" || e.shiftKey) {
            e.preventDefault();
            setShowShortcutsModal((prev) => !prev);
          }
          break;
        }
        case "Escape": {
          if (showShortcutsModal) {
            e.preventDefault();
            setShowShortcutsModal(false);
          }
          break;
        }
        default: {
          if (/^[0-9]$/.test(e.key) && duration > 0) {
            e.preventDefault();
            const pct = parseInt(e.key, 10) * 10;
            const targetTime = (pct / 100) * duration;
            handleSeek(targetTime);
            triggerHudToast(`Jump to ${pct}%`, fmt(targetTime));
            resetHideTimer();
          }
          break;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "k" || e.key === "K") && isHoldSpeeding) {
        if (videoRef.current) {
          videoRef.current.playbackRate = preHoldRateRef.current;
        }
        setIsHoldSpeeding(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [
    hasStarted,
    isHoldSpeeding,
    playbackRate,
    muted,
    volume,
    hasSubtitles,
    activeSubtitleIndex,
    availableSubtitles,
    duration,
    showShortcutsModal,
    togglePlay,
    resetHideTimer,
    triggerSkipWithFeedback,
    handleVolumeChange,
    toggleMute,
    toggleFullscreen,
    applySubtitleTrack,
    triggerHudToast,
    togglePictureInPicture,
    captureScreenshot,
    stepFrame,
    applyRate,
    handleSeek,
  ]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onVolumeChange = () => {
      setVolume(v.volume);
      setMuted(v.muted);
      if (v.volume > 0.001) preMuteVolumeRef.current = v.volume;
    };
    const onPipEnter = () => setPipActive(true);
    const onPipLeave = () => setPipActive(false);
    v.addEventListener("volumechange", onVolumeChange);
    v.addEventListener("enterpictureinpicture", onPipEnter);
    v.addEventListener("leavepictureinpicture", onPipLeave);
    return () => {
      v.removeEventListener("volumechange", onVolumeChange);
      v.removeEventListener("enterpictureinpicture", onPipEnter);
      v.removeEventListener("leavepictureinpicture", onPipLeave);
    };
  }, [src]);

  // ── Wire up video events ──────────────────────────────────────────────────

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const getSession = () => {
      const { playbackInfo: info, jellyfinItemId: itemId } =
        playContextRef.current;
      const playSessionId = info?.PlaySessionId;
      const mediaSourceId = info?.MediaSources?.[0]?.Id;
      const ok = Boolean(playSessionId && itemId && mediaSourceId);
      return {
        ok,
        playSessionId,
        mediaSourceId,
        itemId,
      } as const;
    };

    const inferPlayMethod = (): "Transcode" | "DirectStream" | "DirectPlay" => {
      const url = playContextRef.current.src ?? "";
      if (
        url.includes(".m3u8") ||
        url.includes("/master") ||
        url.toLowerCase().includes("live")
      ) {
        return "Transcode";
      }
      return "DirectStream";
    };

    const basePayload = () => {
      const s = getSession();
      if (!s.ok) return null;
      return {
        PlaySessionId: s.playSessionId!,
        ItemId: s.itemId!,
        MediaSourceId: s.mediaSourceId!,
        PlayMethod: inferPlayMethod(),
      } as const;
    };

    const sendProgress = () => {
      const base = basePayload();
      if (!base) return;
      void jellyfinClient.reportPlaybackProgress({
        ...base,
        PositionTicks: jellyfinSecondsToTicks(v.currentTime),
        IsPaused: v.paused,
        IsMuted: v.muted,
        VolumeLevel: Math.round(v.volume * 100),
        CanSeek: Number.isFinite(v.duration) && v.duration > 0,
        SubtitleStreamIndex: activeSubtitleIndexRef.current,
      });
    };

    const sendStarted = () => {
      if (jellyfinStartedRef.current) return;
      const base = basePayload();
      if (!base) return;
      jellyfinStartedRef.current = true;
      activeJellyfinSessionRef.current = {
        playSessionId: base.PlaySessionId,
        itemId: base.ItemId,
        mediaSourceId: base.MediaSourceId,
      };
      void jellyfinClient.reportPlaybackStarted({
        ...base,
        PositionTicks: jellyfinSecondsToTicks(v.currentTime),
        IsPaused: v.paused,
        IsMuted: v.muted,
        VolumeLevel: Math.round(v.volume * 100),
        CanSeek: Number.isFinite(v.duration) && v.duration > 0,
        SubtitleStreamIndex: activeSubtitleIndexRef.current,
      });
    };

    const finalizeStop = (played: boolean) => {
      if (jellyfinStoppedRef.current) return;
      const base = basePayload();
      if (!base) return;
      jellyfinStoppedRef.current = true;
      activeJellyfinSessionRef.current = null;
      const currentTicks = jellyfinSecondsToTicks(v.currentTime);
      void jellyfinClient.reportPlaybackStopped({
        ...base,
        PositionTicks: currentTicks,
        Played: played,
      });

      if (played) {
        void jellyfinClient.markPlayedItem(base.ItemId);
      } else if (currentTicks > 0) {
        void jellyfinClient.updateItemUserData(base.ItemId, {
          PlaybackPositionTicks: currentTicks,
          Played: false,
        });
      }
    };

    const onPlay = () => {
      setPlaying(true);
      setIsBuffering(false);
      setHasStarted(true);
      sendStarted();
    };

    const onPlaying = () => {
      setIsBuffering(false);
    };

    const onWaiting = () => {
      setIsBuffering(true);
    };

    const onPause = () => {
      setPlaying(false);
      setIsBuffering(false);
      setShowControls(true);
      const currentTicks = jellyfinSecondsToTicks(v.currentTime);
      jellyfinLastPositionTicksRef.current = currentTicks;
      jellyfinLastProgressAtRef.current = Date.now();
      sendProgress();
      const s = getSession();
      if (s.ok && s.itemId) {
        void jellyfinClient.updateItemUserData(s.itemId, {
          PlaybackPositionTicks: currentTicks,
          Played: false,
        });
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      jellyfinLastPositionTicksRef.current = jellyfinSecondsToTicks(
        v.currentTime,
      );
      if (v.buffered.length) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
      if (v.paused) return;
      const now = Date.now();
      if (
        now - jellyfinLastProgressAtRef.current <
        progressIntervalRef.current
      ) {
        return;
      }
      jellyfinLastProgressAtRef.current = now;
      sendProgress();

      if (
        onNextEpisode &&
        !isNextCancelled &&
        !nextTriggeredRef.current &&
        v.duration > 15 &&
        v.duration - v.currentTime <= 0.4
      ) {
        nextTriggeredRef.current = true;
        onNextEpisode();
      }
    };

    const onSeeked = () => {
      setIsBuffering(false);
      jellyfinLastPositionTicksRef.current = jellyfinSecondsToTicks(
        v.currentTime,
      );
      jellyfinLastProgressAtRef.current = Date.now();
      sendProgress();
    };

    const onEnded = () => {
      jellyfinLastProgressAtRef.current = Date.now();
      finalizeStop(true);
      if (onNextEpisode && !isNextCancelled && !nextTriggeredRef.current) {
        nextTriggeredRef.current = true;
        onNextEpisode();
      }
    };

    const onLoaded = () => {
      setDuration(v.duration);
      tryApplyPendingResume();
    };
    const onCanPlay = () => {
      setIsBuffering(false);
      tryApplyPendingResume();
      if (autoPlay && v.paused) {
        v.play().catch(() => {
          v.muted = true;
          setMuted(true);
          v.play().catch(() => {
            setHasStarted(false);
          });
        });
      }
    };
    const onFsChange = () => {
      const doc = document as FullscreenDocument;
      const isFs = Boolean(
        doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          v.webkitDisplayingFullscreen,
      );
      setFullscreen(isFs);
    };

    const onWebkitBeginFs = () => {
      setFullscreen(true);
      setShowControls(true);
      v.controls = true;
    };

    const onWebkitEndFs = () => {
      setFullscreen(false);
      v.controls = useNativeControlsRef.current;
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("ended", onEnded);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("canplay", onCanPlay);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    v.addEventListener("webkitbeginfullscreen", onWebkitBeginFs);
    v.addEventListener("webkitendfullscreen", onWebkitEndFs);

    v.volume = volume;
    tryApplyPendingResume();
    if (autoPlay) {
      v.play().catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {
          setHasStarted(false);
        });
      });
    }

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("canplay", onCanPlay);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      v.removeEventListener("webkitbeginfullscreen", onWebkitBeginFs);
      v.removeEventListener("webkitendfullscreen", onWebkitEndFs);
      if (hideTimer.current) clearTimeout(hideTimer.current);

      const played =
        v.duration > 0 && v.currentTime / v.duration >= 0.9 ? true : false;
      finalizeStop(played);
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable Jellyfin handlers + resume apply
  }, [tryApplyPendingResume]);

  // ── Seek & Timeline Hover / Dragging ──────────────────────────────────────

  const getTimelineMetricsFromPointer = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || !duration) return { time: 0, pct: 0 };
      const rect = timelineRef.current.getBoundingClientRect();
      if (rect.width <= 0) return { time: 0, pct: 0 };
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return {
        time: ratio * duration,
        pct: ratio * 100,
      };
    },
    [duration],
  );

  const onTimelinePointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setIsDraggingTimeline(true);
    const { time: newTime, pct } = getTimelineMetricsFromPointer(e.clientX);
    setDragTime(newTime);
    setHoverTime(newTime);
    setHoverPct(pct);
    requestPreviewFrame(newTime);
    const v = videoRef.current;
    if (v) {
      v.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const onTimelinePointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const { time: newTime, pct } = getTimelineMetricsFromPointer(e.clientX);
    setHoverTime(newTime);
    setHoverPct(pct);
    requestPreviewFrame(newTime);

    if (isDraggingTimeline) {
      e.stopPropagation();
      setDragTime(newTime);
      const v = videoRef.current;
      if (v) {
        v.currentTime = newTime;
        setCurrentTime(newTime);
      }
    }
  };

  const onTimelinePointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!isDraggingTimeline) return;
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    const finalTime =
      dragTime ?? getTimelineMetricsFromPointer(e.clientX).time;
    handleSeek(finalTime);
    setIsDraggingTimeline(false);
    setDragTime(null);
  };

  const onTimelinePointerLeave = () => {
    if (!isDraggingTimeline) {
      setHoverTime(null);
      activePreviewTimeRef.current = null;
    }
  };

  const displayTime =
    isDraggingTimeline && dragTime !== null ? dragTime : (currentTime ?? 0);
  const progressPct = duration ? (displayTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  // Estimate finish clock time when viewing remaining time
  const finishClockTime = useMemo(() => {
    if (!duration || displayTime >= duration) return null;
    const remainingMs = ((duration - displayTime) / (playbackRate || 1)) * 1000;
    const finishDate = new Date(Date.now() + remainingMs);
    return finishDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }, [duration, displayTime, playbackRate]);

  // ── Auto-advance countdown (10s remaining) ─────────────────────────────────

  const timeLeft = duration > 0 ? duration - (currentTime ?? 0) : 999;
  const isWithinNextWindow =
    Boolean(onNextEpisode) &&
    duration > 15 &&
    timeLeft <= 10 &&
    timeLeft >= 0;
  const showNextPopup = isWithinNextWindow && !isNextCancelled;
  const secondsLeft = Math.max(0, Math.ceil(timeLeft));

  const handleTriggerNext = useCallback(() => {
    if (onNextEpisode && !nextTriggeredRef.current) {
      nextTriggeredRef.current = true;
      onNextEpisode();
    }
  }, [onNextEpisode]);

  const handleCancelNext = useCallback(() => {
    setIsNextCancelled(true);
  }, []);

  const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const containerClasses = fullscreen
    ? "w-screen h-screen flex items-center justify-center"
    : `${aspectRatio} ${className}`;
  const frameClasses = fullscreen
    ? "relative w-full max-h-full max-w-[calc(100vh*16/9)] aspect-video"
    : "relative w-full h-full";

  // ── Surface Pointer Interactions (Double-tap ±10s & Hold for 2× Speed) ────

  const getTapRegion = (e: RPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.32) return "left";
    if (x > rect.width * 0.68) return "right";
    return "center";
  };

  const handleSurfacePointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!hasStarted || e.button > 0) return;
    wasHoldSpeedingRef.current = false;
    if (holdSpeedTimerRef.current) clearTimeout(holdSpeedTimerRef.current);

    holdSpeedTimerRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) {
        wasHoldSpeedingRef.current = true;
        preHoldRateRef.current = playbackRate;
        v.playbackRate = 2;
        setIsHoldSpeeding(true);
      }
    }, 420);
  };

  const clearHoldSpeed = () => {
    if (holdSpeedTimerRef.current) {
      clearTimeout(holdSpeedTimerRef.current);
      holdSpeedTimerRef.current = null;
    }
    if (isHoldSpeeding) {
      const v = videoRef.current;
      if (v) {
        v.playbackRate = preHoldRateRef.current;
      }
      setIsHoldSpeeding(false);
    }
  };

  const handleInteractionTap = (e: RPointerEvent<HTMLDivElement>) => {
    if (!hasStarted || e.button > 0) return;

    if (holdSpeedTimerRef.current) {
      clearTimeout(holdSpeedTimerRef.current);
      holdSpeedTimerRef.current = null;
    }

    if (wasHoldSpeedingRef.current || isHoldSpeeding) {
      clearHoldSpeed();
      wasHoldSpeedingRef.current = false;
      return;
    }

    const region = getTapRegion(e);

    // If skip ripple is already active on this side, accumulate another 10s immediately on single tap!
    if (
      skipFeedback &&
      ((region === "left" && skipFeedback.side === "left") ||
        (region === "right" && skipFeedback.side === "right"))
    ) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRegionRef.current = null;
      triggerSkipWithFeedback(region === "left" ? -10 : 10);
      resetHideTimer();
      return;
    }

    // Second tap within 260ms in the same region -> Double Tap!
    if (tapTimerRef.current && lastTapRegionRef.current === region) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      lastTapRegionRef.current = null;
      if (region === "left") {
        triggerSkipWithFeedback(-10);
      } else if (region === "right") {
        triggerSkipWithFeedback(10);
      } else {
        void toggleFullscreen();
      }
      resetHideTimer();
      return;
    }

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    lastTapRegionRef.current = region;
    const isMouse = e.pointerType === "mouse";

    tapTimerRef.current = setTimeout(() => {
      if (showSettings || showSubtitleMenu || showShortcutsModal) {
        setShowSettings(false);
        setShowSubtitleMenu(false);
        setShowShortcutsModal(false);
      } else if (isMouse) {
        togglePlay();
        resetHideTimer();
      } else {
        setShowControls((prev) => {
          const next = !prev;
          if (next) resetHideTimer();
          return next;
        });
      }
      tapTimerRef.current = null;
      lastTapRegionRef.current = null;
    }, 250);
  };

  // Clamped horizontal position for the timeline hover preview card
  const clampedPreviewLeftPct = Math.max(12, Math.min(88, hoverPct));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      data-subtitle-size={subtitleSize}
      style={{
        ["--subtitle-font-size" as string]: SUBTITLE_SIZE_VALUES[subtitleSize],
      }}
      className={`relative select-none bg-black overflow-hidden shadow-2xl ${containerClasses}`}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        clearHoldSpeed();
        if (playing) {
          setShowControls(false);
          setShowSettings(false);
          setShowSubtitleMenu(false);
        }
      }}
    >
      <div className={frameClasses}>
        {/* ── Main Video Element ── */}
        <video
          ref={videoRef}
          data-subtitle-size={subtitleSize}
          style={{
            ["--subtitle-font-size" as string]:
              SUBTITLE_SIZE_VALUES[subtitleSize],
          }}
          src={src}
          poster={poster}
          loop={loop}
          autoPlay={autoPlay}
          playsInline
          crossOrigin="anonymous"
          controls={useNativeControls}
          preload="auto"
          className="w-full h-full object-cover cursor-pointer"
        >
          {availableSubtitles.map((track) => (
            <track
              key={track.id}
              kind="subtitles"
              label={track.label}
              srcLang={track.language || "und"}
              src={track.src}
              default={activeSubtitleIndex === track.index}
            />
          ))}
        </video>

        {/* ── Hidden Offscreen Video for Hover & Scrub Frame Extraction ── */}
        {src && !useNativeControls && (
          <video
            ref={previewVideoRef}
            src={src}
            muted
            playsInline
            crossOrigin="anonymous"
            preload="metadata"
            className="hidden pointer-events-none"
            aria-hidden
          />
        )}

        {/* ── Screenshot Shutter Flash ── */}
        <AnimatePresence>
          {shutterFlash && (
            <motion.div
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 z-50 bg-white pointer-events-none"
            />
          )}
        </AnimatePresence>

        {useNativeControls && (
          <div className="absolute top-3 right-3 z-30">
            <Button
              size="sm"
              variant="primary"
              className="text-xs bg-black/75 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 rounded-full px-3 py-1 shadow-lg cursor-pointer"
              onPress={() => setUseNativeControls(false)}
            >
              Use Custom Player
            </Button>
          </div>
        )}

        {/* ── Interactive Surface Overlay (Tap, Double-Tap ±10s, Hold 2×) ── */}
        {hasStarted && !useNativeControls ? (
          <div
            className="absolute inset-0 z-10 pointer-events-auto"
            onPointerDown={handleSurfacePointerDown}
            onPointerUp={handleInteractionTap}
            onPointerCancel={clearHoldSpeed}
            aria-hidden
          />
        ) : null}

        {/* ── Initial Play Button before playback starts ── */}
        {!hasStarted && !useNativeControls && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55">
            <Button
              variant="primary"
              size="lg"
              className="h-16 w-16 min-w-0 rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
              isIconOnly
              onPress={() => {
                setShowControls(true);
                void videoRef.current?.play();
              }}
              aria-label="Play video"
            >
              <PlayIcon />
            </Button>
          </div>
        )}

        {/* ── Buffering Spinner ── */}
        <AnimatePresence>
          {isBuffering && hasStarted && !useNativeControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            >
              <div className="rounded-full bg-black/50 p-4 backdrop-blur-sm">
                <Spinner size="lg" color="accent" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Top-Center Transient HUD Pill (2× Hold Speed / Volume / Toast) ── */}
        <AnimatePresence>
          {isHoldSpeeding && (
            <motion.div
              key="hold-speed-badge"
              initial={{ opacity: 0, y: -12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center gap-1.5 rounded-full bg-black/75 border border-white/15 px-3.5 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur-md"
            >
              <span>2× Speed</span>
              <MdFastForward className="size-4 text-accent animate-pulse" />
            </motion.div>
          )}
          {!isHoldSpeeding && hudToast && (
            <motion.div
              key={hudToast.key}
              initial={{ opacity: 0, y: -10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.92 }}
              transition={{ duration: 0.15 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center gap-2 rounded-full bg-black/75 border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
            >
              <span>{hudToast.text}</span>
              {hudToast.subtext && (
                <span className="text-white/60 font-mono text-[11px]">
                  {hudToast.subtext}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Double-Tap Left / Right Skip 10s Ripple Overlay ── */}
        <AnimatePresence>
          {skipFeedback && (
            <motion.div
              key={`${skipFeedback.side}-${skipFeedback.key}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`absolute inset-y-0 z-30 flex items-center justify-center pointer-events-none w-1/3 ${
                skipFeedback.side === "left"
                  ? "left-0 rounded-r-full bg-gradient-to-r from-white/20 via-white/10 to-transparent"
                  : "right-0 rounded-l-full bg-gradient-to-l from-white/20 via-white/10 to-transparent"
              }`}
            >
              <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-black/65 px-5 py-3.5 text-white shadow-2xl backdrop-blur-md border border-white/15">
                {skipFeedback.side === "left" ? (
                  <MdReplay10 className="size-8 text-accent" />
                ) : (
                  <MdForward10 className="size-8 text-accent" />
                )}
                <span className="text-xs font-bold tracking-wide tabular-nums">
                  {skipFeedback.side === "left"
                    ? `-${skipFeedback.seconds} seconds`
                    : `+${skipFeedback.seconds} seconds`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Horizontal Scroll Scrubbing HUD Overlay ── */}
        <AnimatePresence>
          {wheelScrub && (
            <motion.div
              key="wheel-scrub-hud"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.15 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none flex flex-col items-center gap-2 rounded-2xl border border-white/20 bg-zinc-950/90 p-3 text-white shadow-2xl backdrop-blur-md"
            >
              {previewDataUrl && (
                <div className="w-44 sm:w-52 aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/10">
                  <img
                    src={previewDataUrl}
                    alt="Scrub preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 text-sm font-bold tabular-nums">
                <span>{fmt(wheelScrub.targetTime)}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                    wheelScrub.deltaSeconds >= 0
                      ? "bg-accent/20 text-accent"
                      : "bg-white/15 text-white/90"
                  }`}
                >
                  {fmtDelta(wheelScrub.deltaSeconds)}
                </span>
                <span className="text-white/45 text-xs font-normal">
                  / {fmt(duration)}
                </span>
              </div>
              <div className="w-44 sm:w-52 h-1 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{
                    width: `${duration ? (wheelScrub.targetTime / duration) * 100 : 0}%`,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Centre flash on play/pause ── */}
        <AnimatePresence>
          {showCenterFlash && hasStarted && !useNativeControls && (
            <motion.div
              key="flash"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 1.3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 text-white">
                {playing ? <PauseIcon /> : <PlayIcon />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Center Play/Pause & Quick Skip Overlay (when controls visible) ── */}
        <AnimatePresence>
          {hasStarted &&
            showControls &&
            !useNativeControls &&
            !wheelScrub &&
            !showShortcutsModal && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-20 flex items-center justify-center gap-6 sm:gap-10 pointer-events-none"
              >
                <Button
                  variant="ghost"
                  isIconOnly
                  size="lg"
                  onPress={() => {
                    triggerSkipWithFeedback(-10);
                    resetHideTimer();
                  }}
                  aria-label="Rewind 10 seconds"
                  className="h-12 w-12 min-w-0 rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 hover:scale-105 transition-transform pointer-events-auto cursor-pointer"
                >
                  <MdReplay10 className="size-6" />
                </Button>

                <Button
                  variant="primary"
                  isIconOnly
                  size="lg"
                  onPress={togglePlay}
                  aria-label={playing ? "Pause video" : "Play video"}
                  className="h-16 w-16 min-w-0 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:scale-105 transition-transform pointer-events-auto cursor-pointer"
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </Button>

                <Button
                  variant="ghost"
                  isIconOnly
                  size="lg"
                  onPress={() => {
                    triggerSkipWithFeedback(10);
                    resetHideTimer();
                  }}
                  aria-label="Forward 10 seconds"
                  className="h-12 w-12 min-w-0 rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 hover:scale-105 transition-transform pointer-events-auto cursor-pointer"
                >
                  <MdForward10 className="size-6" />
                </Button>
              </motion.div>
            )}
        </AnimatePresence>

        {/* ── Top metadata bar ── */}
        <AnimatePresence>
          {hasStarted &&
            showControls &&
            !useNativeControls &&
            (title || subtitle) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="absolute z-30 top-0 inset-x-0 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-5 pt-4 pb-8 flex items-start gap-3 pointer-events-none"
              >
                <div className="flex-1 min-w-0">
                  {title && (
                    <p className="text-white font-semibold text-sm leading-tight truncate">
                      {title}
                    </p>
                  )}
                  {subtitle && (
                    <p className="text-white/60 text-xs mt-0.5 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
                {playbackRate !== 1 && (
                  <Chip className="bg-accent/25 text-accent border border-accent/40 text-[11px] font-semibold shrink-0 pointer-events-auto">
                    {playbackRate}×
                  </Chip>
                )}
                <Chip className="bg-white/10 text-white/80 text-[11px] shrink-0 pointer-events-auto">
                  HD
                </Chip>
              </motion.div>
            )}
        </AnimatePresence>

        {/* ── Floating "Skip Opening (+85s)" Pill during first 3 minutes ── */}
        <AnimatePresence>
          {hasStarted &&
            showControls &&
            !useNativeControls &&
            duration > 180 &&
            currentTime >= 5 &&
            currentTime <= 160 && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-16 right-4 z-30"
              >
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    triggerSkipWithFeedback(85);
                    resetHideTimer();
                  }}
                  className="bg-black/75 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md rounded-xl px-3 py-1.5 text-xs font-semibold shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <MdFastForward className="size-4 text-accent" />
                  Skip OP (+85s)
                </Button>
              </motion.div>
            )}
        </AnimatePresence>

        {/* ── Bottom controls overlay ── */}
        <AnimatePresence>
          {hasStarted && showControls && !useNativeControls && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="absolute z-30 bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pt-10 pb-3"
            >
              {/* ── Seekable timeline with Live Frame & Subtitle Hover Preview ── */}
              <div
                ref={timelineRef}
                className="relative w-full py-2.5 -my-2.5 flex items-center cursor-pointer mb-2 group/bar touch-none select-none"
                onPointerDown={onTimelinePointerDown}
                onPointerMove={onTimelinePointerMove}
                onPointerUp={onTimelinePointerUp}
                onPointerCancel={onTimelinePointerUp}
                onPointerLeave={onTimelinePointerLeave}
              >
                {/* Hover Preview Thumbnail Card */}
                <AnimatePresence>
                  {hoverTime !== null && duration > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.94 }}
                      transition={{ duration: 0.12 }}
                      style={{ left: `${clampedPreviewLeftPct}%` }}
                      className="absolute bottom-7 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center"
                    >
                      <div className="w-44 sm:w-52 rounded-xl overflow-hidden border border-white/25 bg-zinc-950/95 shadow-2xl backdrop-blur-md flex flex-col">
                        <div className="relative w-full aspect-video bg-zinc-900 overflow-hidden flex items-center justify-center">
                          {previewDataUrl ? (
                            <img
                              src={previewDataUrl}
                              alt={`Preview at ${fmt(hoverTime)}`}
                              className="w-full h-full object-cover"
                            />
                          ) : poster ? (
                            <img
                              src={poster}
                              alt={title || "Preview"}
                              className="w-full h-full object-cover opacity-60 blur-[1px]"
                            />
                          ) : (
                            <div className="text-[11px] text-white/40 font-medium">
                              Loading preview...
                            </div>
                          )}

                          {/* Subtitle cue snippet at hovered timestamp */}
                          {previewCueText && (
                            <div className="absolute bottom-1.5 inset-x-1.5 bg-black/80 backdrop-blur-xs rounded px-1.5 py-0.5 text-[10px] leading-snug text-white text-center line-clamp-2 font-medium shadow">
                              {previewCueText}
                            </div>
                          )}
                        </div>

                        <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-semibold tabular-nums bg-zinc-950/90 border-t border-white/10">
                          <span className="text-white">{fmt(hoverTime)}</span>
                          <span
                            className={`text-[10px] font-medium ${
                              hoverTime - displayTime >= 0
                                ? "text-accent"
                                : "text-white/60"
                            }`}
                          >
                            {fmtDelta(hoverTime - displayTime)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Track Background */}
                <div className="relative w-full h-1.5 group-hover/bar:h-2.5 rounded-full bg-white/20 transition-all overflow-hidden">
                  {/* Buffered bar */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-[width]"
                    style={{ width: `${bufferedPct}%` }}
                  />
                  {/* Hover ghost bar */}
                  {hoverTime !== null && (
                    <div
                      className="absolute inset-y-0 left-0 bg-white/35 pointer-events-none"
                      style={{ width: `${hoverPct}%` }}
                    />
                  )}
                  {/* Active playback progress bar */}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full bg-accent ${
                      isDraggingTimeline ? "" : "transition-[width] duration-75"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Hover vertical indicator tick */}
                {hoverTime !== null && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-3.5 bg-white/80 rounded-full pointer-events-none"
                    style={{ left: `${hoverPct}%` }}
                  />
                )}

                {/* Scrubber Thumb */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-accent shadow-lg pointer-events-none transition-transform ${
                    isDraggingTimeline
                      ? "opacity-100 scale-125 ring-2 ring-white/60"
                      : "opacity-0 group-hover/bar:opacity-100 group-hover/bar:scale-110"
                  }`}
                  style={{ left: `${progressPct}%` }}
                />
              </div>

              {/* ── Button / slider row ── */}
              <div className="flex items-center gap-1">
                {/* Play / Pause */}
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={togglePlay}
                      className="text-white hover:bg-white/10 rounded-lg cursor-pointer"
                      aria-label={playing ? "Pause" : "Play"}
                    >
                      {playing ? <PauseIcon /> : <PlayIcon />}
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">
                    {playing ? "Pause (K)" : "Play (K)"}
                  </Tooltip.Content>
                </Tooltip>

                {/* Rewind 10s */}
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={() => triggerSkipWithFeedback(-10)}
                      className="text-white hover:bg-white/10 rounded-lg cursor-pointer"
                      aria-label="Rewind 10 seconds"
                    >
                      <MdReplay10 className="size-5" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">
                    Rewind 10s (←)
                  </Tooltip.Content>
                </Tooltip>

                {/* Forward 10s */}
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={() => triggerSkipWithFeedback(10)}
                      className="text-white hover:bg-white/10 rounded-lg cursor-pointer"
                      aria-label="Forward 10 seconds"
                    >
                      <MdForward10 className="size-5" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">
                    Forward 10s (→)
                  </Tooltip.Content>
                </Tooltip>

                {/* Next Episode button (when available) */}
                {onNextEpisode && (
                  <Tooltip delay={400}>
                    <Tooltip.Trigger>
                      <Button
                        variant="ghost"
                        isIconOnly
                        size="sm"
                        onPress={handleTriggerNext}
                        className="text-white hover:bg-white/10 rounded-lg cursor-pointer hidden sm:inline-flex"
                        aria-label="Next episode"
                      >
                        <MdSkipNext className="size-5" />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="top">
                      {nextEpisodeTitle
                        ? `Next: ${nextEpisodeTitle}`
                        : "Next Episode"}
                    </Tooltip.Content>
                  </Tooltip>
                )}

                {/* Mute toggle */}
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={toggleMute}
                      className="text-white hover:bg-white/10 rounded-lg cursor-pointer"
                      aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
                    >
                      <VolumeIcon muted={muted} vol={volume} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">
                    {muted || volume === 0 ? "Unmute (M)" : "Mute (M)"}
                  </Tooltip.Content>
                </Tooltip>

                {/* Volume Slider */}
                <div
                  data-volume-control
                  className="group/vol mx-1 flex items-center py-2 cursor-pointer select-none"
                  onWheel={onVolumeWheel}
                  title={`Volume: ${Math.round((muted ? 0 : volume) * 100)}%`}
                >
                  <div
                    ref={volumeBarRef}
                    onPointerDown={onVolumePointerDown}
                    onPointerMove={onVolumePointerMove}
                    onPointerUp={onVolumePointerUp}
                    onPointerCancel={onVolumePointerUp}
                    className="w-16 sm:w-22 h-6 flex items-center touch-none relative"
                  >
                    <div className="w-full h-1.5 rounded-full bg-white/30 group-hover/vol:h-2 transition-all relative overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-[width] duration-75"
                        style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                      />
                    </div>
                    <div
                      className="absolute size-3 rounded-full bg-white shadow-md top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none group-hover/vol:scale-110 transition-transform"
                      style={{ left: `${(muted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Clickable Timestamp (toggles total duration vs remaining & finish time) */}
                <button
                  type="button"
                  onClick={() => setShowRemainingTime((prev) => !prev)}
                  className="text-white/80 hover:text-white text-xs tabular-nums ml-1 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                  title="Click to toggle remaining time"
                >
                  {fmt(displayTime)}{" "}
                  <span className="text-white/45">
                    /{" "}
                    {showRemainingTime
                      ? `-${fmt(Math.max(0, duration - displayTime))}${
                          finishClockTime ? ` • Ends ${finishClockTime}` : ""
                        }`
                      : fmt(duration)}
                  </span>
                </button>

                <div className="flex-1" />

                {/* Skip +85s quick button */}
                {duration > 120 && (
                  <Tooltip delay={400}>
                    <Tooltip.Trigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => triggerSkipWithFeedback(85)}
                        className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg px-2 h-8 text-[11px] font-semibold hidden md:inline-flex cursor-pointer"
                        aria-label="Skip forward 85 seconds"
                      >
                        +85s
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="top">
                      Skip Opening (+85s)
                    </Tooltip.Content>
                  </Tooltip>
                )}

                {/* Screenshot button */}
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={captureScreenshot}
                      className="text-white hover:bg-white/10 rounded-lg hidden sm:inline-flex cursor-pointer"
                      aria-label="Take screenshot"
                    >
                      <MdCameraAlt className="size-4" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">
                    Screenshot (S)
                  </Tooltip.Content>
                </Tooltip>

                {/* AirPlay */}
                {isAirPlayAvailable ? (
                  <Tooltip delay={400}>
                    <Tooltip.Trigger>
                      <Button
                        variant="ghost"
                        isIconOnly
                        size="sm"
                        onPress={handleAirPlay}
                        className={`rounded-lg transition-colors cursor-pointer ${
                          isAirPlayConnected
                            ? "text-blue-400 hover:bg-blue-400/20"
                            : "text-white hover:bg-white/10"
                        }`}
                        aria-label={
                          isAirPlayConnected
                            ? "Connected to AirPlay"
                            : "AirPlay"
                        }
                      >
                        <AirplayIcon />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="top">
                      {isAirPlayConnected ? "AirPlay (Connected)" : "AirPlay"}
                    </Tooltip.Content>
                  </Tooltip>
                ) : null}

                {/* Cast */}
                {isCastAvailable ? (
                  <Tooltip delay={400}>
                    <Tooltip.Trigger>
                      <Button
                        variant="ghost"
                        isIconOnly
                        size="sm"
                        onPress={() => void handleCast()}
                        className={`rounded-lg transition-colors cursor-pointer ${
                          isCastConnected
                            ? "text-blue-400 hover:bg-blue-400/20"
                            : "text-white hover:bg-white/10"
                        }`}
                        aria-label={
                          isCastConnected
                            ? "Connected to Cast"
                            : "Cast to screen"
                        }
                      >
                        <CastIcon connected={isCastConnected} />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="top">
                      {isCastConnected ? "Cast (Connected)" : "Cast"}
                    </Tooltip.Content>
                  </Tooltip>
                ) : null}

                {/* Subtitles (CC) toggle / selection */}
                {hasSubtitles && (
                  <div className="relative" data-player-menu>
                    <Tooltip delay={400}>
                      <Tooltip.Trigger>
                        <Button
                          variant="ghost"
                          isIconOnly
                          size="sm"
                          onPress={handleSubtitleButtonClick}
                          className={`rounded-lg transition-colors cursor-pointer ${
                            activeSubtitleIndex !== null
                              ? "text-accent hover:bg-accent/20"
                              : "text-white hover:bg-white/10"
                          }`}
                          aria-label={
                            activeSubtitleIndex !== null
                              ? "Disable subtitles"
                              : "Enable subtitles"
                          }
                        >
                          {activeSubtitleIndex !== null ? (
                            <MdSubtitles className="size-5" />
                          ) : (
                            <MdSubtitlesOff className="size-5" />
                          )}
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content placement="top">
                        {activeSubtitleIndex !== null
                          ? `Subtitles: ${activeSubtitleLabel || "On"} (C)`
                          : "Subtitles Off (C)"}
                      </Tooltip.Content>
                    </Tooltip>

                    <AnimatePresence>
                      {showSubtitleMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: 6 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-10 right-0 z-50 min-w-[150px] max-w-[220px] rounded-xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-md"
                        >
                          <div className="space-y-1 px-1">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-white/45 mb-1.5">
                              Subtitles
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                applySubtitleTrack(null);
                                setShowSubtitleMenu(false);
                              }}
                              className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                                activeSubtitleIndex === null
                                  ? "bg-white/15 text-white font-medium"
                                  : "text-white/70 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              <span>Off</span>
                              {activeSubtitleIndex === null && (
                                <BiCheck className="size-4 text-accent shrink-0" />
                              )}
                            </button>
                            {availableSubtitles.map((track) => (
                              <button
                                key={track.id}
                                type="button"
                                onClick={() => {
                                  applySubtitleTrack(track.index);
                                  setShowSubtitleMenu(false);
                                }}
                                className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                                  activeSubtitleIndex === track.index
                                    ? "bg-white/15 text-white font-medium"
                                    : "text-white/70 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <span className="truncate mr-2">
                                  {track.label}
                                </span>
                                {activeSubtitleIndex === track.index && (
                                  <BiCheck className="size-4 text-accent shrink-0" />
                                )}
                              </button>
                            ))}

                            <div className="pt-2 mt-1.5 border-t border-white/10 space-y-1">
                              <p className="text-[10px] font-medium uppercase tracking-widest text-white/45 mb-1">
                                Size
                              </p>
                              <div className="grid grid-cols-5 gap-1">
                                {subtitleSizeOptions.map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setSubtitleSize(opt.id)}
                                    className={`px-1 py-1 text-[11px] font-semibold rounded transition-colors text-center cursor-pointer ${
                                      subtitleSize === opt.id
                                        ? "bg-accent text-accent-foreground shadow-xs"
                                        : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                                    }`}
                                    title={`${opt.label} (${opt.desc})`}
                                  >
                                    {opt.shortLabel}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Keyboard Shortcuts Button */}
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={() => {
                        setShowShortcutsModal((prev) => !prev);
                        setShowSettings(false);
                        setShowSubtitleMenu(false);
                      }}
                      className={`rounded-lg hidden sm:inline-flex cursor-pointer ${
                        showShortcutsModal
                          ? "text-accent bg-accent/15"
                          : "text-white hover:bg-white/10"
                      }`}
                      aria-label="Keyboard shortcuts"
                    >
                      <MdKeyboard className="size-5" />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">
                    Shortcuts (?)
                  </Tooltip.Content>
                </Tooltip>

                {/* Playback speed & player mode settings */}
                <div className="relative" data-player-menu>
                  <Tooltip delay={400}>
                    <Tooltip.Trigger>
                      <Button
                        variant="ghost"
                        isIconOnly
                        size="sm"
                        onPress={() => {
                          setShowSettings((s) => !s);
                          setShowSubtitleMenu(false);
                          setShowShortcutsModal(false);
                        }}
                        className="text-white hover:bg-white/10 rounded-lg cursor-pointer"
                        aria-label="Player settings"
                      >
                        <SettingsIcon />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="top">Settings</Tooltip.Content>
                  </Tooltip>

                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-10 right-0 z-50 min-w-[160px] rounded-xl border border-white/10 bg-zinc-900/95 p-2.5 shadow-xl backdrop-blur-md"
                      >
                        <div className="space-y-2.5 px-1 w-44">
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-white/45">
                              Playback Speed
                            </p>
                            <div className="grid grid-cols-3 gap-1">
                              {rates.map((r) => (
                                <button
                                  key={String(r)}
                                  type="button"
                                  onClick={() => applyRate(r)}
                                  className={`px-1.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                                    playbackRate === r
                                      ? "bg-accent text-accent-foreground"
                                      : "bg-white/10 text-white/75 hover:bg-white/20 hover:text-white"
                                  }`}
                                >
                                  {r}×
                                </button>
                              ))}
                            </div>
                          </div>

                          {hasSubtitles && (
                            <div className="pt-2 border-t border-white/10 space-y-1">
                              <p className="text-[10px] font-medium uppercase tracking-widest text-white/45">
                                Subtitles
                              </p>
                              <select
                                aria-label="Subtitles"
                                value={
                                  activeSubtitleIndex === null
                                    ? "off"
                                    : String(activeSubtitleIndex)
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "off") {
                                    applySubtitleTrack(null);
                                  } else {
                                    applySubtitleTrack(parseInt(val, 10));
                                  }
                                }}
                                className="h-8 w-full min-h-0 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white outline-none"
                              >
                                <option value="off" className="bg-zinc-900">
                                  Off
                                </option>
                                {availableSubtitles.map((track) => (
                                  <option
                                    key={track.id}
                                    value={String(track.index)}
                                    className="bg-zinc-900"
                                  >
                                    {track.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="pt-2 border-t border-white/10 space-y-1">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-white/45">
                              Subtitle Size
                            </p>
                            <select
                              aria-label="Subtitle Size"
                              value={subtitleSize}
                              onChange={(e) =>
                                setSubtitleSize(e.target.value as SubtitleSize)
                              }
                              className="h-8 w-full min-h-0 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white outline-none cursor-pointer"
                            >
                              {subtitleSizeOptions.map((opt) => (
                                <option
                                  key={opt.id}
                                  value={opt.id}
                                  className="bg-zinc-900"
                                >
                                  {opt.label} ({opt.desc})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="pt-2 border-t border-white/10 space-y-1">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-white/45">
                              Player Mode
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setUseNativeControls((prev) => !prev);
                                setShowSettings(false);
                              }}
                              className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors flex items-center justify-between text-white cursor-pointer"
                            >
                              <span>Default Player</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  useNativeControls
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-white/10 text-white/50"
                                }`}
                              >
                                {useNativeControls ? "ON" : "OFF"}
                              </span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Picture-in-Picture */}
                {canUsePictureInPicture ? (
                  <Tooltip delay={400}>
                    <Tooltip.Trigger>
                      <Button
                        variant="ghost"
                        isIconOnly
                        size="sm"
                        onPress={() => void togglePictureInPicture()}
                        className="text-white hover:bg-white/10 rounded-lg cursor-pointer"
                        aria-label={
                          pipActive
                            ? "Close picture-in-picture"
                            : "Picture in picture"
                        }
                      >
                        <PopOutIcon />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="top">
                      {pipActive ? "Close mini player (P)" : "Mini player (P)"}
                    </Tooltip.Content>
                  </Tooltip>
                ) : null}

                {/* Fullscreen */}
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={toggleFullscreen}
                      className="text-white hover:bg-white/10 rounded-lg cursor-pointer"
                      aria-label={
                        fullscreen ? "Exit fullscreen" : "Fullscreen"
                      }
                    >
                      <FullscreenIcon active={fullscreen} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">
                    {fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Keyboard Shortcuts & Gestures Help Overlay ── */}
        <AnimatePresence>
          {showShortcutsModal && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              data-player-menu
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              onClick={() => setShowShortcutsModal(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-900/95 p-5 text-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <MdKeyboard className="size-5 text-accent" />
                    <h4 className="text-sm font-bold">
                      Player Controls & Shortcuts
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShortcutsModal(false)}
                    className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <BiX className="size-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {[
                    ["Play / Pause", "Space / K"],
                    ["Rewind 10s", "← / J / Dbl-Tap L"],
                    ["Forward 10s", "→ / L / Dbl-Tap R"],
                    ["Scrub Timeline", "Scroll Left / Right"],
                    ["Hold 2× Speed", "Hold Space / Click"],
                    ["Volume Up / Down", "↑ / ↓"],
                    ["Mute / Unmute", "M"],
                    ["Fullscreen", "F / Dbl-Tap Center"],
                    ["Subtitles On/Off", "C"],
                    ["Frame Step", ", / . (Paused)"],
                    ["Screenshot", "S"],
                    ["Jump 0%–90%", "0 – 9"],
                  ].map(([label, shortcut]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-1 border-b border-white/5"
                    >
                      <span className="text-white/70">{label}</span>
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white/10 text-white rounded border border-white/15">
                        {shortcut}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Auto-advance Next Video Popup (final 10 seconds) ── */}
        <AnimatePresence>
          {showNextPopup && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-16 sm:bottom-20 right-3 sm:right-5 z-40 max-w-[calc(100%-1.5rem)] sm:max-w-xs w-80 rounded-2xl border border-white/20 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-md text-white select-none"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5 mb-0.5">
                    <span className="size-2 rounded-full bg-accent animate-pulse" />
                    Up Next in {secondsLeft}s
                  </span>
                  <h5 className="text-sm font-bold truncate">
                    {nextEpisodeTitle || "Next Video"}
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={handleCancelNext}
                  className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  aria-label="Cancel next video"
                  title="Cancel auto-play"
                >
                  <BiX className="size-5" />
                </button>
              </div>

              <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-accent transition-[width] duration-300 ease-linear rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, ((10 - timeLeft) / 10) * 100))}%`,
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1 font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  onPress={handleTriggerNext}
                >
                  <BiPlay className="size-4" /> Start Next Video
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/70 hover:text-white cursor-pointer text-xs"
                  onPress={handleCancelNext}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VideoPlayer;
