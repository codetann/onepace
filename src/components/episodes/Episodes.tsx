import { Chip } from "@heroui/react";
import React, { useEffect } from "react";
import { FiClock } from "react-icons/fi";
import {
  BiCheck,
  BiStar,
  BiBook,
  BiTv,
  BiPlay,
  BiX,
  BiArrowToBottom,
  BiChevronDown,
  BiChevronUp,
} from "react-icons/bi";
import { data, useNavigate, useParams } from "react-router";
import { useState } from "react";
import { Button } from "@heroui/react";
import { jellyfinClient } from "@/api/jellyfin";
import { useDataContext } from "@/context";

interface EpisodesProps {
  data: any;
}

export default function Episodes({ data }: EpisodesProps) {
  const { episodeId } = useParams();
  if (!data) {
    return <div>Episodes not found</div>;
  }

  const handleJumpToEpisode = (episodeId: string) => {
    document.getElementById("content")?.scrollTo({
      top: document.getElementById(episodeId)?.offsetTop,
      behavior: "smooth",
    });
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
        {data.episodes.map((episode, index) => (
          <EpisodeCard
            key={episode.metadata.Id}
            arcId={data.id.toString()}
            episode={episode}
            isWatching={episodeId === episode.id.toString()}
            isWatched={episode.metadata.UserData?.Played}
          />
        ))}
      </div>
      {/* <Button
        isIconOnly
        size="lg"
        className="fixed bottom-10 right-10"
        onPress={() =>
          document
            .getElementById("content")
            ?.scrollTo({ top: 0, behavior: "smooth" })
        }
      >
        <BiChevronUp />
      </Button> */}
    </div>
  );
}

function ticksToMinutes(ticks: number): number {
  return (ticks / 10000000 / 60).toFixed(2);
}

interface EpisodeCardProps {
  arcId: string;
  episode: any;
  isPlaying: boolean;
  isWatched?: boolean;
  isWatching?: boolean;
}
function EpisodeCard({
  arcId,
  episode,
  isWatched,
  isWatching,
}: EpisodeCardProps) {
  const { refreshData } = useDataContext();
  const navigate = useNavigate();
  const handleNavigate = (episodeId: number) =>
    navigate(`/${arcId}/${episodeId}`);
  const [isHovering, setIsHovering] = useState(false);
  const [isHoveringFinished, setIsHoveringFinished] = useState(false);

  const handleFinish = async () => {
    await jellyfinClient.unmarkPlayedItem(episode.metadata.Id);

    refreshData();
  };

  return (
    <div
      key={episode.metadata.Id}
      id={episode.id.toString()}
      className={`flex items-start gap-4 rounded-2xl px-2  py-2 hover:bg-default/10 sm:flex-row sm:items-start flex-col w-full`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={`lg:w-64 w-full  rounded-sm flex justify-center items-center brightness-80 hover:brightness-100 transition-all duration-300 ${isHovering ? "brightness-100" : "brightness-80"}`}
        style={{
          aspectRatio: "16 / 9",
          backgroundImage: `url(${jellyfinClient.getItemImageUrl(episode.metadata?.Id || "")})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {isHovering && (
          <Button
            variant={"tertiary"}
            isIconOnly
            className="rounded-full mx-4 text-sm p-2"
            onPress={() => handleNavigate(episode.id.toString())}
          >
            <BiPlay size={24} />
          </Button>
        )}
        <Chip
          size="sm"
          color="default"
          className="gap-1 absolute bottom-2 right-2 "
        >
          <FiClock />
          {ticksToMinutes(episode.metadata?.RunTimeTicks || 0)}
        </Chip>
      </div>

      <div className="flex flex-col gap-1 pr-3 pb-2">
        <span className="flex items-center gap-2 ">
          {isWatching && (
            <Chip size="sm" color="accent">
              <BiPlay /> Watching
            </Chip>
          )}
          <p
            className={`hover:underline cursor-pointer text-md font-semibold ${isWatching ? "text-accent" : ""} ${isWatched ? "line-through opacity-70" : ""}`}
            onClick={() => handleNavigate(episode.id.toString())}
          >
            {episode.title}
          </p>
          {isWatched && (
            <Chip
              size="sm"
              color="success"
              className="cursor-pointer hover:bg-success/10 hover:text-success  transition-all duration-200 hover:opacity-90"
              onMouseEnter={() => setIsHoveringFinished(true)}
              onMouseLeave={() => setIsHoveringFinished(false)}
              onClick={handleFinish}
            >
              {isHoveringFinished ? <BiX /> : <BiCheck />} Finished
            </Chip>
          )}
        </span>
        <span className="flex items-center gap-2 my-1 ">
          <Chip color="default" className="gap-1" size="sm">
            <BiBook />
            {episode?.coverage?.manga}
          </Chip>
          <Chip color="default" className="gap-1" size="sm">
            <BiTv />
            {episode?.coverage?.anime}
          </Chip>
        </span>
        <p className="text-muted text-sm max-w-2xl">{episode.description}</p>
      </div>
    </div>
  );
}
