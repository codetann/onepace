import { useEffect, useState } from "react";
import type { Arc } from "@/typings";

const CACHE_KEY = "onepace:arcs";

export const useArcs = () => {
  const [arcs, setArcs] = useState<Arc[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (arcs.length > 0) return;
    console.log("fetching arcs");
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetch("http://localhost:3001/api/arcs");
        console.log(data);
        const json = await data.json();
        setArcs(json);
      } catch (error) {
        setError(error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(arcs));
  }, [arcs]);

  return { arcs, isLoading, error };
};
