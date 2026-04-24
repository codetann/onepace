export interface JellyfinUser {
  Id: string;
  Name: string;
  ServerId?: string;
}

export interface JellyfinAuthenticationRequest {
  Username: string;
  Pw: string;
}

export interface JellyfinAuthenticationResult {
  User?: JellyfinUser;
  SessionInfo?: {
    Id?: string;
    UserId?: string;
    UserName?: string;
    Client?: string;
    DeviceName?: string;
    DeviceId?: string;
    ApplicationVersion?: string;
    IsActive?: boolean;
  };
  AccessToken?: string;
  ServerId?: string;
}

export interface JellyfinCreateUserRequest {
  Name: string;
}

export interface JellyfinUpdatePasswordRequest {
  CurrentPw?: string;
  NewPw?: string;
  ResetPassword?: boolean;
}

/** Jellyfin `ImageType` values used by `/Items/{id}/Images/{type}`. */
export type JellyfinImageType =
  | "Primary"
  | "Art"
  | "Backdrop"
  | "Banner"
  | "Disc"
  | "Logo"
  | "Thumb";

export interface JellyfinItemImageUrlOptions {
  /** Max width in pixels (server scales). */
  maxWidth?: number;
  /** Max height in pixels (server scales). */
  maxHeight?: number;
  /** JPEG/WebP quality 0–100. */
  quality?: number;
  /** Image tag from `item.ImageTags` for cache-busting / correct revision. */
  tag?: string;
}

export interface JellyfinImageTagMap {
  Primary?: string;
  Backdrop?: string;
  Thumb?: string;
  Logo?: string;
  [key: string]: string | undefined;
}

/** Present when `Fields` includes `UserData` (playback resume, played state). */
export interface JellyfinUserData {
  PlaybackPositionTicks?: number;
  Played?: boolean;
  PlayedPercentage?: number;
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  ParentId?: string;
  SeriesName?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  ImageTags?: JellyfinImageTagMap;
  BackdropImageTags?: string[];
  UserData?: JellyfinUserData;
}

/**
 * Fields for `POST /Items/{itemId}` (Jellyfin `BaseItemDto` subset).
 * Send only properties you want to change; other fields are left as-is on the server.
 */
export interface JellyfinItemUpdatePayload {
  Name?: string | null;
  Overview?: string | null;
  OriginalTitle?: string | null;
  SortName?: string | null;
  Tags?: string[] | null;
  [key: string]: unknown;
}

export interface JellyfinItemListResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
  StartIndex: number;
}

export interface JellyfinSystemInfo {
  Id: string;
  ServerName: string;
  Version: string;
  OperatingSystem?: string;
}

export interface JellyfinPlaybackMediaSource {
  Id: string;
  Path?: string;
  Container?: string;
  Protocol?: string;
  Name?: string;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  /** Server-relative or absolute URL for transcoded playback (often `.m3u8`). */
  TranscodingUrl?: string;
}

export interface JellyfinPlaybackInfoResponse {
  MediaSources: JellyfinPlaybackMediaSource[];
  PlaySessionId?: string;
}

/** Jellyfin `PlayMethod` (`PlaybackProgressInfo`, `PlaybackStartInfo`). */
export type JellyfinPlayMethod = "Transcode" | "DirectStream" | "DirectPlay";

/**
 * Request body for `POST /Sessions/Playing/Progress`.
 * @see https://api.jellyfin.org/#tag/Playstate/operation/ReportPlaybackProgress
 */
export interface JellyfinPlaybackProgressInfo {
  ItemId?: string;
  SessionId?: string | null;
  MediaSourceId?: string | null;
  AudioStreamIndex?: number | null;
  SubtitleStreamIndex?: number | null;
  IsPaused?: boolean;
  IsMuted?: boolean;
  PositionTicks?: number | null;
  PlaybackStartTimeTicks?: number | null;
  VolumeLevel?: number | null;
  CanSeek?: boolean;
  PlayMethod?: JellyfinPlayMethod;
  PlaySessionId?: string | null;
  RepeatMode?: "RepeatNone" | "RepeatAll" | "RepeatOne";
  PlaybackOrder?: "Default" | "Shuffle";
}

/**
 * Request body for `POST /Sessions/Playing`.
 * @see https://api.jellyfin.org/#tag/Playstate/operation/ReportPlaybackStart
 */
export interface JellyfinPlaybackStartInfo {
  ItemId?: string;
  MediaSourceId?: string | null;
  PlaySessionId?: string | null;
  PositionTicks?: number | null;
  CanSeek?: boolean;
  IsPaused?: boolean;
  IsMuted?: boolean;
  VolumeLevel?: number | null;
  PlayMethod?: JellyfinPlayMethod;
}

/**
 * Request body for `POST /Sessions/Playing/Stopped`.
 * @see https://api.jellyfin.org/#tag/Playstate/operation/ReportPlaybackStopped
 */
export interface JellyfinPlaybackStopInfo {
  ItemId?: string;
  MediaSourceId?: string | null;
  PlaySessionId?: string | null;
  PositionTicks?: number | null;
  LiveStreamId?: string | null;
  /** When true, server may mark the item as fully played (threshold depends on server policy). */
  Played?: boolean;
}
