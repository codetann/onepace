import { createContext, useContext } from "react";
import type { Arc, Episode } from "@/typings";
import type { JellyfinUser } from "@/api/jellyfin";

export interface EpisodeProgressData {
  played: boolean;
  ticks: number;
  runtime: number;
  percent: number;
  itemId?: string;
}

export const DataContext = createContext({
  user: null,
  arc: null,
  episode: null,
  arcs: [],
  userDataMap: {} as Record<string, EpisodeProgressData>,
  nextArc: null,
  previousArc: null,
  nextEpisode: null,
  previousEpisode: null,
  navigate: null as unknown as (path: string) => void,
  refreshData: () => null,
  login: null as unknown as (email: string, password: string) => Promise<void>,
  logout: null as unknown as () => void,
  isEpisodePlayed: (() => false) as (arcId: number, episodeId: number) => boolean,
  getEpisodeProgress: (() => ({ played: false, ticks: 0, runtime: 0, percent: 0 })) as (
    arcId: number,
    episodeId: number,
  ) => EpisodeProgressData,
  toggleEpisodePlayed: (async () => {}) as (arcId: number, episodeId: number) => Promise<void>,
  isLoadingArc: false,
  isLoadingEpisode: false,
} as {
  user: JellyfinUser | null;
  arc: Arc | null;
  episode: Episode | null;
  arcs: Arc[];
  userDataMap: Record<string, EpisodeProgressData>;
  nextArc: Arc | null;
  previousArc: Arc | null;
  nextEpisode: Episode | null;
  previousEpisode: Episode | null;
  navigate: (path: string) => void;
  refreshData: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isEpisodePlayed: (arcId: number, episodeId: number) => boolean;
  getEpisodeProgress: (arcId: number, episodeId: number) => EpisodeProgressData;
  toggleEpisodePlayed: (arcId: number, episodeId: number) => Promise<void>;
  isLoadingArc: boolean;
  isLoadingEpisode: boolean;
});

export const useDataContext = () => {
  return useContext(DataContext);
};
