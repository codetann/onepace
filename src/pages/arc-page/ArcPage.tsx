import { Episodes, Layout } from "@/components";
import { useEffect, useState } from "react";
import { Breadcrumbs, Button, Chip } from "@heroui/react";
import { BiLinkExternal, BiPlay, BiStar, BiTv, BiUser } from "react-icons/bi";
import { FiClock } from "react-icons/fi";
import { BiBook, BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { BiCheck } from "react-icons/bi";
import { useNavigate, useParams } from "react-router";
import { DATA } from "@/data/data";
import { jellyfinClient } from "@/api/jellyfin";
import { useArc, useUtils } from "@/hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useDataContext } from "@/context";

export default function ArcPage() {
  const { arc, nextArc, previousArc, navigate } = useDataContext();

  if (!arc) {
    return <div>Arc not found</div>;
  }

  return (
    <Layout>
      <div className=" flex w-full  flex-col ">
        {/* <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between relative">
          <div>
          </div>

        </header> */}

        <section className="flex flex-col gap-3 relative justify-center items-center">
          <div className="w-full pt-2 flex justify-between items-start flex-row relative z-20">
            <div className="flex flex-col gap-2  z-20  sm:px-3 sm:py-2 sm:pb-5 px-2 w-full">
              <div className="flex flex-col sm:flex-row gap-4 w-full ">
                <AnimatePresence>
                  <motion.img
                    key={arc.altImage}
                    src={arc.altImage}
                    className="w-full sm:w-76 rounded-md shrink-0 "
                    alt={arc.title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                </AnimatePresence>

                <div className="flex flex-col gap-2  w-full justify-end">
                  <p className="text-white/90 text-sm ">
                    {arc.episodes?.length} Episodes
                  </p>
                  <span className="flex items-center gap-1 ">
                    <Chip color="warning">
                      <BiStar className="size-4" />
                      {arc.averageRating}
                    </Chip>

                    <Chip size="sm" color="accent" className="gap-1">
                      <BiBook />
                      {arc.coverage?.manga}
                    </Chip>
                    <Chip size="sm" color="accent" className="gap-1">
                      <BiTv />
                      {arc.coverage?.anime}
                    </Chip>
                  </span>
                  <h3 className="text-4xl font-semibold text-white pb-1">
                    {arc.title}
                  </h3>

                  <p className="text-muted text-sm max-w-xl leading-relaxed">
                    {arc.description}
                  </p>
                  <div className="flex justify-end items-center gap-2 w-full pt-2">
                    {previousArc && (
                      <Button
                        variant="ghost"
                        onPress={() => navigate(`/${previousArc.id}`)}
                        className="text-white rounded-lg"
                      >
                        <BiChevronLeft className="size-4" />
                        {previousArc.title}
                      </Button>
                    )}
                    {nextArc && (
                      <Button
                        className="rounded-lg"
                        variant="primary"
                        onPress={() => navigate(`/${nextArc.id}`)}
                      >
                        {nextArc.title}
                        <BiChevronRight className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* dark overlay gradient */}
            <div className="w-full absolute left-0 top-0 h-full bg-gradient-to-b from-transparent to-black/90 z-10  rounded-lg" />
            <AnimatePresence>
              <motion.div
                className="w-full absolute left-0 top-0 h-full rounded-lg "
                style={{
                  backgroundImage:
                    // "url(https://e0.pxfuel.com/wallpapers/634/129/desktop-wallpaper-one-piece-one-piece-going-merry.jpg)",
                    "url(https://images5.alphacoders.com/132/1329624.png)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              />
            </AnimatePresence>
          </div>
          {/* all episodes */}
          <Episodes data={arc} />

          {/* <DashboardFooter
            pageUrl={EXAMPLE_EPISODE.pageUrl}
            playerUrl={EXAMPLE_EPISODE.playerIframeSrc}
            sourceLabel={EXAMPLE_EPISODE.sourceLabel}
          /> */}
        </section>
      </div>
    </Layout>
  );
}

interface DashboardFooterProps {
  pageUrl: string;
  playerUrl: string;
  sourceLabel: string;
}

function DashboardFooter({
  pageUrl,
  playerUrl,
  sourceLabel,
}: DashboardFooterProps) {
  return (
    <footer className=" bg-default-50 w-full  border-t border-default-100 pt-4 ">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <Chip size="sm" className="gap-1">
          <BiUser />
          Source
        </Chip>
        <span className="text-sm">{sourceLabel}</span>
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <p className="text-muted">
          Episode page:{" "}
          <a
            href={pageUrl}
            className="text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {pageUrl}
          </a>
        </p>
        <p className="text-muted">
          Player iframe URL:{" "}
          <a
            href={playerUrl}
            className="text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {playerUrl}
          </a>
        </p>
        <p className="text-muted flex items-center gap-1">
          <BiLinkExternal className="size-3" />
          Mirror hosts can rotate links over time.
        </p>
      </div>
    </footer>
  );
}
interface EpisodeProps {
  title: string;
  description: string;
  episode: string;
  isPlaying: boolean;
  isWatched?: boolean;
  image: string;
}
function Episode({
  title,
  description,
  episode,
  isPlaying,
  isWatched,
  image,
  arcId,
  episodeId,
}: EpisodeProps) {
  const navigate = useNavigate();
  const handleNavigate = (episode: string) =>
    navigate(`/${arcId}/${episodeId}`);
  const [isHovering, setIsHovering] = useState(false);
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl px-2 py-2 hover:bg-default/10 sm:flex-row sm:items-start flex-col w-full`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={`lg:w-64 w-full  rounded-sm flex justify-center items-center brightness-80 hover:brightness-100 transition-all duration-300 ${isHovering ? "brightness-100" : "brightness-80"}`}
        style={{
          aspectRatio: "16 / 9",
          backgroundImage: `url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Button
          variant={"tertiary"}
          isIconOnly
          className="rounded-full mx-4 text-sm p-2"
          onPress={() => handleNavigate(episode)}
        >
          <BiPlay size={24} />
        </Button>

        <Chip
          size="sm"
          color="default"
          className="gap-1 absolute bottom-2 right-2 sm:bottom-0.5 sm:right-0.5 "
        >
          <FiClock />
          42.12
        </Chip>
      </div>

      {/* <Button
        variant={"ghost"}
        size="lg"
        isIconOnly
        className="rounded-full mx-4 text-sm p-6"
        onPress={() => handleNavigate(episode)}
      >
        {episode}.
      </Button> */}
      <div className="flex flex-col gap-1 pr-3 pb-2">
        <span className="flex items-center gap-2 ">
          {isWatched && (
            <Chip size="sm" color="success">
              <BiCheck /> Finished
            </Chip>
          )}
          <p
            className="hover:underline cursor-pointer text-md font-semibold"
            onClick={() => handleNavigate(episode)}
          >
            {title}
          </p>
        </span>
        <span className="flex items-center gap-2 ">
          <Chip color="warning" size="sm">
            <BiStar className="size-4" />
            9.5
          </Chip>

          <Chip color="default" className="gap-1" size="sm">
            <BiBook />
            106-114
          </Chip>
          <Chip color="default" className="gap-1" size="sm">
            <BiTv />
            64-68
          </Chip>
        </span>
        <p className="text-muted text-sm max-w-2xl">{description}</p>
      </div>
    </div>
  );
}
