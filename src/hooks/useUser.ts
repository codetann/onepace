import { useState } from "react";
import { jellyfinClient } from "@/api/jellyfin/client";
import type { JellyfinUser } from "@/api/jellyfin/types";

const readStoredUser = (): JellyfinUser | null => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JellyfinUser | { User?: JellyfinUser };
    if ("User" in parsed && parsed.User) return parsed.User;
    if ("Id" in parsed && "Name" in parsed) return parsed as JellyfinUser;
  } catch {
    /* ignore */
  }
  return null;
};

export const useUser = () => {
  const [user, setUser] = useState<JellyfinUser | null>(readStoredUser);

  const login = async (email: string, password: string) => {
    const auth = await jellyfinClient.authenticateUserByName({
      Username: email,
      Pw: password,
    });
    if (!auth?.User?.Id) return;
    setUser(auth.User);
    localStorage.setItem("user", JSON.stringify(auth));
  };

  const register = async (email: string, password: string) => {
    const created = await jellyfinClient.createUser(email, password);
    if (created) {
      setUser(created);
      localStorage.setItem("user", JSON.stringify(created));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return { user, setUser, login, logout, register };
};
