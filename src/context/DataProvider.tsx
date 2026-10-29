import { useMemo, useEffect, useState, useCallback } from "react";
import { DATA } from "@/data/data";
import { Outlet, useNavigate, useParams } from "react-router";
import { jellyfinClient, type JellyfinUser } from "@/api/jellyfin";
import type { Arc, Episode } from "@/typings";
import { DataContext, type EpisodeProgressData, type ContinueWatchingTarget } from "./DataContext";

const CONTINUE_KEY = "onepace:continueWatching";

const readStoredUser = (): JellyfinUser | null => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if ("User" in parsed && parsed.User) return parsed.User as JellyfinUser;
      if ("Id" in parsed && "Name" in parsed) return parsed as JellyfinUser;
    }
  } catch {
    /* ignore */
  }
  return null;
};

export const DataProvider = () => {
  const { arcId, episodeId } = useParams();
  const [arc, setArc] = useState<Arc | null>(() => {
    const initialArcId = parseInt(arcId || "0", 10);
    return DATA.arcs.find((a) => a.id === initialArcId) || null;
  });
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isLoadingArc, setIsLoadingArc] = useState<boolean>(false);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState<boolean>(false);
  const [user, setUser] = useState<JellyfinUser | null>(readStoredUser);
  const [userDataMap, setUserDataMap] = useState<Record<string, EpisodeProgressData>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const cachedUser = localStorage.getItem("user");
    if (!cachedUser && location.pathname !== "/login") {
      navigate("/login");
    }
  }, [navigate]);

  const loadAllUserData = useCallback(async () => {
    try {
      const userId = user?.Id || jellyfinClient.getCurrentUserId();
      if (!userId) return;
      const response = await jellyfinClient.getItems(userId, {
        Recursive: true,
        IncludeItemTypes: "Episode",
        Fields: "UserData",
      });

      const map: Record<string, EpisodeProgressData> = {};
      response.Items.forEach((item) => {
        const seasonId = item.SeasonId || item.ParentId;
        const indexNumber = item.IndexNumber;
        const ticks = item.UserData?.PlaybackPositionTicks || 0;
        const runtime = item.RunTimeTicks || 0;
        const played = Boolean(item.UserData?.Played);
        const percent =
          runtime > 0 ? Math.min(100, Math.round((ticks / runtime) * 100)) : 0;

        const data: EpisodeProgressData = {
          played,
          ticks,
          runtime,
          percent,
          itemId: item.Id,
        };

        if (item.Id) {
          map[item.Id] = data;
        }
        if (seasonId !== undefined && indexNumber !== undefined) {
          map[`${seasonId}-${indexNumber}`] = data;
        }
      });

      setUserDataMap(map);
    } catch (err) {
      console.warn("Could not load user playback data:", err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadAllUserData();
    }
  }, [user, loadAllUserData]);

  const login = async (email: string, password: string) => {
    const auth = await jellyfinClient.authenticateUserByName({
      Username: email,
      Pw: password,
    });
    if (!auth?.User?.Id) return;
    setUser(auth.User);
    localStorage.setItem("user", JSON.stringify(auth));
  };

  const logout = useCallback(() => {
    setUser(null);
    setUserDataMap({});
    localStorage.removeItem("user");
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    return jellyfinClient.onUnauthorized(() => {
      logout();
    });
  }, [logout]);

  const refreshData = useCallback(async () => {
    void loadAllUserData();
    const currentArc = DATA.arcs.find((a) => a.id === parseInt(arcId || "0", 10));
    if (!currentArc) return null;
    try {
      const arcResponse = await jellyfinClient.getItem(currentArc?.showId || "");
      const episodesResponse = await jellyfinClient.getEpisodesForSeason(
        currentArc?.showId || "",
      );
      const updatedArc = {
        ...currentArc,
        metadata: arcResponse,
        episodes: currentArc.episodes.map((ep, index) => {
          const meta =
            episodesResponse.find((item) => item.IndexNumber === ep.id) ??
            episodesResponse[index];
          return {
            ...ep,
            metadata: meta,
          };
        }),
      } as Arc;
      setArc(updatedArc);

      if (episodeId) {
        const ep = updatedArc.episodes.find(
          (e) => e.id === parseInt(episodeId, 10),
        );
        if (ep) {
          setEpisode((prev) => (prev ? { ...prev, ...ep } : (ep as Episode)));
        }
      }
    } catch (err) {
      console.error("Failed to refresh Jellyfin data:", err);
    }
  }, [arcId, episodeId, loadAllUserData]);

  const isEpisodePlayed = useCallback(
    (targetArcId: number, targetEpisodeId: number): boolean => {
      const targetArc = DATA.arcs.find((a) => a.id === targetArcId);
      if (!targetArc?.showId) return false;
      const key = `${targetArc.showId}-${targetEpisodeId}`;
      const entry = userDataMap[key];
      if (entry) return entry.played;

      // Fallback to currently loaded arc episodes if in view
      if (arc?.id === targetArcId) {
        const ep = arc.episodes.find((e) => e.id === targetEpisodeId);
        if (ep?.metadata?.UserData) {
          return Boolean(ep.metadata.UserData.Played);
        }
      }
      return false;
    },
    [arc, userDataMap],
  );

  const getEpisodeProgress = useCallback(
    (targetArcId: number, targetEpisodeId: number): EpisodeProgressData => {
      const targetArc = DATA.arcs.find((a) => a.id === targetArcId);
      const fallback: EpisodeProgressData = {
        played: false,
        ticks: 0,
        runtime: 0,
        percent: 0,
      };
      if (!targetArc?.showId) return fallback;
      const key = `${targetArc.showId}-${targetEpisodeId}`;
      if (userDataMap[key]) {
        return userDataMap[key];
      }
      if (arc?.id === targetArcId) {
        const ep = arc.episodes.find((e) => e.id === targetEpisodeId);
        const ud = ep?.metadata?.UserData;
        const runtime = ep?.metadata?.RunTimeTicks || 0;
        const ticks = ud?.PlaybackPositionTicks || 0;
        const played = Boolean(ud?.Played);
        const percent =
          runtime > 0 ? Math.min(100, Math.round((ticks / runtime) * 100)) : 0;
        return {
          played,
          ticks,
          runtime,
          percent,
          itemId: ep?.metadata?.Id,
        };
      }
      return fallback;
    },
    [arc, userDataMap],
  );

  const toggleEpisodePlayed = useCallback(
    async (targetArcId: number, targetEpisodeId: number) => {
      const targetArc = DATA.arcs.find((a) => a.id === targetArcId);
      if (!targetArc?.showId) return;
      const key = `${targetArc.showId}-${targetEpisodeId}`;
      let itemId = userDataMap[key]?.itemId;

      if (!itemId && arc?.id === targetArcId) {
        const ep = arc.episodes.find((e) => e.id === targetEpisodeId);
        itemId = ep?.metadata?.Id;
      }

      if (!itemId) {
        // Resolve from jellyfin if needed
        const eps = await jellyfinClient.getEpisodesForSeason(targetArc.showId);
        const matched = eps.find((e) => e.IndexNumber === targetEpisodeId);
        itemId = matched?.Id;
      }

      if (!itemId) return;

      const currentlyPlayed = isEpisodePlayed(targetArcId, targetEpisodeId);
      if (currentlyPlayed) {
        await jellyfinClient.unmarkPlayedItem(itemId);
      } else {
        await jellyfinClient.markPlayedItem(itemId);
      }
      await refreshData();
    },
    [arc, isEpisodePlayed, userDataMap, refreshData],
  );

  // handle setting the arc when the arcId changes
  useEffect(() => {
    if (!arcId) {
      setArc(null);
      setIsLoadingArc(false);
      return;
    }

    const parsedArcId = parseInt(arcId, 10);
    const targetArc = DATA.arcs.find((a) => a.id === parsedArcId);
    if (!targetArc) {
      setArc(null);
      setIsLoadingArc(false);
      return;
    }

    // Immediately supply base arc from static data so UI is instantly responsive
    setArc((prev) => (prev?.id === targetArc.id ? prev : targetArc));
    setIsLoadingArc(true);

    let isCancelled = false;

    const fetchMetadata = async () => {
      try {
        const [arcResponse, episodesResponse] = await Promise.all([
          jellyfinClient.getItem(targetArc.showId || ""),
          jellyfinClient.getEpisodesForSeason(targetArc.showId || ""),
        ]);

        if (isCancelled) return;

        setArc({
          ...targetArc,
          metadata: arcResponse,
          episodes: targetArc.episodes.map((ep, index) => {
            const meta =
              episodesResponse.find((item) => item.IndexNumber === ep.id) ??
              episodesResponse[index];
            return {
              ...ep,
              metadata: meta,
            };
          }),
        } as Arc);
      } catch (err) {
        console.error("Failed to fetch arc metadata:", err);
      } finally {
        if (!isCancelled) {
          setIsLoadingArc(false);
        }
      }
    };

    void fetchMetadata();

    return () => {
      isCancelled = true;
    };
  }, [arcId]);

  // handle setting the episode when the episodeId changes
  useEffect(() => {
    if (!episodeId || !arcId) {
      setEpisode(null);
      setIsLoadingEpisode(false);
      return;
    }

    const parsedArcId = parseInt(arcId, 10);
    const parsedEpisodeId = parseInt(episodeId, 10);
    const targetArc = DATA.arcs.find((a) => a.id === parsedArcId);
    const baseEpisode = targetArc?.episodes.find(
      (e) => e.id === parsedEpisodeId,
    );

    if (!targetArc || !baseEpisode) {
      setEpisode(null);
      setIsLoadingEpisode(false);
      return;
    }

    setIsLoadingEpisode(true);
    let isCancelled = false;

    const fetchEpisode = async () => {
      try {
        let meta =
          arc?.id === parsedArcId
            ? arc.episodes.find((e) => e.id === parsedEpisodeId)?.metadata
            : undefined;

        let itemId = meta?.Id;

        if (!itemId && targetArc.showId) {
          const seasonEpisodes = await jellyfinClient.getEpisodesForSeason(
            targetArc.showId,
          );
          meta = seasonEpisodes.find(
            (item) => item.IndexNumber === parsedEpisodeId,
          );
          itemId = meta?.Id;
        }

        if (isCancelled) return;

        if (!itemId) {
          setIsLoadingEpisode(false);
          return;
        }

        const videoInfo = await jellyfinClient.getEpisodeStreamUrl(itemId);

        if (isCancelled) return;

        setEpisode({
          ...baseEpisode,
          metadata: meta,
          video: videoInfo,
        } as Episode);
      } catch (err) {
        console.error("Failed to fetch episode video info:", err);
      } finally {
        if (!isCancelled) {
          setIsLoadingEpisode(false);
        }
      }
    };

    void fetchEpisode();

    return () => {
      isCancelled = true;
    };
  }, [arcId, episodeId, arc]);

  const nextArc = useMemo(() => {
    const currentArcId = arc?.id || parseInt(arcId || "0", 10);
    if (!currentArcId) return null;
    return DATA.arcs.find((_arc) => _arc.id === currentArcId + 1) || null;
  }, [arc, arcId]);

  const previousArc = useMemo(() => {
    const currentArcId = arc?.id || parseInt(arcId || "0", 10);
    if (!currentArcId) return null;
    return DATA.arcs.find((_arc) => _arc.id === currentArcId - 1) || null;
  }, [arc, arcId]);

  const nextEpisode = useMemo(() => {
    const parsedArcId = arc?.id || parseInt(arcId || "0", 10);
    const parsedEpisodeId = episode?.id || parseInt(episodeId || "0", 10);
    const targetArc = DATA.arcs.find((a) => a.id === parsedArcId) || arc;
    if (!targetArc || !parsedEpisodeId) return null;
    return (
      targetArc.episodes.find((_ep) => _ep.id === parsedEpisodeId + 1) || null
    );
  }, [arc, arcId, episode, episodeId]);

  const previousEpisode = useMemo(() => {
    const parsedArcId = arc?.id || parseInt(arcId || "0", 10);
    const parsedEpisodeId = episode?.id || parseInt(episodeId || "0", 10);
    const targetArc = DATA.arcs.find((a) => a.id === parsedArcId) || arc;
    if (!targetArc || !parsedEpisodeId) return null;
    return (
      targetArc.episodes.find((_ep) => _ep.id === parsedEpisodeId - 1) || null
    );
  }, [arc, arcId, episode, episodeId]);

  useEffect(() => {
    if (arcId && episodeId) {
      const aId = parseInt(arcId, 10);
      const eId = parseInt(episodeId, 10);
      if (!isNaN(aId) && !isNaN(eId) && aId > 0 && eId > 0) {
        const foundArc = DATA.arcs.find((a) => a.id === aId);
        const foundEp = foundArc?.episodes.find((e) => e.id === eId);
        const data = {
          arcId: aId,
          episodeId: eId,
          arcTitle: foundArc?.title,
          episodeTitle: foundEp?.title || `Episode ${eId}`,
          updatedAt: Date.now(),
        };
        try {
          localStorage.setItem(CONTINUE_KEY, JSON.stringify(data));
        } catch {
          /* ignore */
        }
      }
    }
  }, [arcId, episodeId]);

  const getContinueWatchingTarget = useCallback((): ContinueWatchingTarget => {
    try {
      const raw = localStorage.getItem(CONTINUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.arcId && parsed?.episodeId) {
          const aId = Number(parsed.arcId);
          const eId = Number(parsed.episodeId);
          const arcObj = DATA.arcs.find((a) => a.id === aId);
          const epObj = arcObj?.episodes.find((e) => e.id === eId);
          if (arcObj && epObj) {
            const isPlayed = isEpisodePlayed(aId, eId);
            if (!isPlayed) {
              return {
                arcId: aId,
                episodeId: eId,
                arcTitle: arcObj.title,
                episodeTitle: epObj.title || `Episode ${eId}`,
              };
            }
            const nextEp = arcObj.episodes.find((e) => e.id === eId + 1);
            if (nextEp) {
              return {
                arcId: aId,
                episodeId: nextEp.id,
                arcTitle: arcObj.title,
                episodeTitle: nextEp.title || `Episode ${nextEp.id}`,
              };
            }
            const nextArcObj = DATA.arcs.find((a) => a.id === aId + 1);
            if (nextArcObj && nextArcObj.episodes.length > 0) {
              return {
                arcId: nextArcObj.id,
                episodeId: 1,
                arcTitle: nextArcObj.title,
                episodeTitle: nextArcObj.episodes[0]?.title || "Episode 1",
              };
            }
          }
        }
      }
    } catch {
      /* ignore */
    }

    for (const arcItem of DATA.arcs) {
      for (const ep of arcItem.episodes) {
        const prog = getEpisodeProgress(arcItem.id, ep.id);
        if (prog.ticks > 0 && !prog.played) {
          return {
            arcId: arcItem.id,
            episodeId: ep.id,
            arcTitle: arcItem.title,
            episodeTitle: ep.title || `Episode ${ep.id}`,
          };
        }
      }
    }

    for (const arcItem of DATA.arcs) {
      for (const ep of arcItem.episodes) {
        const played = isEpisodePlayed(arcItem.id, ep.id);
        if (!played) {
          return {
            arcId: arcItem.id,
            episodeId: ep.id,
            arcTitle: arcItem.title,
            episodeTitle: ep.title || `Episode ${ep.id}`,
          };
        }
      }
    }

    return {
      arcId: 1,
      episodeId: 1,
      arcTitle: DATA.arcs[0]?.title || "Romance Dawn",
      episodeTitle: DATA.arcs[0]?.episodes[0]?.title || "Episode 1",
    };
  }, [isEpisodePlayed, getEpisodeProgress]);

  return (
    <DataContext.Provider
      value={{
        user,
        arc,
        episode,
        arcs: DATA.arcs,
        userDataMap,
        nextArc,
        previousArc,
        nextEpisode,
        previousEpisode,
        navigate,
        refreshData,
        login,
        logout,
        isEpisodePlayed,
        getEpisodeProgress,
        toggleEpisodePlayed,
        getContinueWatchingTarget,
        isLoadingArc,
        isLoadingEpisode,
      }}
    >
      <Outlet />
    </DataContext.Provider>
  );
};
