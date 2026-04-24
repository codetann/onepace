import { useMemo, useEffect, useState } from "react";
import { DATA } from "@/data/data";
import { Outlet, useNavigate, useParams } from "react-router";
import { jellyfinClient } from "@/api/jellyfin";
import type { Arc, Episode } from "@/typings";
import { DataContext } from "./DataContext";

export const DataProvider = () => {
  const [arc, setArc] = useState<Arc | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const { arcId, episodeId } = useParams();
  const navigate = useNavigate();

  const refreshData = async () => {
    const arc = DATA.arcs.find((arc) => arc.id === parseInt(arcId || "0", 10));
    if (!arc) return null;
    const arcResponse = await jellyfinClient.getItem(arc?.showId || "");
    const episodesResponse = await jellyfinClient.getEpisodesForSeason(
      arc?.showId || "",
    );
    setArc({
      ...arc,
      metadata: arcResponse,
      episodes: arc.episodes.map((episode, index) => ({
        ...episode,
        metadata: episodesResponse[index],
      })),
    } as Arc);
  };

  // handle setting the arc when the arcId changes
  useEffect(() => {
    if (!arcId) {
      setArc(null);
      return;
    }
    const fetchMetadata = async () => {
      const arc = DATA.arcs.find((arc) => arc.id === parseInt(arcId, 10));
      if (!arc) return null;
      const arcResponse = await jellyfinClient.getItem(arc?.showId || "");
      const episodesResponse = await jellyfinClient.getEpisodesForSeason(
        arc?.showId || "",
      );

      setArc({
        ...arc,
        metadata: arcResponse,
        episodes: arc.episodes.map((episode, index) => ({
          ...episode,
          metadata: episodesResponse[index],
        })),
      } as Arc);
    };
    fetchMetadata();
  }, [arcId]);

  // handle setting the episode when the episodeId changes
  useEffect(() => {
    if (!episodeId) {
      setEpisode(null);
      return;
    }
    const fetchEpisode = async () => {
      const episode = arc?.episodes.find(
        (episode) => episode.id === parseInt(episodeId, 10),
      );
      if (!episode) return null;

      const videoInfo = await jellyfinClient.getEpisodeStreamUrl(
        episode?.metadata?.Id || "",
      );
      console.log(videoInfo);
      setEpisode({
        ...episode,
        video: videoInfo,
      } as Episode);
    };
    fetchEpisode();
  }, [episodeId, arc]);

  const nextArc = useMemo(() => {
    return DATA.arcs.find((_arc) => _arc.id === arc?.id + 1) || null;
  }, [arc, arcId]);
  const previousArc = useMemo(() => {
    return DATA.arcs.find((_arc) => _arc.id === arc?.id - 1) || null;
  }, [arc, arcId]);
  const nextEpisode = useMemo(() => {
    return (
      arc?.episodes.find((_episode) => _episode.id === episode?.id + 1) || null
    );
  }, [episode, episodeId]);
  const previousEpisode = useMemo(() => {
    return (
      arc?.episodes.find((_episode) => _episode.id === episode?.id - 1) || null
    );
  }, [episode, episodeId]);

  return (
    <DataContext.Provider
      value={{
        arc,
        episode,
        arcs: DATA.arcs,
        nextArc,
        previousArc,
        nextEpisode,
        previousEpisode,
        navigate,
        refreshData,
      }}
    >
      <Outlet />
    </DataContext.Provider>
  );
};
