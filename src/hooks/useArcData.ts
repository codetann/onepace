import { jellyfinClient } from "@/api/jellyfin/client";
import { DATA } from "@/data/data";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import type { Arc } from "@/typings";

export const useArcData = () => {
  const { arcId } = useParams();
  const location = useLocation();
  const [_data, setData] = useState<Arc | null>(() => {
    const arc = DATA.arcs.find((arc) => arc.id === parseInt(arcId || "0"));
    if (arc) {
      return arc;
    }
    return null;
  });

  useEffect(() => {
    const arc = DATA.arcs.find((arc) => arc.id === parseInt(arcId || "0"));
    const fetchData = async () => {
      const arcData = await jellyfinClient.getItem(arc?.showId || "");
      console.log(arcData);
      const episodes = await jellyfinClient.getEpisodesForSeason(
        arc?.showId || "",
      );
      setData({
        ...arc,
        metadata: arcData,
        episodes: arc?.episodes.map((episode, index) => ({
          ...episode,
          metadata: episodes[index],
        })),
      } as unknown as Arc);
    };
    fetchData();
  }, [arcId, location.pathname]);

  useEffect(() => {
    console.log(arcId);
  }, [_data]);

  return _data;
};
