import { createContext, useContext } from "react";
import type { Arc, Episode } from "@/typings";

export const DataContext = createContext({
  arc: null,
  episode: null,
  arcs: [],
  nextArc: null,
  previousArc: null,
  nextEpisode: null,
  previousEpisode: null,
  navigate: null as unknown as (path: string) => void,
  refreshData: () => null,
} as {
  arc: Arc | null;
  episode: Episode | null;
  arcs: Arc[];
  nextArc: Arc | null;
  previousArc: Arc | null;
  nextEpisode: Episode | null;
  previousEpisode: Episode | null;
  navigate: (path: string) => void;
  refreshData: () => void;
});

export const useDataContext = () => {
  return useContext(DataContext);
};
