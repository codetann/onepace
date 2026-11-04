import { useState } from "react";
import { getArcBackground } from "@/utils";
import { Episodes, Layout } from "@/components";
import { Button, Chip, Spinner } from "@heroui/react";
import {
  BiStar,
  BiTv,
  BiBook,
  BiChevronLeft,
  BiChevronRight,
} from "react-icons/bi";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useDataContext } from "@/context";
import { useParams } from "react-router";
import { DATA } from "@/data/data";
import type { Arc } from "@/typings";

const detailsVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.12,
    },
  },
};

const itemVariant: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export default function ArcPage() {
  const {
    arc,
    nextArc,
    previousArc,
    navigate,
    isLoadingArc,
  } = useDataContext();
  const { arcId } = useParams();

  const parsedArcId = parseInt(arcId || "0", 10);
  const targetArc = DATA.arcs.find((a) => a.id === parsedArcId) as Arc | undefined;
  const currentArc = arc && arc.id === parsedArcId ? arc : targetArc;
  const arcBackground = getArcBackground(currentArc);
  const [loadedPosterUrl, setLoadedPosterUrl] = useState<string | null>(null);
  const isPosterLoaded = Boolean(
    currentArc?.altImage && loadedPosterUrl === currentArc.altImage,
  );

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
      <motion.div
        key={`arc-page-${currentArc.id}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full flex-col"
      >
        <section className="flex flex-col gap-3 relative justify-center items-center">
          <div className="w-full flex flex-col justify-end relative z-20 overflow-hidden rounded-2xl min-h-[600px] sm:min-h-[680px] shadow-2xl">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-end justify-between z-20 p-5 sm:p-8 pb-6 sm:pb-8 w-full">
              {/* Poster and Details anchored bottom-left */}
              <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-end flex-1 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentArc.altImage}
                    initial={{ opacity: 0, y: 28, scale: 0.9, rotate: -1.5 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 16 }}
                    whileHover={{ scale: 1.04, rotate: 0.8, transition: { duration: 0.25 } }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", damping: 18, stiffness: 140 }}
                    className="relative w-44 sm:w-52 md:w-56 rounded-xl shrink-0 overflow-hidden shadow-2xl aspect-[2/3] cursor-pointer bg-zinc-900/80"
                  >
                    {!isPosterLoaded && (
                      <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-pulse" />
                    )}
                    <motion.img
                      src={currentArc.altImage}
                      alt={currentArc.title}
                      onLoad={() => setLoadedPosterUrl(currentArc.altImage)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isPosterLoaded ? 1 : 0 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                </AnimatePresence>

                <motion.div
                  variants={detailsVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col gap-2.5 max-w-xl"
                >
                  <motion.p
                    variants={itemVariant}
                    className="text-white/80 text-xs sm:text-sm font-medium"
                  >
                    {currentArc.episodes?.length} Episodes
                  </motion.p>
                  <motion.span
                    variants={itemVariant}
                    className="flex items-center gap-1.5 flex-wrap"
                  >
                    <Chip color="warning" size="sm">
                      <BiStar className="size-3.5" />
                      {currentArc.averageRating}
                    </Chip>

                    <Chip size="sm" color="accent" className="gap-1">
                      <BiBook className="size-3.5" />
                      {currentArc.coverage?.manga}
                    </Chip>
                    <Chip size="sm" color="accent" className="gap-1">
                      <BiTv className="size-3.5" />
                      {currentArc.coverage?.anime}
                    </Chip>
                  </motion.span>
                  <motion.h3
                    variants={itemVariant}
                    className="text-2xl sm:text-4xl font-bold text-white tracking-tight pb-0.5"
                  >
                    {currentArc.title}
                  </motion.h3>

                  <motion.p
                    variants={itemVariant}
                    className="text-white/85 text-xs sm:text-sm leading-relaxed"
                  >
                    {currentArc.description}
                  </motion.p>
                </motion.div>
              </div>

              {/* Prev / Next buttons at bottom-right */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 22 }}
                className="flex items-center gap-2.5 shrink-0 self-end"
              >
                {previousArc && (
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => navigate(`/${previousArc.id}`)}
                      className="text-white bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 rounded-lg cursor-pointer"
                    >
                      <BiChevronLeft className="size-4" />
                      {previousArc.title}
                    </Button>
                  </motion.div>
                )}
                {nextArc && (
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="sm"
                      className="rounded-lg cursor-pointer shadow-md"
                      variant="primary"
                      onPress={() => navigate(`/${nextArc.id}`)}
                    >
                      {nextArc.title}
                      <BiChevronRight className="size-4" />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </div>
            {/* dark overlay gradient */}
            <div className="w-full absolute left-0 top-0 h-full bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10 rounded-2xl pointer-events-none" />
            <AnimatePresence mode="wait">
              <motion.div
                key={arcBackground}
                className="w-full absolute left-0 top-0 h-full rounded-2xl"
                style={{
                  backgroundImage: `url(${arcBackground})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
          </div>
          {/* all episodes */}
          <Episodes data={currentArc} />
        </section>
      </motion.div>
    </Layout>
  );
}
