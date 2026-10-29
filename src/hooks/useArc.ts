import { useEffect, useState } from "react";
import type { Arc } from "@/typings";
import { useParams } from "react-router";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3001"
).replace(/\/+$/, "");

export const useArc = () => {
  const { arcId } = useParams();
  const [arc, setArc] = useState<Arc>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetch(`${API_BASE_URL}/api/arcs/${arcId}`);
        console.log(data);
        const json = await data.json();
        setArc(json);
      } catch (error) {
        setError(error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [arcId]);

  // useEffect(() => {
  //   localStorage.setItem(CACHE_KEY + arcId, JSON.stringify(arc));
  // }, [arc, arcId]);

  return { arc, isLoading, error };
};
