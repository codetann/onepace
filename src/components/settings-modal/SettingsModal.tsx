import React, { useState } from "react";
import { Modal, Button, Label, Input, Chip } from "@heroui/react";
import {
  BiUser,
  BiCog,
  BiLock,
  BiSun,
  BiMoon,
  BiCheck,
  BiLogOut,
  BiLogIn,
  BiVolumeFull,
  BiShield,
  BiHistory,
  BiTrash,
} from "react-icons/bi";
import { useDataContext } from "@/context/DataContext";
import { useTheme } from "@/hooks";
import { jellyfinClient } from "@/api/jellyfin";

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({
  isOpen,
  onOpenChange,
}: SettingsModalProps) {
  const { user, login, logout, refreshData, userDataMap } = useDataContext();
  const { theme, toggleTheme } = useTheme();

  const [activeSection, setActiveSection] = useState<"account" | "preferences">(
    "account",
  );

  // Login form state (for logged out user)
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Change password state (for logged in user)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Reset watch history state
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResettingHistory, setIsResettingHistory] = useState(false);
  const [historyMessage, setHistoryMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginUsername.trim()) {
      setLoginError("Please enter your username.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await login(loginUsername, loginPassword);
      setLoginUsername("");
      setLoginPassword("");
      await refreshData();
    } catch (err: unknown) {
      setLoginError(
        err instanceof Error ? err.message : "Invalid username or password",
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleUpdatePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password cannot be empty.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New passwords do not match.",
      });
      return;
    }
    if (!user?.Id) return;

    setIsUpdatingPassword(true);
    setPasswordMessage(null);
    try {
      await jellyfinClient.updateUserPassword(user.Id, {
        CurrentPw: currentPassword || undefined,
        NewPw: newPassword,
      });
      setPasswordMessage({
        type: "success",
        text: "Password updated successfully!",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleResetWatchHistory = async () => {
    setIsResettingHistory(true);
    setHistoryMessage(null);
    try {
      localStorage.removeItem("onepace:continueWatching");

      // Unmark any watched items in Jellyfin if user is signed in
      const playedItemIds = Object.values(userDataMap)
        .filter((entry) => entry.played && entry.itemId)
        .map((entry) => entry.itemId as string);

      if (playedItemIds.length > 0) {
        await Promise.allSettled(
          playedItemIds.map((id) => jellyfinClient.unmarkPlayedItem(id)),
        );
      }

      await refreshData();
      setHistoryMessage({
        type: "success",
        text: "Watch history and resume points have been reset.",
      });
      setConfirmReset(false);
    } catch (err: unknown) {
      setHistoryMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to reset watch history",
      });
    } finally {
      setIsResettingHistory(false);
    }
  };

  const handleLogout = () => {
    logout();
    onOpenChange(false);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="max-w-2xl w-full h-[600px] max-h-[90vh] flex flex-col overflow-hidden !p-0 p-0">
            <Modal.Header className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-default-100 flex items-center justify-between shrink-0">
              <Modal.Heading className="text-lg font-bold flex items-center justify-between w-full pr-6">
                <span>Settings</span>
                {user ? (
                  <Chip size="sm" color="success" className="gap-1 text-xs">
                    <BiCheck /> Connected
                  </Chip>
                ) : (
                  <Chip size="sm" color="warning" className="gap-1 text-xs">
                    Signed Out
                  </Chip>
                )}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="!p-0 p-0 flex-1 min-h-0 overflow-hidden flex flex-col sm:flex-row">
              {/* ── Compact Left Sidebar Menu ── */}
              <div className="w-full sm:w-40 shrink-0 px-1.5 pt-1 pb-1.5 sm:px-2 sm:pt-1.5 sm:pb-3 border-b sm:border-b-0 sm:border-r border-default-100 bg-default-50/50 flex flex-row sm:flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setActiveSection("account")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer text-left ${
                    activeSection === "account"
                      ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                      : "text-muted hover:text-foreground hover:bg-default-100/70"
                  }`}
                >
                  <BiUser className="size-4 shrink-0" />
                  <span>Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("preferences")}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer text-left ${
                    activeSection === "preferences"
                      ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                      : "text-muted hover:text-foreground hover:bg-default-100/70"
                  }`}
                >
                  <BiCog className="size-4 shrink-0" />
                  <span>Preferences</span>
                </button>
              </div>

              {/* ── Right Content Pane (Flat rows, no card borders) ── */}
              <div className="flex-1 h-full min-h-0 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                {activeSection === "account" ? (
                  /* ── ACCOUNT SECTION ── */
                  <div className="flex flex-col gap-4">
                    <div className="pb-2 border-b border-default-100">
                      <h4 className="text-sm font-semibold text-foreground">
                        Account
                      </h4>
                      <p className="text-xs text-muted">
                        Manage user profile, watch history, and authentication.
                      </p>
                    </div>

                    {user ? (
                      <div className="divide-y divide-default-100">
                        {/* Profile Row */}
                        <div className="py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm shrink-0">
                              {user.Name?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-sm flex items-center gap-2 truncate">
                                {user.Name}
                                {user.Policy?.IsAdministrator && (
                                  <Chip
                                    size="sm"
                                    color="accent"
                                    className="text-[10px] h-5"
                                  >
                                    <BiShield /> Admin
                                  </Chip>
                                )}
                              </span>
                              <span className="text-xs text-muted truncate">
                                ID: {user.Id}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:bg-danger/10 cursor-pointer shrink-0 text-xs flex items-center gap-1"
                            onPress={handleLogout}
                          >
                            <BiLogOut className="size-3.5" /> Sign Out
                          </Button>
                        </div>

                        {/* Watch History Row */}
                        <div className="py-3 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <BiHistory className="size-4 text-accent" /> Watch History
                              </span>
                              <span className="text-xs text-muted">
                                Reset watched markers and clear your continue watching bookmark.
                              </span>
                            </div>

                            {!confirmReset && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="text-danger hover:bg-danger/10 border-danger/20 cursor-pointer shrink-0 text-xs flex items-center gap-1"
                                onPress={() => setConfirmReset(true)}
                              >
                                <BiTrash className="size-3.5" /> Reset History
                              </Button>
                            )}
                          </div>

                          {historyMessage && (
                            <div
                              className={`text-xs p-2 rounded-md ${
                                historyMessage.type === "success"
                                  ? "bg-success/15 text-success"
                                  : "bg-danger/15 text-danger"
                              }`}
                            >
                              {historyMessage.text}
                            </div>
                          )}

                          {confirmReset && (
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                variant="primary"
                                size="sm"
                                className="bg-danger text-white cursor-pointer text-xs"
                                onPress={handleResetWatchHistory}
                                isDisabled={isResettingHistory}
                              >
                                {isResettingHistory
                                  ? "Resetting..."
                                  : "Yes, Reset All History"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="cursor-pointer text-xs"
                                onPress={() => setConfirmReset(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Change Password Row */}
                        <div className="py-3">
                          <form
                            onSubmit={handleUpdatePassword}
                            className="flex flex-col gap-2.5"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <BiLock className="size-4 text-accent" /> Change Password
                              </span>
                              <span className="text-xs text-muted">
                                Update your Jellyfin account password.
                              </span>
                            </div>

                            {passwordMessage && (
                              <div
                                className={`text-xs p-2 rounded-md ${
                                  passwordMessage.type === "success"
                                    ? "bg-success/15 text-success"
                                    : "bg-danger/15 text-danger"
                                }`}
                              >
                                {passwordMessage.text}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                              <div className="flex flex-col gap-1">
                                <Label htmlFor="current-pw" className="text-[11px] text-muted">
                                  Current Password
                                </Label>
                                <Input
                                  id="current-pw"
                                  variant="secondary"
                                  type="password"
                                  placeholder="Current password"
                                  className="w-full text-xs"
                                  value={currentPassword}
                                  onChange={(e) => setCurrentPassword(e.target.value)}
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <Label htmlFor="new-pw" className="text-[11px] text-muted">
                                  New Password
                                </Label>
                                <Input
                                  id="new-pw"
                                  variant="secondary"
                                  type="password"
                                  placeholder="New password"
                                  className="w-full text-xs"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <Label htmlFor="confirm-pw" className="text-[11px] text-muted">
                                  Confirm New Password
                                </Label>
                                <Input
                                  id="confirm-pw"
                                  variant="secondary"
                                  type="password"
                                  placeholder="Confirm password"
                                  className="w-full text-xs"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="flex justify-end pt-1">
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                                className="cursor-pointer text-xs"
                                isDisabled={isUpdatingPassword || !newPassword}
                              >
                                {isUpdatingPassword
                                  ? "Updating..."
                                  : "Update Password"}
                              </Button>
                            </div>
                          </form>
                        </div>
                      </div>
                    ) : (
                      /* Logged Out View */
                      <div className="flex flex-col gap-3 py-1">
                        <p className="text-xs text-muted">
                          Sign in with your Jellyfin account to sync watched episodes, track
                          playback progress, and save resume points across devices.
                        </p>

                        {loginError && (
                          <div className="text-xs p-2 rounded-md bg-danger/15 text-danger">
                            {loginError}
                          </div>
                        )}

                        <form
                          onSubmit={handleLogin}
                          className="flex flex-col gap-2.5 max-w-sm"
                        >
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="login-username" className="text-xs">
                              Username
                            </Label>
                            <Input
                              id="login-username"
                              variant="secondary"
                              type="text"
                              placeholder="Jellyfin username"
                              className="w-full text-xs"
                              value={loginUsername}
                              onChange={(e) => setLoginUsername(e.target.value)}
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <Label htmlFor="login-password" className="text-xs">
                              Password
                            </Label>
                            <Input
                              id="login-password"
                              variant="secondary"
                              type="password"
                              placeholder="Password"
                              className="w-full text-xs"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                            />
                          </div>

                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            className="mt-2 w-fit cursor-pointer text-xs"
                            isDisabled={isLoggingIn || !loginUsername}
                          >
                            {isLoggingIn ? (
                              "Signing in..."
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <BiLogIn className="size-4" /> Sign In
                              </span>
                            )}
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── PREFERENCES SECTION ── */
                  <div className="flex flex-col gap-4">
                    <div className="pb-2 border-b border-default-100">
                      <h4 className="text-sm font-semibold text-foreground">
                        Preferences
                      </h4>
                      <p className="text-xs text-muted">
                        Configure interface appearance and playback options.
                      </p>
                    </div>

                    <div className="divide-y divide-default-100">
                      {/* Theme Row */}
                      <div className="py-3 flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            Theme
                          </span>
                          <span className="text-xs text-muted">
                            Switch between light and dark mode
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="cursor-pointer shrink-0 flex items-center gap-1.5 text-xs"
                          onPress={toggleTheme}
                        >
                          {theme === "light" ? (
                            <>
                              <BiSun className="text-amber-500" /> Light
                            </>
                          ) : (
                            <>
                              <BiMoon className="text-indigo-400" /> Dark
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Audio Language Row */}
                      <div className="py-3 flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <BiVolumeFull className="text-muted" /> Audio Language
                          </span>
                          <span className="text-xs text-muted">
                            Default audio track preference
                          </span>
                        </div>
                        <Chip size="sm" variant="secondary" className="shrink-0 text-xs">
                          Dubbed (Default)
                        </Chip>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Modal.Body>

            <Modal.Footer className="px-4 sm:px-5 py-2 border-t border-default-100 flex items-center justify-end shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer text-xs"
                onPress={() => onOpenChange(false)}
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
