import { Episodes, Layout } from "@/components";
import { Button, Chip, Spinner } from "@heroui/react";
import {
  BiStar,
  BiTv,
  BiBook,
  BiChevronLeft,
  BiChevronRight,
} from "react-icons/bi";
import { AnimatePresence, motion } from "framer-motion";
import { useDataContext } from "@/context";
import { useParams } from "react-router";
import { DATA } from "@/data/data";
import type { Arc } from "@/typings";

export default function ArcPage() {
  const { arc, nextArc, previousArc, navigate, isLoadingArc } = useDataContext();
  const { arcId } = useParams();

  const parsedArcId = parseInt(arcId || "0", 10);
  const targetArc = DATA.arcs.find((a) => a.id === parsedArcId) as Arc | undefined;
  const currentArc = arc && arc.id === parsedArcId ? arc : targetArc;

  if (!currentArc) {
    if (isLoadingArc) {
      return (
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 w-full">
            <Spinner size="lg" color="accent" />
            <p className="text-white/60 text-sm animate-pulse">Loading arc...</p>
          </div>
        </Layout>
      );
    }

    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 w-full text-center">
          <h2 className="text-2xl font-bold text-white">Arc not found</h2>
          <p className="text-muted text-sm">We couldn't find the arc you're looking for.</p>
          <Button variant="primary" onPress={() => navigate("/1")}>
            Back to Romance Dawn
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex w-full flex-col">
        <section className="flex flex-col gap-3 relative justify-center items-center">
          <div className="w-full flex justify-between items-start flex-row relative z-20 overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-3 z-20 p-4 sm:p-6 pb-6 sm:pb-7 w-full">
              <div className="flex flex-col sm:flex-row gap-5 w-full">
                <AnimatePresence>
                  <motion.img
                    key={currentArc.altImage}
                    src={currentArc.altImage}
                    className="w-full sm:w-72 rounded-xl shrink-0 object-cover shadow-lg"
                    alt={currentArc.title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                </AnimatePresence>

                <div className="flex flex-col gap-2.5 w-full justify-end">
                  <p className="text-white/90 text-sm">
                    {currentArc.episodes?.length} Episodes
                  </p>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <Chip color="warning">
                      <BiStar className="size-4" />
                      {currentArc.averageRating}
                    </Chip>

                    <Chip size="sm" color="accent" className="gap-1">
                      <BiBook />
                      {currentArc.coverage?.manga}
                    </Chip>
                    <Chip size="sm" color="accent" className="gap-1">
                      <BiTv />
                      {currentArc.coverage?.anime}
                    </Chip>
                  </span>
                  <h3 className="text-3xl sm:text-4xl font-semibold text-white pb-0.5">
                    {currentArc.title}
                  </h3>

                  <p className="text-white/85 text-sm max-w-xl leading-relaxed">
                    {currentArc.description}
                  </p>
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full pt-4 pb-1">
                    {previousArc ? (
                      <Button
                        variant="ghost"
                        onPress={() => navigate(`/${previousArc.id}`)}
                        className="text-white rounded-lg cursor-pointer"
                      >
                        <BiChevronLeft className="size-4" />
                        {previousArc.title}
                      </Button>
                    ) : (
                      <div />
                    )}
                    {nextArc && (
                      <Button
                        className="rounded-lg cursor-pointer"
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
            <div className="w-full absolute left-0 top-0 h-full bg-gradient-to-b from-transparent to-black/90 z-10 rounded-2xl" />
            <AnimatePresence>
              <motion.div
                className="w-full absolute left-0 top-0 h-full rounded-2xl"
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
          <Episodes data={currentArc} />
        </section>
      </div>
    </Layout>
  );
}
