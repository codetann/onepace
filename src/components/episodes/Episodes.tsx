import { Chip, Button, Spinner } from "@heroui/react";
import { useState } from "react";
import { FiClock } from "react-icons/fi";
import {
  BiCheck,
  BiPlay,
  BiX,
  BiChevronDown,
} from "react-icons/bi";
import { useNavigate, useParams } from "react-router";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { jellyfinClient } from "@/api/jellyfin";
import { useDataContext } from "@/context";
import type { Arc, Episode } from "@/typings";

const episodeListVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.08,
    },
  },
};

const episodeCardVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 24,
    },
  },
};

interface EpisodesProps {
  data: Arc;
}

export default function Episodes({ data }: EpisodesProps) {
  const { episodeId } = useParams();
  const { isEpisodePlayed, getEpisodeProgress, isArcFinished, toggleArcPlayed } =
    useDataContext();

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 w-full">
        <Spinner size="md" color="accent" />
        <p className="text-white/50 text-xs animate-pulse">Loading episodes...</p>
      </div>
    );
  }

  const isFinished = isArcFinished(data.id);

  const handleJumpToEpisode = (targetEpisodeId: string) => {
    const el =
      document.getElementById(`episode-${targetEpisodeId}`) ||
      document.getElementById(targetEpisodeId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full pt-2">
      <div className="flex items-center gap-2 w-full justify-between flex-wrap pb-1">
        <h3 className="text-md font-semibold px-2">All Episodes</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            className={`text-xs h-7 px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
              isFinished
                ? "text-green-500 hover:text-red-400 hover:bg-red-500/10"
                : "text-muted hover:text-green-400 hover:bg-green-500/10"
            }`}
            onPress={() => toggleArcPlayed(data.id)}
            aria-label={
              isFinished
                ? "Mark season as unplayed"
                : "Mark all episodes in this season as complete"
            }
          >
            <BiCheck className="size-4" />
            {isFinished ? "Season Completed" : "Mark Season Complete"}
          </Button>

          {episodeId && (
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => handleJumpToEpisode(episodeId || "")}
            >
              <BiChevronDown />
              Jump to episode {episodeId}
            </Button>
          )}
        </div>
      </div>

      <motion.div
        key={`episodes-list-${data.id}`}
        variants={episodeListVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-2"
      >
        {data.episodes.map((episode) => {
          const played =
            episode.metadata?.UserData?.Played ??
            isEpisodePlayed(data.id, episode.id);
          const progress = getEpisodeProgress(data.id, episode.id);

          return (
            <EpisodeCard
              key={`arc-${data.id}-ep-${episode.id}`}
              arcId={data.id.toString()}
              arcTitle={data.title}
              episode={episode}
              isWatching={episodeId === episode.id.toString()}
              isWatched={played}
              progressPercent={progress.percent}
              positionTicks={progress.ticks}
            />
          );
        })}
      </motion.div>
    </div>
  );
}

function ticksToMinutes(ticks: number): string {
  return (ticks / 10000000 / 60).toFixed(0);
}

interface EpisodeThumbnailProps {
  itemId?: string;
  title: string;
  isHovering: boolean;
  durationText?: string;
  calculatedPercent: number;
  isWatched?: boolean;
  onNavigate: () => void;
}

