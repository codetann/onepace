/**
 * VideoPlayer.tsx — Custom Video Component with HeroUI v3
 *
 * Setup:
 *   npm i @heroui/styles @heroui/react framer-motion
 *
 * globals.css:
 *   @import "tailwindcss";
 *   @import "@heroui/styles";
 *
 * HeroUI v3 needs NO provider wrapper — just import and use.
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { Button, Chip, Tooltip } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import type { JellyfinPlaybackInfoResponse } from "@/api/jellyfin/types";
import { jellyfinClient, jellyfinSecondsToTicks } from "@/api/jellyfin";
import {
  BiCog,
  BiFullscreen,
  BiPause,
  BiPlay,
  BiVolumeFull,
  BiVolumeLow,
  BiVolumeMute,
  BiWindows,
  BiX,
} from "react-icons/bi";
import { MdAirplay, MdCast, MdCastConnected } from "react-icons/md";

// ─── Inline SVG icons (no extra icon-package dep) ────────────────────────────

const PlayIcon = () => <BiPlay />;

const PauseIcon = () => <BiPause />;

const VolumeIcon = ({ muted, vol }: { muted: boolean; vol: number }) => {
  if (muted || vol === 0) return <BiVolumeMute />;
  if (vol < 0.5) return <BiVolumeLow />;
  return <BiVolumeFull />;
};

const FullscreenIcon = () => <BiFullscreen />;

const SettingsIcon = () => <BiCog />;

/** Picture-in-picture / “pop out” mini player */
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
  if (isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
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
}) => {
  const jellyfinMediaSourceId = playbackInfo?.MediaSources?.[0]?.Id;

  const videoRef = useRef<WebKitVideoElement>(null);
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
  const [pipActive, setPipActive] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

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
    if (autoPlay) {
      setHasStarted(true);
    }
  }, [src, jellyfinItemId, autoPlay]);

  // ── Play / pause ──────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setShowCenterFlash(true);
      setTimeout(() => setShowCenterFlash(false), 600);
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

  const handleVolumeChange = useCallback((val: number) => {
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
  }, []);

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
    handleVolumeChange(current + delta);
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
    } else {
      preMuteVolumeRef.current = v.volume > 0 ? v.volume : volume;
      v.muted = true;
      v.volume = 0;
      setMuted(true);
      setVolume(0);
    }
  }, [muted, volume]);

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

    // 1. Exit fullscreen if already in fullscreen
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

    // 2. Entering fullscreen:
    // On iPhone/iPod, HTML div fullscreen is not supported by WebKit.
    // Use the native video element player which iOS opens in fullscreen.
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

    // 3. iPhone or fallback to native video player fullscreen
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

  const applyRate = useCallback((rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  }, []);

  // Keyboard shortcuts (only active once the user has engaged with the player,
  // and ignored while typing in form fields):
  //   1 / 2          → playback rate 1×/2×
  //   ← / →          → seek back/forward 15 seconds
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
      if (e.key === "1") {
        e.preventDefault();
        applyRate(1);
      } else if (e.key === "2") {
        e.preventDefault();
        applyRate(2);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekBy(15);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekBy(-15);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasStarted, applyRate, seekBy]);

  // ── Auto-hide controls ────────────────────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (!hasStarted) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, [hasStarted]);

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
      setHasStarted(true);
      sendStarted();
    };

    const onPause = () => {
      setPlaying(false);
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

      // Auto-advance when reaching the end of the video (<0.4s left)
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
    // Initial `volume` / `autoPlay` only; avoid re-binding listeners on every volume change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable Jellyfin handlers + resume apply
  }, [tryApplyPendingResume]);

  // ── Seek & Timeline Dragging ──────────────────────────────────────────────

  const getTimeFromPointer = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || !duration) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
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
    const newTime = getTimeFromPointer(e.clientX);
    setDragTime(newTime);
    const v = videoRef.current;
    if (v) {
      v.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const onTimelinePointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!isDraggingTimeline || !duration) return;
    e.stopPropagation();
    const newTime = getTimeFromPointer(e.clientX);
    setDragTime(newTime);
    const v = videoRef.current;
    if (v) {
      v.currentTime = newTime;
      setCurrentTime(newTime);
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
    const finalTime = dragTime ?? getTimeFromPointer(e.clientX);
    handleSeek(finalTime);
    setIsDraggingTimeline(false);
    setDragTime(null);
  };

  const displayTime =
    isDraggingTimeline && dragTime !== null ? dragTime : (currentTime ?? 0);
  const progressPct = duration ? (displayTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

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

  const getTapRegion = (e: RPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) return "left";
    if (x > (rect.width * 2) / 3) return "right";
    return "center";
  };

  const handleInteractionTap = (e: RPointerEvent<HTMLDivElement>) => {
    if (!hasStarted) return;
    const region = getTapRegion(e);

    if (tapTimerRef.current && lastTapRegionRef.current === region) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      lastTapRegionRef.current = null;
      if (region === "left") seekBy(-15);
      if (region === "right") seekBy(15);
      return;
    }

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    lastTapRegionRef.current = region;
    tapTimerRef.current = setTimeout(() => {
      setShowControls(true);
      resetHideTimer();
      tapTimerRef.current = null;
      lastTapRegionRef.current = null;
    }, 240);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`relative select-none bg-blackmd overflow-hidden shadow-2xl ${containerClasses}`}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <div className={frameClasses}>
        {/* ── Video element ── */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          loop={loop}
          autoPlay={autoPlay}
          playsInline
          controls={useNativeControls}
          preload="auto"
          className="w-full h-full object-cover cursor-pointer"
          // onTimeUpdate={handleTimeUpdate}
        />

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

        {hasStarted && !useNativeControls ? (
          <div
            className="absolute inset-0 z-10 pointer-events-auto"
            onPointerUp={handleInteractionTap}
            aria-hidden
          />
        ) : null}

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

        {/* ── Centre flash on play/pause ── */}
        <AnimatePresence>
          {showCenterFlash && hasStarted && !useNativeControls && (
            <motion.div
              key="flash"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 1.3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 text-white">
                {playing ? <PauseIcon /> : <PlayIcon />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasStarted && showControls && !useNativeControls && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            >
              <Button
                variant="primary"
                isIconOnly
                size="lg"
                onPress={togglePlay}
                aria-label={playing ? "Pause video" : "Play video"}
                className="h-16 w-16 min-w-0 rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 pointer-events-auto"
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Top metadata bar ── */}
        <AnimatePresence>
          {hasStarted && showControls && !useNativeControls && (title || subtitle) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="absolute z-30 top-0 inset-x-0 bg-gradient-to-b from-black/70 to-transparent px-5 pt-4 pb-8 flex items-start gap-3 pointer-events-none"
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
              {/* HeroUI v3 Chip */}
              <Chip className="bg-white/10 text-white/80 text-[11px] shrink-0 pointer-events-auto">
                HD
              </Chip>
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
              className="absolute z-30 bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-10 pb-3"
            >
            {/* ── Seekable timeline (smooth dragging & clickable) ── */}
            <div
              ref={timelineRef}
              className="relative w-full py-2 -my-2 flex items-center cursor-pointer mb-2 group/bar touch-none select-none"
              onPointerDown={onTimelinePointerDown}
              onPointerMove={onTimelinePointerMove}
              onPointerUp={onTimelinePointerUp}
              onPointerCancel={onTimelinePointerUp}
            >
              {/* Track Background */}
              <div className="relative w-full h-1.5 group-hover/bar:h-2 rounded-full bg-white/20 transition-all overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-[width]"
                  style={{ width: `${bufferedPct}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full bg-white ${
                    isDraggingTimeline ? "" : "transition-[width] duration-75"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Scrubber Thumb */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-white shadow-lg pointer-events-none transition-transform ${
                  isDraggingTimeline
                    ? "opacity-100 scale-125 ring-2 ring-white/50"
                    : "opacity-0 group-hover/bar:opacity-100 group-hover/bar:scale-100"
                }`}
                style={{ left: `${progressPct}%` }}
              />
            </div>

            {/* ── Button / slider row ── */}
            <div className="flex items-center gap-1">
              {/* Play / Pause
                  v3 changes: variant="ghost" (not "light"), onPress (not onClick) */}
              <Tooltip delay={400}>
                <Tooltip.Trigger>
                  <Button
                    variant="ghost"
                    isIconOnly
                    size="sm"
                    onPress={togglePlay}
                    className="text-white hover:bg-white/10 rounded-lg"
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? <PauseIcon /> : <PlayIcon />}
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content placement="top">
                  {playing ? "Pause" : "Play"}
                </Tooltip.Content>
              </Tooltip>

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
                  {muted || volume === 0 ? "Unmute" : "Mute"}
                </Tooltip.Content>
              </Tooltip>

              {/* Volume Slider: smooth clickable/draggable bar */}
              <div
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
                  className="w-20 sm:w-24 h-6 flex items-center touch-none relative"
                >
                  {/* Track Background */}
                  <div className="w-full h-1.5 rounded-full bg-white/30 group-hover/vol:h-2 transition-all relative overflow-hidden">
                    {/* Active Fill */}
                    <div
                      className="h-full bg-white rounded-full transition-[width] duration-75"
                      style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                  {/* Thumb */}
                  <div
                    className="absolute size-3 rounded-full bg-white shadow-md top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none group-hover/vol:scale-110 transition-transform"
                    style={{ left: `${(muted ? 0 : volume) * 100}%` }}
                  />
                </div>
              </div>

              {/* Timestamp */}
              <span className="text-white/70 text-xs tabular-nums ml-1 shrink-0">
                {fmt(displayTime)}{" "}
                <span className="text-white/40">/ {fmt(duration)}</span>
              </span>

              <div className="flex-1" />

              {/* AirPlay (Apple / iOS / Safari) */}
              {isAirPlayAvailable ? (
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={handleAirPlay}
                      className={`rounded-lg transition-colors ${
                        isAirPlayConnected
                          ? "text-blue-400 hover:bg-blue-400/20"
                          : "text-white hover:bg-white/10"
                      }`}
                      aria-label={
                        isAirPlayConnected ? "Connected to AirPlay" : "AirPlay"
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

              {/* Cast (Chromecast / Google Cast / Remote Playback) */}
              {isCastAvailable ? (
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={() => void handleCast()}
                      className={`rounded-lg transition-colors ${
                        isCastConnected
                          ? "text-blue-400 hover:bg-blue-400/20"
                          : "text-white hover:bg-white/10"
                      }`}
                      aria-label={
                        isCastConnected ? "Connected to Cast" : "Cast to screen"
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

              {/* Playback speed & player mode settings */}
              <div className="relative">
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      onPress={() => setShowSettings((s) => !s)}
                      className="text-white hover:bg-white/10 rounded-lg"
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
                      className="absolute bottom-10 right-0 z-50 min-w-[130px] rounded-xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-md"
                    >
                      <div className="space-y-2 px-1 w-40">
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-widest text-white/45">
                            Speed
                          </p>
                          <select
                            aria-label="Playback speed"
                            value={String(playbackRate)}
                            onChange={(e) => {
                              const key = e.target.value;
                              const rate = key ? parseFloat(key) : 1;
                              applyRate(rate);
                            }}
                            className="h-8 w-full min-h-0 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white outline-none"
                          >
                            {rates.map((r) => (
                              <option
                                key={String(r)}
                                value={String(r)}
                                className="bg-zinc-900"
                              >
                                {r === 1 ? "Normal" : `${r}×`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Native player toggle */}
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

              {canUsePictureInPicture ? (
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      onPress={() => void togglePictureInPicture()}
                      className="text-white hover:bg-white/10 rounded-lg"
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
                    {pipActive ? "Close mini player" : "Pop out (mini player)"}
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
                    className="text-white hover:bg-white/10 rounded-lg"
                    aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    <FullscreenIcon />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content placement="top">
                  {fullscreen ? "Exit fullscreen" : "Fullscreen"}
                </Tooltip.Content>
              </Tooltip>
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

              {/* Countdown Progress Bar */}
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

// ─── Usage example ────────────────────────────────────────────────────────────
//
// globals.css:
//   @import "tailwindcss";
//   @import "@heroui/styles";
//
// App.tsx (no HeroUIProvider needed in v3):
//   import VideoPlayer from "./VideoPlayer";
//
//   export default function App() {
//     return (
//       <div className="max-w-3xl mx-auto p-8">
//         <VideoPlayer
//           src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
//           poster="https://peach.blender.org/wp-content/uploads/title_anouncement.jpg"
//           title="Big Buck Bunny"
//           subtitle="Blender Foundation · 2008"
//         />
//       </div>
//     );
//   }
