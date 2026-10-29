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
import { jellyfinClient } from "@/api/jellyfin";
import { useDataContext } from "@/context";
import type { Arc, Episode } from "@/typings";

interface EpisodesProps {
  data: Arc;
}

export default function Episodes({ data }: EpisodesProps) {
  const { episodeId } = useParams();
  const { isEpisodePlayed, getEpisodeProgress } = useDataContext();

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 w-full">
        <Spinner size="md" color="accent" />
        <p className="text-white/50 text-xs animate-pulse">Loading episodes...</p>
      </div>
    );
  }

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
      <div className="flex items-center gap-2 w-full justify-between">
        <h3 className="text-md font-semibold px-2">All Episodes</h3>
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

      <div className="flex flex-col gap-2">
        {data.episodes.map((episode) => {
          const played =
            episode.metadata?.UserData?.Played ??
            isEpisodePlayed(data.id, episode.id);
          const progress = getEpisodeProgress(data.id, episode.id);

          return (
            <EpisodeCard
              key={episode.metadata?.Id || `${data.id}-${episode.id}`}
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
      </div>
    </div>
  );
}

function ticksToMinutes(ticks: number): string {
  return (ticks / 10000000 / 60).toFixed(0);
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
  const calculatedPercent =
    progressPercent > 0
      ? progressPercent
      : runtimeTicks > 0 && positionTicks > 0
        ? Math.min(100, Math.round((positionTicks / runtimeTicks) * 100))
        : 0;

  return (
    <div
      key={episode.metadata?.Id || episode.id}
      id={`episode-${episode.id}`}
      className={`flex items-start gap-4 rounded-2xl px-2.5 py-2.5 transition-colors xl:flex-row sm:items-start flex-col w-full ${
        isWatching
          ? "bg-accent/10 border border-accent/30"
          : "hover:bg-default/10"
      }`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={`relative xl:w-64 w-full rounded-lg overflow-hidden flex justify-center items-center brightness-90 hover:brightness-100 transition-all duration-300 ${isHovering ? "brightness-100" : "brightness-90"}`}
        style={{
          aspectRatio: "16 / 9",
          backgroundImage: episode.metadata?.Id
            ? `url(${jellyfinClient.getItemImageUrl(episode.metadata.Id)})`
            : undefined,
          backgroundColor: "#18181b",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {isHovering && (
          <Button
            variant="tertiary"
            isIconOnly
            className="rounded-full mx-4 text-sm p-2 shadow-lg"
            onPress={() => handleNavigate(episode.id)}
          >
            <BiPlay size={24} />
          </Button>
        )}

        {/* Runtime Badge */}
        {runtimeTicks > 0 && (
          <Chip
            size="sm"
            color="default"
            className="gap-1 absolute bottom-2 right-2 bg-black/70 text-white border-none"
          >
            <FiClock />
            {ticksToMinutes(runtimeTicks)}m
          </Chip>
        )}

        {/* Progress Bar overlay on thumbnail */}
        {!isWatched && calculatedPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${calculatedPercent}%` }}
            />
          </div>
        )}
      </div>

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
            {arcTitle} Episode {episode.id}
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
    </div>
  );
}
