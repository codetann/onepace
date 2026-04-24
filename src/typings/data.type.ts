import type {
  JellyfinItem,
  JellyfinPlaybackInfoResponse,
} from "@/api/jellyfin/types";

export interface Episode {
  id: number;
  title: string;
  description: string;
  coverage: {
    anime: string;
    manga: string;
  };
  metadata: JellyfinItem;
  video?: {
    url: string;
    info: JellyfinPlaybackInfoResponse;
  };
  length: string;
}

export interface Arc {
  id: number;
  title: string;
  description: string;
  image: string;
  altImage: string;
  coverage: {
    anime: string;
    manga: string;
  };
  averageRating: number;
  episodes: Episode[];
  metadata: JellyfinItem;
}
