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
import type { MouseEvent as RMouseEvent, PointerEvent as RPointerEvent } from "react";
import { Button, Chip, Slider, Tooltip } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import type { JellyfinPlaybackInfoResponse } from "@/api/jellyfin/types";
import { jellyfinClient, jellyfinSecondsToTicks } from "@/api/jellyfin";
import {
  BiCog,
  BiFullscreen,
  BiPause,
  BiPlay,
  BiVolumeFull,
  BiVolumeMute,
  BiWindows,
} from "react-icons/bi";

// ─── Inline SVG icons (no extra icon-package dep) ────────────────────────────

const PlayIcon = () => <BiPlay />;

const PauseIcon = () => <BiPause />;

const VolumeIcon = ({ muted }: { muted: boolean }) =>
  muted ? <BiVolumeMute /> : <BiVolumeFull />;

const FullscreenIcon = () => <BiFullscreen />;

const SettingsIcon = () => <BiCog />;

/** Picture-in-picture / “pop out” mini player */
const PopOutIcon = () => <BiWindows className="size-5" />;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (s: number): string => {
  if (isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// ─── Types ───────────────────────────────────────────────────────────────────

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
}

// ─── Component ───────────────────────────────────────────────────────────────

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  subtitle,
  autoPlay = false,
  loop = false,
  aspectRatio = "aspect-video",
  className = "",
  playbackInfo,
  jellyfinItemId,
  playbackProgressIntervalMs = 10_000,
  initialPlaybackPositionTicks,
}) => {
  const jellyfinMediaSourceId = playbackInfo?.MediaSources?.[0]?.Id;

  const videoRef = useRef<HTMLVideoElement>(null);
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
  const [hasStarted, setHasStarted] = useState(false);
  const [showCenterFlash, setShowCenterFlash] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [pipActive, setPipActive] = useState(false);

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

  // HeroUI v3 Slider: onChange receives `number | number[]`
  const handleVolumeChange = useCallback((val: number | number[]) => {
    const v = videoRef.current;
    const vol = Array.isArray(val) ? val[0] : val;
    if (!v) return;
    v.volume = vol;
    if (vol > 0) {
      preMuteVolumeRef.current = vol;
      if (v.muted) {
        v.muted = false;
        setMuted(false);
      }
    }
    setVolume(vol);
    setMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted) {
      const next =
        preMuteVolumeRef.current > 0.02 ? preMuteVolumeRef.current : 0.25;
      v.muted = false;
      v.volume = next;
      setMuted(false);
      setVolume(next);
    } else {
      preMuteVolumeRef.current = v.volume > 0 ? v.volume : volume;
      v.muted = true;
      setMuted(true);
    }
  }, [volume]);

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
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
    } else {
      await document.exitFullscreen();
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
      void jellyfinClient.reportPlaybackStopped({
        ...base,
        PositionTicks: jellyfinSecondsToTicks(v.currentTime),
        Played: played,
      });
    };

    const onPlay = () => {
      setPlaying(true);
      setHasStarted(true);
      sendStarted();
    };

    const onPause = () => {
      setPlaying(false);
      setShowControls(true);
      jellyfinLastPositionTicksRef.current = jellyfinSecondsToTicks(
        v.currentTime,
      );
      jellyfinLastProgressAtRef.current = Date.now();
      sendProgress();
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
    };

    const onLoaded = () => {
      setDuration(v.duration);
      tryApplyPendingResume();
    };
    const onCanPlay = () => {
      tryApplyPendingResume();
    };
    const onFs = () => setFullscreen(!!document.fullscreenElement);

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("ended", onEnded);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("canplay", onCanPlay);
    document.addEventListener("fullscreenchange", onFs);

    v.volume = volume;
    tryApplyPendingResume();
    if (autoPlay) v.play().catch(() => {});

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("canplay", onCanPlay);
      document.removeEventListener("fullscreenchange", onFs);
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

  // ── Click-to-seek on the raw timeline bar ─────────────────────────────────

  const handleTimelineClick = (e: RMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    handleSeek(ratio * duration);
  };

  const progressPct = duration ? ((currentTime ?? 0) / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

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
          playsInline
          className="w-full h-full object-cover cursor-pointer"
          // onTimeUpdate={handleTimeUpdate}
        />

        {hasStarted ? (
          <div
            className="absolute inset-0 z-10 pointer-events-auto"
            onPointerUp={handleInteractionTap}
            aria-hidden
          />
        ) : null}

        {!hasStarted && (
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
          {showCenterFlash && hasStarted && (
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
          {hasStarted && showControls && (
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
          {hasStarted && showControls && (title || subtitle) && (
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
          {hasStarted && showControls && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="absolute z-30 bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-10 pb-3"
            >
            {/* ── Seekable timeline (custom bar — richer appearance than plain Slider) ── */}
            <div
              className="relative w-full h-1.5 rounded-full bg-white/20 cursor-pointer mb-3 group/bar"
              onClick={handleTimelineClick}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-[width]"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width]"
                style={{ width: `${progressPct}%` }}
              />
              {/* Hover thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
                style={{ left: `calc(${progressPct}% - 7px)` }}
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
                    className="text-white hover:bg-white/10 rounded-lg"
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    <VolumeIcon muted={muted} />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content placement="top">
                  {muted ? "Unmute" : "Mute"}
                </Tooltip.Content>
              </Tooltip>

              {/* Volume: true level + mute restores previous level */}
              <div
                className={`mx-1 flex min-w-0 flex-1 items-center gap-2 sm:max-w-[100px] ${muted ? "opacity-70" : ""}`}
              >
                <Slider
                  aria-label="Volume"
                  minValue={0}
                  maxValue={1}
                  step={0.01}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="min-w-0 flex-1 "
                >
                  <Slider.Track className={"h-1 "}>
                    <Slider.Fill />
                    <Slider.Thumb className="size-3.5 rounded-full border border-white/30 bg-white shadow-md ring-2 ring-white/20" />
                  </Slider.Track>
                </Slider>
              </div>

              {/* Timestamp */}
              <span className="text-white/70 text-xs tabular-nums ml-1 shrink-0">
                {fmt(currentTime)}{" "}
                <span className="text-white/40">/ {fmt(duration)}</span>
              </span>

              <div className="flex-1" />

              {/* Playback speed */}
              <div className="relative">
                <Tooltip delay={400}>
                  <Tooltip.Trigger>
                    <Button
                      variant="ghost"
                      isIconOnly
                      onPress={() => setShowSettings((s) => !s)}
                      className="text-white hover:bg-white/10 rounded-lg"
                      aria-label="Playback speed"
                    >
                      <SettingsIcon />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="top">Speed</Tooltip.Content>
                </Tooltip>

                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-10 right-0 z-50 min-w-[112px] rounded-xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-md"
                    >
                      <div className="space-y-1 px-1 w-36">
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
