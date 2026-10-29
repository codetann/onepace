import type {
  JellyfinAuthenticationRequest,
  JellyfinAuthenticationResult,
  JellyfinCreateUserRequest,
  JellyfinImageType,
  JellyfinItem,
  JellyfinItemImageUrlOptions,
  JellyfinItemListResponse,
  JellyfinItemUpdatePayload,
  JellyfinPlaybackInfoResponse,
  JellyfinPlaybackProgressInfo,
  JellyfinPlaybackStartInfo,
  JellyfinPlaybackStopInfo,
  JellyfinSystemInfo,
  JellyfinUpdatePasswordRequest,
  JellyfinUser,
} from "./types";

const DEFAULT_BASE_URL = "https://jellyfin.tannerthomas.dev";
const API_KEY = import.meta.env.VITE_JELLYFIN_API_KEY ?? "";

/**
 * Jellyfin auth for `X-Emby-Token` and `api_key` query (browser `<video>` / `<img>` cannot send headers).
 * Prefer the logged-in user's **AccessToken** so playstate updates **that** user's `UserData`
 * (must match `getResolvedUserId()`). Falls back to `VITE_JELLYFIN_API_KEY`.
 */
const getEmbyToken = (): string => {
  if (typeof localStorage === "undefined") return API_KEY;
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const parsed = JSON.parse(raw) as { AccessToken?: string };
      if (parsed?.AccessToken?.length) return parsed.AccessToken;
    }
  } catch {
    /* ignore */
  }
  return API_KEY;
};

/** User id for `/Users/{id}/…` paths — from stored auth or `VITE_JELLYFIN_USER_ID`. */
const getResolvedUserId = (): string => {
  if (typeof localStorage === "undefined") {
    return import.meta.env.VITE_JELLYFIN_USER_ID ?? "";
  }
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const parsed = JSON.parse(raw) as { User?: { Id?: string } };
      if (parsed?.User?.Id) return String(parsed.User.Id);
    }
  } catch {
    /* ignore */
  }
  return import.meta.env.VITE_JELLYFIN_USER_ID ?? "";
};

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, "");

const BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_JELLYFIN_URL || DEFAULT_BASE_URL,
);

const buildUrl = (
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
): string => {
  const url = new URL(`${BASE_URL}${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });

  const token = getEmbyToken();
  if (token) {
    url.searchParams.set("api_key", token);
  }

  return url.toString();
};

/** Jellyfin returns `TranscodingUrl` as a path or full URL; normalize and attach `api_key`. */
const resolveTranscodingUrl = (transcodingUrl: string): string => {
  const absolute = transcodingUrl.startsWith("http")
    ? transcodingUrl
    : `${BASE_URL}${transcodingUrl.startsWith("/") ? "" : "/"}${transcodingUrl}`;
  const url = new URL(absolute);
  const token = getEmbyToken();
  if (token && !url.searchParams.has("api_key")) {
    url.searchParams.set("api_key", token);
  }
  return url.toString();
};

const authFetchHeaders = (options: RequestInit = {}): HeadersInit => {
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  const token = getEmbyToken();
  if (token) {
    headers.set("X-Emby-Token", token);
    headers.set(
      "Authorization",
      `MediaBrowser Client="OnePace", Device="Web", DeviceId="onepace-web", Version="1.0.0", Token="${token}"`,
    );
  }
  return headers;
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
  query: Record<string, string | number | boolean | undefined> = {},
): Promise<T> => {
  const response = await fetch(buildUrl(path, query), {
    ...options,
    headers: authFetchHeaders(options),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Jellyfin request failed (${response.status} ${response.statusText}): ${text}`,
    );
  }

  return (await response.json()) as T;
};

