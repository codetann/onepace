import { Episodes, Layout, VideoPlayer } from "@/components";
import { Breadcrumbs, Button, Chip } from "@heroui/react";
import {
  BiBook,
  BiChevronLeft,
  BiChevronRight,
  BiPlay,
  BiStar,
  BiTv,
} from "react-icons/bi";
import { useEffect, useMemo, useState } from "react";
import { jellyfinClient } from "@/api/jellyfin/client";
import { useDataContext } from "@/context";

/**
 * S10E2 example. The mirror page sets CSP `frame-ancestors https://onepace.co`,
 * so animedekho cannot be iframed from this app — use One Pace’s wrapper URL
 * instead (it loads the same player inside onepace.co). `trid` is per-episode.
 */
export default function EpisodePage() {
  const {
    nextEpisode,
    previousEpisode,
    previousArc,
    nextArc,
    arc,
    episode,
    navigate,
    refreshData,
  } = useDataContext();
  const [isHover, setIsHover] = useState(false);

  const nextButtonText = useMemo(() => {
    if (nextEpisode) {
      return nextEpisode.title;
    }
    return "Next";
  }, [nextEpisode]);

  const handlePreviousEpisode = () => {
    if (previousEpisode) {
      return navigate(`/${arc?.id}/${previousEpisode.id}`);
    }
    if (previousArc) {
      return navigate(`/${previousArc.id}/${previousArc.episodes.length}`);
    }
  };

  const handleNextEpisode = async () => {
    // Best-effort: mark the current item played before moving on.
    // const itemInfo = await jellyfinClient.getItem(episode?.metadata?.Id || "");
    // if (
    //   (itemInfo?.RunTimeTicks || 0) -
    //     (itemInfo?.UserData?.PlaybackPositionTicks || 0) <=
    //   2000000000
    // ) {
    //   const itemId = episode?.metadata?.Id;
    //   if (itemId) {
    //     try {
    //       await jellyfinClient.markPlayedItem(itemId);
    //       await refreshData();
    //     } catch (error) {
    //       console.error(
    //         "Failed to mark episode played before navigating:",
    //         error,
    //       );
    //     }
    //   }
    // }

    const itemId = episode?.metadata?.Id;
    if (itemId) {
      try {
        await jellyfinClient.markPlayedItem(itemId);
        await refreshData();
      } catch (error) {
        console.error(
          "Failed to mark episode played before navigating:",
          error,
        );
      }
    }

    if (nextEpisode) {
      return navigate(`/${arc?.id}/${nextEpisode.id}`);
    }
    if (nextArc) {
      return navigate(`/${nextArc.id}/1`);
    }
  };

  useEffect(() => {
    const fetchSeasons = async () => {
      const seasons = await jellyfinClient.getShowByName("One Pace");
      const episodes = await jellyfinClient.getSeasonsForShow(
        "73e7652b9106be6656ff4e850dde8a6d",
      );
      console.log(episodes);
    };
    fetchSeasons();
  }, [arc]);

  if (!arc || !episode) {
    return <div>Episode not found</div>;
  }

  return (
    <Layout>
      <div id="episode" className=" flex w-full flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Breadcrumbs>
              <Breadcrumbs.Item href={`/${arc?.id}`}>
                {arc?.title}
              </Breadcrumbs.Item>
              <Breadcrumbs.Item href={`/${arc?.id}/${episode?.id}`}>
                {episode?.title}
              </Breadcrumbs.Item>
            </Breadcrumbs>
          </div>
        </header>

        <section className="flex flex-col  relative justify-center items-center">
          <div className="border-default-100 bg-default-50 relative z-0 w-full overflow-hidden rounded-xl border shadow-sm ">
            <Button
              variant="tertiary"
              isIconOnly
              size="lg"
              className="rounded-full p-7 absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden"
              onMouseEnter={() => setIsHover(true)}
              onMouseLeave={() => setIsHover(false)}
            >
              <BiPlay className="size-10" />
            </Button>

            <VideoPlayer
              // src={data.selectedEpisode.metadata?.videoUrl || ""}
              src={episode?.video?.url || ""}
              playbackInfo={episode?.video?.info}
              jellyfinItemId={episode.metadata?.Id}
              initialPlaybackPositionTicks={
                episode.metadata?.UserData?.PlaybackPositionTicks
              }
              poster={jellyfinClient.getItemImageUrl(
                episode.metadata?.Id || "",
              )}
            />
          </div>
          <div className="w-full pt-6 pb-6 flex justify-between items-start flex-row">
            <div className="flex flex-col gap-2 pb-4">
              <div className="flex flex-row gap-4 ">
                <img
                  src="https://onepace.co/wp-content/uploads/2025/09/Season-10-Whiskey-Peak-ALT-2.jpg"
                  className="w-46 rounded-lg shrink-0 hidden"
                  alt="Whiskey Peak"
                />
                <div className="flex flex-col gap-2 justify-end w-full ">
                  <div className="flex flex-row gap-2  sm:hidden w-full justify-between pb-3">
                    <Button
                      variant={"ghost"}
                      className="rounded-lg cursor-pointer"
                      onPress={handlePreviousEpisode}
                      isDisabled={episode?.id === 1 && arc?.id === 1}
                      size="sm"
                    >
                      <BiChevronLeft />{" "}
                      {previousEpisode?.title
                        ? "Previous Episode"
                        : previousArc?.title}
                    </Button>
                    <Button
                      variant={
                        episode?.id === arc?.episodes.length
                          ? "primary"
                          : "secondary"
                      }
                      className="rounded-lg cursor-pointer"
                      size="sm"
                      onPress={handleNextEpisode}
                    >
                      {nextEpisode?.title ? "Next Episode" : nextArc?.title}{" "}
                      <BiChevronRight />
                    </Button>
                  </div>
                  <p className="text-muted text-sm">
                    {episode?.id} of {arc?.episodes.length}
                  </p>
                  <span className="flex items-center gap-2 ">
                    <Chip size="sm" color="accent" className="gap-1">
                      <BiBook />
                      {episode?.coverage.manga}
                    </Chip>
                    <Chip size="sm" color="accent" className="gap-1">
                      <BiTv />
                      {episode?.coverage.anime}
                    </Chip>
                  </span>
                  <h3 className="text-3xl font-semibold flex items-center gap-2">
                    {episode?.title}
                  </h3>

                  <p className="text-muted text-sm max-w-2xl sm:max-w-none w-full ">
                    {episode?.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-row gap-2  sm:flex hidden">
              <Button
                variant={"ghost"}
                className="rounded-lg cursor-pointer"
                onPress={handlePreviousEpisode}
                isDisabled={episode?.id === 1 && arc?.id === 1}
                size="sm"
              >
                <BiChevronLeft />{" "}
                {previousEpisode?.title
                  ? "Previous Episode"
                  : previousArc?.title}
              </Button>
              <Button
                variant={
                  episode?.id === arc?.episodes.length ? "primary" : "secondary"
                }
                className="rounded-lg cursor-pointer"
                size="sm"
                onPress={handleNextEpisode}
              >
                {nextEpisode?.title ? "Next Episode" : nextArc?.title}{" "}
                <BiChevronRight />
              </Button>
            </div>
          </div>
          {/* all episodes */}
          <Episodes data={arc} />
        </section>
      </div>
    </Layout>
  );
}
