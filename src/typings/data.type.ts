import type {
  JellyfinItem,
  JellyfinPlaybackInfoResponse,
  SubtitleTrackInfo,
} from "@/api/jellyfin/types";

export type { SubtitleTrackInfo };

export interface Episode {
  id: number;
  title: string;
  altTitle?: string | null;
  description: string;
  coverage: {
    anime: string;
    manga: string;
  };
  metadata?: JellyfinItem;
  video?: {
    url: string;
    info: JellyfinPlaybackInfoResponse;
  };
  subtitles?: SubtitleTrackInfo[];
  length: string;
}

export interface Arc {
  id: number;
  showId?: string;
  title: string;
  description: string;
  image: string;
  altImage: string;
  backgroundImage?: string;
  coverage: {
    anime: string;
    manga: string;
  };
  averageRating: number;
  episodes: Episode[];
  metadata?: JellyfinItem;
}
