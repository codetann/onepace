import type { Episode, Arc } from "@/typings";
import { create } from "zustand";
import { DATA } from "@/data/data";
import { useNavigate, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { jellyfinClient } from "@/api/jellyfin/client";

interface ApplicationStore {
  selectedArc: Arc | null;
  setSelectedArc: (arc: Arc) => void;
  selectedEpisode: Episode | null;
  setSelectedEpisode: (arcId: number, episode: Episode) => void;
  arcs: Arc[];
  tools: {
    navigate: null | ((arcId: number, episodeId?: number) => void);
  };
  setTools: (tools: {
    navigate: null | ((arcId: number, episodeId?: number) => void);
  }) => void;
  goToNextArc: () => void;
  goToPreviousArc: () => void;
  goToNextEpisode: () => void;
  goToPreviousEpisode: () => void;
  initialize: (arcId: number, episodeId?: number) => void;
}

export const useApplicationStore = create<ApplicationStore>((set, get) => ({
  tools: {
    navigate: null,
  },
  selectedArc: null,
  setSelectedArc: (arc) => {
    set({ selectedArc: arc });
    get().tools.navigate?.(arc.id);
  },
  selectedEpisode: null,
  setSelectedEpisode: (arcId, episode) => {
    set({ selectedEpisode: episode });
    get().tools.navigate?.(arcId, episode.id);
  },
  setTools: (tools) => {
    set({ tools });
  },
  goToNextArc: () => {
    const { selectedArc } = get();
    if (selectedArc) {
      get().tools.navigate?.(selectedArc.id + 1);
    }
  },
  goToPreviousArc: () => {
    const { selectedArc } = get();
    if (selectedArc) {
      get().tools.navigate?.(selectedArc.id - 1);
    }
  },
  goToNextEpisode: () => {
    const { selectedEpisode } = get();
    if (selectedEpisode) {
      get().tools.navigate?.(selectedEpisode.id + 1);
    }
  },
  goToPreviousEpisode: () => {
    const { selectedEpisode } = get();
    if (selectedEpisode) {
      get().tools.navigate?.(selectedEpisode.id - 1);
    }
  },
  initialize: (arcId: number, episodeId?: number) => {
    const { setSelectedArc, setSelectedEpisode } = get();
    const arc = DATA.arcs.find((arc) => arc.id === arcId);
    if (arc) {
      setSelectedArc(arc);
    }
    if (episodeId) {
      const episode = arc?.episodes.find((episode) => episode.id === episodeId);
      if (episode) {
        setSelectedEpisode(arcId, episode);
      }
    }
  },
  getPreviousArc: () => {
    const { selectedArc } = get();
    if (selectedArc) {
      return DATA.arcs.find((arc) => arc.id === selectedArc.id - 1);
    }
    return null;
  },
  getNextArc: () => {
    const { selectedArc } = get();
    if (selectedArc) {
      return DATA.arcs.find((arc) => arc.id === selectedArc.id + 1);
    }
    return null;
  },
  arcs: DATA.arcs,
}));

export const useInitializeApplicationStore = () => {
  const navigate = useNavigate();
  const { arcId, episodeId } = useParams();
  const { setTools, initialize } = useApplicationStore();
  useEffect(() => {
    setTools({
      navigate: (arcId, episodeId) =>
        navigate(`/${arcId}${episodeId ? `/${episodeId}` : ""}`),
    });
  }, [navigate, setTools]);

  useEffect(() => {
    initialize(parseInt(arcId || "0"), parseInt(episodeId || "0"));
  }, [arcId, episodeId]);
};

export const useApplicationData = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [selectedArc, setSelectedArc] = useState<Arc | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  // set selected arc when arcId changes
  useEffect(() => {
    const fetchData = async () => {
      const arc = DATA.arcs.find(
        (arc) => arc.id === parseInt(params.arcId || "0"),
      );

      if (!arc) return;
      console.log(arc);
      const arcData = await jellyfinClient.getItem(arc?.showId || "");
      const episodes = await jellyfinClient.getEpisodesForSeason(
        arc?.showId || "",
      );
      setSelectedArc({
        ...arc,
        metadata: arcData,
        episodes: arc?.episodes.map((episode, index) => ({
          ...episode,
          metadata: episodes[index],
        })),
      } as Arc);
    };
    fetchData();
  }, [params.arcId]);

  // set selected episode when episodeId changes
  useEffect(() => {
    if (!selectedArc) return;

    const fetchData = async () => {
      const episode = selectedArc?.episodes.find(
        (episode) => episode.id === parseInt(params.episodeId || "0"),
      );
      if (!episode) return;
      const url = await jellyfinClient.getEpisodeStreamUrl(
        episode?.metadata?.Id || "",
      );
      setSelectedEpisode({
        ...episode,
        metadata: {
          ...episode.metadata,
          videoUrl: url,
        },
      });
    };
    fetchData();
  }, [params.episodeId, selectedArc]);

  const navigateTo = (arcId: number, episodeId?: number) => {
    navigate(`/${arcId}${episodeId ? `/${episodeId}` : ""}`);
  };

  const nextArc = useMemo(() => {
    if (!selectedArc) return null;
    return DATA.arcs.find((arc) => arc.id === selectedArc.id + 1);
  }, [selectedArc]);
  const previousArc = useMemo(() => {
    if (!selectedArc) return null;
    return DATA.arcs.find((arc) => arc.id === selectedArc.id - 1);
  }, [selectedArc]);
  const nextEpisode = useMemo(() => {
    if (!selectedEpisode) return null;

    return (
      selectedArc?.episodes.find(
        (episode) => episode.id === selectedEpisode.id + 1,
      ) || null
    );
  }, [selectedEpisode, selectedArc]);
  const previousEpisode = useMemo(() => {
    if (!selectedEpisode) return null;
    return (
      selectedArc?.episodes.find(
        (episode) => episode.id === selectedEpisode.id - 1,
      ) || null
    );
  }, [selectedEpisode, selectedArc]);
  return {
    selectedArc,
    selectedEpisode,
    navigateTo,
    nextArc,
    previousArc,
    nextEpisode,
    previousEpisode,
  };
};
