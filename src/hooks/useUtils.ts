import { useNavigate } from "react-router";
import { useArc, useArcs } from "@/hooks";
import { useMemo } from "react";

export const useUtils = () => {
  const navigate = useNavigate();
  const { arc } = useArc();
  const { arcs } = useArcs();

  const nextArc = useMemo(() => {
    if (!arc) return null;
    return arcs.find((a) => a.id === arc.id + 1);
  }, [arc, arcs]);

  const previousArc = useMemo(() => {
    if (!arc) return null;
    return arcs.find((a) => a.id === arc.id - 1);
  }, [arc, arcs]);

  const nextEpisode = useMemo(() => {
    if (!arc?.episodes?.length) return null;
    return arc.episodes[0] ?? null;
  }, [arc]);
  const previousEpisode = useMemo(() => {
    if (!arc?.episodes?.length) return null;
    return arc.episodes[0] ?? null;
  }, [arc]);
  const navigateTo = (arcId: number, episodeId?: number) => {
    navigate(`/${arcId}${episodeId ? `/${episodeId}` : ""}`);
  };

  return {
    navigateTo,
    nextArc,
    previousArc,
    nextEpisode,
    previousEpisode,
  };
};