function EpisodeThumbnail({
  itemId,
  title,
  isHovering,
  durationText,
  calculatedPercent,
  isWatched,
  onNavigate,
}: EpisodeThumbnailProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const imageUrl = itemId ? jellyfinClient.getItemImageUrl(itemId) : undefined;
  const isLoaded = Boolean(imageUrl && loadedUrl === imageUrl);

  return (
    <motion.div
      onClick={onNavigate}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative sm:w-60 xl:w-64 w-full rounded-lg overflow-hidden flex justify-center items-center cursor-pointer transition-all duration-300 group bg-zinc-900 aspect-video shrink-0 ${
        isHovering ? "brightness-100 shadow-lg" : "brightness-90"
      }`}
    >
      {/* Placeholder shimmer while thumbnail loads */}
      <div
        className={`absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 transition-opacity duration-300 ${
          isLoaded ? "opacity-0 pointer-events-none" : "opacity-100 animate-pulse"
        }`}
      />

      {imageUrl && (
        <motion.img
          src={imageUrl}
          alt={title}
          loading="lazy"
          onLoad={() => setLoadedUrl(imageUrl)}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <AnimatePresence>
        {isHovering && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="rounded-full p-2.5 bg-black/60 text-white shadow-lg pointer-events-none z-10"
          >
            <BiPlay size={24} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Runtime Badge */}
      {durationText && (
        <Chip
          size="sm"
          color="default"
          className="gap-1 absolute bottom-2 right-2 bg-black/70 text-white border-none z-10 font-medium"
        >
          <FiClock />
          {durationText}
        </Chip>
      )}

      {/* Progress Bar overlay on thumbnail */}
      {!isWatched && calculatedPercent > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 overflow-hidden z-10">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${calculatedPercent}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}

interface EpisodeCardProps {
  arcId: string;
  arcTitle: string;
  episode: Episode;
  isWatched?: boolean;
  isWatching?: boolean;
  progressPercent?: number;
  positionTicks?: number;
}

function EpisodeCard({
  arcId,
  arcTitle,
  episode,
  isWatched,
  isWatching,
  progressPercent = 0,
  positionTicks = 0,
}: EpisodeCardProps) {
  const { refreshData } = useDataContext();
  const navigate = useNavigate();
  const handleNavigate = (targetEpisodeId: number) =>
    navigate(`/${arcId}/${targetEpisodeId}`);
  const [isHovering, setIsHovering] = useState(false);
  const [isHoveringFinished, setIsHoveringFinished] = useState(false);

  const handleTogglePlayed = async () => {
    const itemId = episode.metadata?.Id;
    if (!itemId) return;
    if (isWatched) {
      await jellyfinClient.unmarkPlayedItem(itemId);
    } else {
      await jellyfinClient.markPlayedItem(itemId);
    }
    await refreshData();
  };

  const runtimeTicks = episode.metadata?.RunTimeTicks || 0;
  const durationText =
    runtimeTicks > 0
      ? `${ticksToMinutes(runtimeTicks)}m`
      : episode.length || undefined;
  const calculatedPercent =
    progressPercent > 0
      ? progressPercent
      : runtimeTicks > 0 && positionTicks > 0
        ? Math.min(100, Math.round((positionTicks / runtimeTicks) * 100))
        : 0;

  const displayTitle = episode.altTitle || `${arcTitle} Episode ${episode.id}`;

  return (
    <motion.div
      variants={episodeCardVariants}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      id={`episode-${episode.id}`}
      className={`flex items-start gap-4 rounded-2xl px-2.5 py-2.5 transition-colors sm:flex-row flex-col w-full ${
        isWatching
          ? "bg-accent/10 border border-accent/30"
          : "hover:bg-default/10"
      }`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <EpisodeThumbnail
        itemId={episode.metadata?.Id}
        title={displayTitle}
        isHovering={isHovering}
        durationText={durationText}
        calculatedPercent={calculatedPercent}
        isWatched={isWatched}
        onNavigate={() => handleNavigate(episode.id)}
      />

      <div className="flex flex-col gap-1 pr-3 pb-2 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {isWatching && (
            <Chip size="sm" color="accent">
              <BiPlay /> Watching
            </Chip>
          )}

          <p
            className={`hover:underline cursor-pointer text-md font-semibold ${isWatching ? "text-accent" : ""} ${isWatched ? "line-through opacity-70" : ""}`}
            onClick={() => handleNavigate(episode.id)}
          >
            {displayTitle}
          </p>

          {isWatched ? (
            <Chip
              size="sm"
              color="success"
              className="cursor-pointer hover:bg-success/20 transition-all duration-200"
              onMouseEnter={() => setIsHoveringFinished(true)}
              onMouseLeave={() => setIsHoveringFinished(false)}
              onClick={handleTogglePlayed}
              title="Click to mark as unplayed"
            >
              {isHoveringFinished ? <BiX /> : <BiCheck />} Finished
            </Chip>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-6 px-2 text-muted hover:text-success flex items-center gap-1 cursor-pointer"
              onPress={handleTogglePlayed}
              aria-label="Mark as watched"
            >
              <BiCheck /> Mark watched
            </Button>
          )}

          {!isWatched && calculatedPercent > 0 && (
            <Chip size="sm" color="accent" variant="secondary" className="text-xs">
              {calculatedPercent}% watched
            </Chip>
          )}
        </div>

        <p className="text-muted text-sm max-w-4xl">{episode.description}</p>
      </div>
    </motion.div>
  );
}