const requestNoContent = async (
  path: string,
  options: RequestInit = {},
  query: Record<string, string | number | boolean | undefined> = {},
): Promise<void> => {
  const response = await fetch(buildUrl(path, query), {
    ...options,
    headers: authFetchHeaders(options),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Jellyfin request failed (${response.status} ${response.statusText}): ${text}`,
    );
  }
};

/** Jellyfin time base: **1 second = 10_000_000** ticks (100 ns units). */
export const jellyfinSecondsToTicks = (seconds: number): number =>
  Math.round(seconds * 10_000_000);

export const jellyfinClient = {
  baseUrl: BASE_URL,

  /**
   * Jellyfin: `POST /Users/AuthenticateByName`
   */
  authenticateUserByName(
    body: JellyfinAuthenticationRequest,
  ): Promise<JellyfinAuthenticationResult> {
    return request<JellyfinAuthenticationResult>("/Users/AuthenticateByName", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  /**
   * Jellyfin: `POST /Users/New`
   * Creates a new user by name. Use `updateUserPassword` to set initial password.
   */
  createUser(
    user: JellyfinCreateUserRequest | string,
    password?: string,
  ): Promise<JellyfinUser> {
    const payload: JellyfinCreateUserRequest =
      typeof user === "string" ? { Name: user } : user;

    const createPromise = request<JellyfinUser>("/Users/New", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!password) {
      return createPromise;
    }

    return createPromise.then(async (createdUser) => {
      await this.updateUserPassword(createdUser.Id, { NewPw: password });
      return createdUser;
    });
  },

  /**
   * Jellyfin: `POST /Users/{userId}/Password`
   */
  updateUserPassword(
    userId: string,
    body: JellyfinUpdatePasswordRequest,
  ): Promise<void> {
    return requestNoContent(`/Users/${userId}/Password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  /**
   * Jellyfin: `POST /Users/{userId}/Password`
   * Convenience helper for setting initial password.
   */
  setUserPassword(userId: string, password: string): Promise<void> {
    return this.updateUserPassword(userId, { NewPw: password });
  },

  /**
   * Jellyfin: `GET /Users`
   */
  getUsers(): Promise<JellyfinUser[]> {
    return request<JellyfinUser[]>("/Users");
  },

  /**
   * Jellyfin: `GET /Users/Public`
   */
  getPublicUsers(): Promise<JellyfinUser[]> {
    return request<JellyfinUser[]>("/Users/Public");
  },

  getSystemInfo() {
    return request<JellyfinSystemInfo>("/System/Info/Public");
  },

  getCurrentUserId(): string {
    const id = getResolvedUserId();
    if (!id) {
      throw new Error(
        "No Jellyfin user id: sign in, or set VITE_JELLYFIN_USER_ID in .env (must match the user your API key / token represents).",
      );
    }
    return id;
  },

  getUserViews(userId = getResolvedUserId()) {
    if (!userId) {
      throw new Error(
        "User ID is required. Set VITE_JELLYFIN_USER_ID or pass userId explicitly.",
      );
    }
    return request<JellyfinItemListResponse>(`/Users/${userId}/Views`);
  },

  getCurrentUser(userId = getResolvedUserId()) {
    if (!userId) {
      throw new Error(
        "User ID is required. Set VITE_JELLYFIN_USER_ID or pass userId explicitly.",
      );
    }
    return request<JellyfinUser>(`/Users/${userId}`);
  },

  getItems(
    userId = getResolvedUserId(),
    query: Record<string, string | number | boolean | undefined> = {},
  ) {
    if (!userId) {
      throw new Error(
        "User ID is required. Set VITE_JELLYFIN_USER_ID or pass userId explicitly.",
      );
    }
    return request<JellyfinItemListResponse>(
      `/Users/${userId}/Items`,
      {},
      query,
    );
  },

  async getShows(
    userId = getResolvedUserId(),
    query: Record<string, string | number | boolean | undefined> = {},
  ) {
    const response = await this.getItems(userId, {
      IncludeItemTypes: "Series",
      Recursive: true,
      SortBy: "SortName",
      SortOrder: "Ascending",
      ...query,
    });

    return response.Items;
  },

  async getShowById(showId: string, userId = getResolvedUserId()) {
    const item = await this.getItem(showId, userId);
    if (item.Type !== "Series") {
      throw new Error(
        `Item ${showId} is type "${item.Type}", expected "Series".`,
      );
    }
    return item;
  },

  async getShowByName(
    name: string,
    userId = getResolvedUserId(),
    query: Record<string, string | number | boolean | undefined> = {},
  ) {
    const response = await this.getItems(userId, {
      IncludeItemTypes: "Series",
      Recursive: true,
      SearchTerm: name,
      Fields: "Overview,PrimaryImageAspectRatio",
      Limit: 1,
      ...query,
    });

    return response.Items[0] ?? null;
  },

  async getSeasonsForShow(
    showId: string,
    userId = getResolvedUserId(),
    query: Record<string, string | number | boolean | undefined> = {},
  ) {
    const response = await this.getItems(userId, {
      ParentId: showId,
      IncludeItemTypes: "Season",
      Recursive: false,
      SortBy: "SortName",
      SortOrder: "Ascending",
      ...query,
    });

    return response.Items;
  },

  async getEpisodesForSeason(
    seasonId: string,
    userId = getResolvedUserId(),
    query: Record<string, string | number | boolean | undefined> = {},
  ) {
    const response = await this.getItems(userId, {
      ParentId: seasonId,
      IncludeItemTypes: "Episode",
      Recursive: false,
      SortBy: "SortName",
      SortOrder: "Ascending",
      Fields: "UserData",
      ...query,
    });

    return response.Items;
  },

  async getEpisodesForShow(
    showId: string,
    userId = getResolvedUserId(),
    query: Record<string, string | number | boolean | undefined> = {},
  ) {
    const response = await this.getItems(userId, {
      SeriesId: showId,
      IncludeItemTypes: "Episode",
      Recursive: true,
      SortBy: "ParentIndexNumber,IndexNumber,SortName",
      SortOrder: "Ascending",
      ...query,
    });

    return response.Items;
  },

  getItem(
    itemId: string,
    userId = getResolvedUserId(),
    query: Record<string, string | number | boolean | undefined> = {},
  ) {
    if (!userId) {
      throw new Error(
        "User ID is required. Set VITE_JELLYFIN_USER_ID or pass userId explicitly.",
      );
    }
    return request<JellyfinItem>(`/Users/${userId}/Items/${itemId}`, {}, query);
  },

  /**
   * Jellyfin: `POST /UserPlayedItems/{itemId}` — mark current user's item as played.
   */
  markPlayedItem(itemId: string, userId = getResolvedUserId()): Promise<void> {
    return requestNoContent(
      `/UserPlayedItems/${itemId}`,
      { method: "POST" },
      userId ? { userId } : {},
    );
  },

  unmarkPlayedItem(itemId: string, userId = getResolvedUserId()): Promise<void> {
    return requestNoContent(
      `/UserPlayedItems/${itemId}`,
      { method: "DELETE" },
      userId ? { userId } : {},
    );
  },

  /**
   * Updates user data for an item (playback position, played status).
   * Jellyfin: `POST /UserItems/{itemId}/UserData`
   */
  updateItemUserData(
    itemId: string,
    data: {
      PlaybackPositionTicks?: number;
      Played?: boolean;
    },
    userId = getResolvedUserId(),
  ): Promise<void> {
    return requestNoContent(
      `/UserItems/${itemId}/UserData`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      userId ? { userId } : {},
    );
  },

  /**
   * Updates library metadata for an item (`POST /Items/{itemId}`).
   * On success Jellyfin returns **204** with no body.
   */
  updateItem(itemId: string, body: JellyfinItemUpdatePayload) {
    return requestNoContent(`/Items/${itemId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  getPlaybackInfo(
    itemId: string,
    userId = getResolvedUserId(),
    maxStreamingBitrate = 20_000_000,
  ) {
    if (!userId) {
      throw new Error(
        "User ID is required. Set VITE_JELLYFIN_USER_ID or pass userId explicitly.",
      );
    }
    return request<JellyfinPlaybackInfoResponse>(
      `/Items/${itemId}/PlaybackInfo`,
      { method: "POST" },
      { UserId: userId, MaxStreamingBitrate: maxStreamingBitrate },
    );
  },

  /**
   * Jellyfin: `POST /Sessions/Playing` — register that playback has started for this `PlaySessionId`.
   */
  reportPlaybackStarted(body: JellyfinPlaybackStartInfo): Promise<void> {
    return requestNoContent("/Sessions/Playing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  /**
   * Jellyfin: `POST /Sessions/Playing/Progress` — update position, pause/mute/volume, etc.
   */
  reportPlaybackProgress(body: JellyfinPlaybackProgressInfo): Promise<void> {
    return requestNoContent("/Sessions/Playing/Progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  /**
   * Jellyfin: `POST /Sessions/Playing/Stopped` — end the play session (navigation away, ended, etc.).
   */
  reportPlaybackStopped(body: JellyfinPlaybackStopInfo): Promise<void> {
    return requestNoContent("/Sessions/Playing/Stopped", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  /**
   * Resolves a URL you can assign to `<video src>` for an **Episode** item.
   * Uses `PlaybackInfo` to pick direct progressive stream when supported, otherwise
   * Jellyfin’s `TranscodingUrl` (often HLS `.m3u8` — Safari plays natively; Chrome may need hls.js).
   */
  async getEpisodeStreamUrl(
    episodeItemId: string,
    userId = getResolvedUserId(),
    options: {
      mediaSourceId?: string;
      maxStreamingBitrate?: number;
    } = {},
  ): Promise<{ url: string; info: JellyfinPlaybackInfoResponse }> {
    if (!userId) {
      throw new Error(
        "User ID is required. Set VITE_JELLYFIN_USER_ID or pass userId explicitly.",
      );
    }

    const item = await this.getItem(episodeItemId, userId);
    if (item.Type !== "Episode") {
      throw new Error(
        `Item ${episodeItemId} has type "${item.Type}"; getEpisodeStreamUrl expects type "Episode".`,
      );
    }

    const info = await this.getPlaybackInfo(
      episodeItemId,
      userId,
      options.maxStreamingBitrate ?? 20_000_000,
    );
    const sources = info.MediaSources ?? [];
    if (!sources.length) {
      throw new Error(`No MediaSources returned for episode ${episodeItemId}.`);
    }

    const byId = options.mediaSourceId
      ? sources.find((s) => s.Id === options.mediaSourceId)
      : undefined;
    const preferredDirect =
      sources.find(
        (s) => s.SupportsDirectStream === true || s.SupportsDirectPlay === true,
      ) ?? sources[0];
    const source = byId ?? preferredDirect;

    const canDirect =
      source.SupportsDirectStream === true ||
      source.SupportsDirectPlay === true;
    if (canDirect) {
      return {
        url: this.getDirectStreamUrl(episodeItemId, source.Id),
        info,
      };
    }
    if (source.TranscodingUrl) {
      return {
        url: resolveTranscodingUrl(source.TranscodingUrl),
        info,
      };
    }
    return {
      url: this.getDirectStreamUrl(episodeItemId, source.Id),
      info,
    };
  },

  getDirectStreamUrl(itemId: string, mediaSourceId?: string): string {
    return buildUrl(`/Videos/${itemId}/stream`, {
      static: true,
      MediaSourceId: mediaSourceId,
    });
  },

  getDownloadUrl(itemId: string): string {
    return buildUrl(`/Items/${itemId}/Download`);
  },

  /**
   * Public URL for an item image (use as `img src` or CSS `background-image`).
   * Jellyfin: `GET /Items/{itemId}/Images/{imageType}`
   */
  getItemImageUrl(
    itemId: string,
    imageType: JellyfinImageType = "Primary",
    options: JellyfinItemImageUrlOptions = {},
  ): string {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (options.maxWidth !== undefined) query.maxWidth = options.maxWidth;
    if (options.maxHeight !== undefined) query.maxHeight = options.maxHeight;
    if (options.quality !== undefined) query.quality = options.quality;
    if (options.tag !== undefined) query.tag = options.tag;
    return buildUrl(`/Items/${itemId}/Images/${imageType}`, query);
  },

  /**
   * Fetches image bytes (e.g. for `Blob` → `URL.createObjectURL` or download).
   */
  async getItemImage(
    itemId: string,
    imageType: JellyfinImageType = "Primary",
    options: JellyfinItemImageUrlOptions = {},
  ): Promise<Blob> {
    const url = this.getItemImageUrl(itemId, imageType, options);
    const response = await fetch(url, { headers: authFetchHeaders({}) });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Jellyfin image request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }
    return response.blob();
  },
};
