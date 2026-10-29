import { Episodes, Layout, VideoPlayer } from "@/components";
import { Breadcrumbs, Button, Chip, Spinner } from "@heroui/react";
import {
  BiBook,
  BiCheck,
  BiChevronLeft,
  BiChevronRight,
  BiTv,
} from "react-icons/bi";
import { jellyfinClient } from "@/api/jellyfin/client";
import { useDataContext } from "@/context";
import { useParams } from "react-router";
import { DATA } from "@/data/data";
import type { Arc, Episode } from "@/typings";

export default function EpisodePage() {
  const { arcId, episodeId } = useParams();
  const {
    nextEpisode,
    previousEpisode,
    previousArc,
    nextArc,
    arc,
    episode,
    navigate,
    isLoadingArc,
    isLoadingEpisode,
    isEpisodePlayed,
    toggleEpisodePlayed,
  } = useDataContext();

  const parsedArcId = parseInt(arcId || "0", 10);
  const parsedEpisodeId = parseInt(episodeId || "0", 10);

  const targetArc = DATA.arcs.find((a) => a.id === parsedArcId) as Arc | undefined;
  const targetEpisode = targetArc?.episodes.find((e) => e.id === parsedEpisodeId) as Episode | undefined;

  const currentArc = arc && arc.id === parsedArcId ? arc : targetArc;
  const currentEpisode: Episode | undefined =
    episode && episode.id === parsedEpisodeId ? episode : targetEpisode;

  const handlePreviousEpisode = () => {
    if (previousEpisode) {
      return navigate(`/${currentArc?.id}/${previousEpisode.id}`);
    }
    if (previousArc) {
      return navigate(`/${previousArc.id}/${previousArc.episodes.length}`);
    }
  };

  const handleNextEpisode = async () => {
    if (currentArc && currentEpisode) {
      try {
        await toggleEpisodePlayed(currentArc.id, currentEpisode.id);
      } catch (error) {
        console.error("Failed to mark episode played before navigating:", error);
      }
    }

    if (nextEpisode) {
      return navigate(`/${currentArc?.id}/${nextEpisode.id}`);
    }
    if (nextArc) {
      return navigate(`/${nextArc.id}/1`);
    }
  };

  if (!currentArc || !currentEpisode) {
    if (isLoadingArc || isLoadingEpisode) {
      return (
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 w-full">
            <Spinner size="lg" color="accent" />
            <p className="text-white/60 text-sm animate-pulse">Loading episode...</p>
          </div>
        </Layout>
      );
    }

    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 w-full text-center">
          <h2 className="text-2xl font-bold text-white">Episode not found</h2>
          <p className="text-muted text-sm">We couldn't find the episode you're looking for.</p>
          <Button
            variant="primary"
            onPress={() => navigate(currentArc ? `/${currentArc.id}` : "/1")}
          >
            {currentArc ? `Back to ${currentArc.title}` : "Go to Romance Dawn"}
          </Button>
        </div>
      </Layout>
    );
  }

  const isVideoReady = Boolean(
    episode &&
      episode.id === parsedEpisodeId &&
      episode.video?.url,
  );

  const isWatched = Boolean(
    currentEpisode.metadata?.UserData?.Played ??
      isEpisodePlayed(currentArc.id, currentEpisode.id),
  );

  return (
    <Layout>
      <div id="episode" className=" flex w-full flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Breadcrumbs>
              <Breadcrumbs.Item href={`/${currentArc.id}`}>
                {currentArc.title}
              </Breadcrumbs.Item>
              <Breadcrumbs.Item href={`/${currentArc.id}/${currentEpisode.id}`}>
                {currentArc.title} Episode {currentEpisode.id}
              </Breadcrumbs.Item>
            </Breadcrumbs>
          </div>
        </header>

        <section className="flex flex-col relative justify-center items-center">
          <div className="border-default-100 bg-default-50 relative z-0 w-full overflow-hidden rounded-xl border shadow-sm">
            {isVideoReady && episode ? (
              <VideoPlayer
                src={episode.video?.url || ""}
                playbackInfo={episode.video?.info}
                jellyfinItemId={episode.metadata?.Id}
                title={`${currentArc.title} Episode ${currentEpisode.id}`}
                subtitle={currentArc.title}
                initialPlaybackPositionTicks={
                  episode.metadata?.UserData?.PlaybackPositionTicks
                }
                poster={
                  episode.metadata?.Id
                    ? jellyfinClient.getItemImageUrl(episode.metadata.Id)
                    : undefined
                }
              />
            ) : (
              <div className="relative w-full aspect-video bg-zinc-950 flex flex-col items-center justify-center gap-3">
                <Spinner size="lg" color="accent" />
                <p className="text-white/70 text-sm font-medium animate-pulse">
                  Loading {currentArc.title} Episode {currentEpisode.id}...
                </p>
              </div>
            )}
          </div>

          <div className="w-full pt-6 pb-6 flex justify-between items-start flex-row">
            <div className="flex flex-col gap-2 pb-4">
              <div className="flex flex-row gap-4">
                <div className="flex flex-col gap-2 justify-end w-full">
                  <div className="flex flex-row gap-2 sm:hidden w-full justify-between pb-3">
                    <Button
                      variant="ghost"
                      className="rounded-lg cursor-pointer"
                      onPress={handlePreviousEpisode}
                      isDisabled={currentEpisode.id === 1 && currentArc.id === 1}
                      size="sm"
                    >
                      <BiChevronLeft />{" "}
                      {previousEpisode
                        ? "Previous Episode"
                        : previousArc
                          ? `Arc ${previousArc.id}`
                          : "Previous"}
                    </Button>
                    <Button
                      variant={
                        currentEpisode.id === currentArc.episodes.length
                          ? "primary"
                          : "secondary"
                      }
                      className="rounded-lg cursor-pointer"
                      size="sm"
                      onPress={handleNextEpisode}
                    >
                      {nextEpisode
                        ? "Next Episode"
                        : nextArc
                          ? `Arc ${nextArc.id}`
                          : "Next"}{" "}
                      <BiChevronRight />
                    </Button>
                  </div>
                  <p className="text-muted text-sm">
                    {currentEpisode.id} of {currentArc.episodes.length}
                  </p>
                  <span className="flex items-center gap-2">
                    <Chip size="sm" color="accent" className="gap-1">
                      <BiBook />
                      {currentEpisode.coverage?.manga}
                    </Chip>
                    <Chip size="sm" color="accent" className="gap-1">
                      <BiTv />
                      {currentEpisode.coverage?.anime}
                    </Chip>
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-3xl font-semibold flex items-center gap-2">
                      {currentArc.title} Episode {currentEpisode.id}
                    </h3>
                    {isWatched ? (
                      <Chip
                        size="sm"
                        color="success"
                        className="cursor-pointer hover:bg-success/20 transition-all duration-200"
                        onClick={() => toggleEpisodePlayed(currentArc.id, currentEpisode.id)}
                        title="Click to mark as unplayed"
                      >
                        <BiCheck /> Watched
                      </Chip>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-3 text-muted hover:text-success flex items-center gap-1 cursor-pointer"
                        onPress={() => toggleEpisodePlayed(currentArc.id, currentEpisode.id)}
                      >
                        <BiCheck /> Mark as watched
                      </Button>
                    )}
                  </div>

                  <p className="text-muted text-sm max-w-2xl sm:max-w-none w-full">
                    {currentEpisode.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-row gap-2 sm:flex hidden">
              <Button
                variant="ghost"
                className="rounded-lg cursor-pointer"
                onPress={handlePreviousEpisode}
                isDisabled={currentEpisode.id === 1 && currentArc.id === 1}
                size="sm"
              >
                <BiChevronLeft />{" "}
                {previousEpisode
                  ? "Previous Episode"
                  : previousArc
                    ? `Arc ${previousArc.id}`
                    : "Previous"}
              </Button>
              <Button
                variant={
                  currentEpisode.id === currentArc.episodes.length
                    ? "primary"
                    : "secondary"
                }
                className="rounded-lg cursor-pointer"
                size="sm"
                onPress={handleNextEpisode}
              >
                {nextEpisode
                  ? "Next Episode"
                  : nextArc
                    ? `Arc ${nextArc.id}`
                    : "Next"}{" "}
                <BiChevronRight />
              </Button>
            </div>
          </div>
          {/* all episodes */}
          <Episodes data={currentArc} />
        </section>
      </div>
    </Layout>
  );
}
