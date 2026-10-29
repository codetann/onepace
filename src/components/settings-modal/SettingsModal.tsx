import React, { useState } from "react";
import { Modal, Button, Tabs, Label, Input, Chip } from "@heroui/react";
import {
  BiUser,
  BiCog,
  BiLock,
  BiSun,
  BiMoon,
  BiCheck,
  BiLogOut,
  BiLogIn,
  BiServer,
  BiVolumeFull,
  BiShield,
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
  const { user, login, logout, refreshData } = useDataContext();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState("account");

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
      setLoginError(err instanceof Error ? err.message : "Invalid username or password");
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

  const handleLogout = () => {
    logout();
    onOpenChange(false);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="max-w-md w-full">
            <Modal.Header className="flex flex-col gap-1 pb-2">
              <Modal.Heading className="text-xl font-bold flex items-center justify-between">
                <span>Settings</span>
                {user ? (
                  <Chip size="sm" color="success" className="gap-1">
                    <BiCheck /> Connected
                  </Chip>
                ) : (
                  <Chip size="sm" color="warning" className="gap-1">
                    Signed Out
                  </Chip>
                )}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="py-2">
              <Tabs
                className="w-full"
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(String(key))}
              >
                <Tabs.ListContainer>
                  <Tabs.List
                    aria-label="Settings Tabs"
                    className="w-full flex border-b border-default-100 mb-4"
                  >
                    <Tabs.Tab
                      id="account"
                      className="flex-1 py-2 text-sm font-medium cursor-pointer"
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <BiUser className="size-4" /> Account
                      </span>
                      <Tabs.Indicator className="bg-accent" />
                    </Tabs.Tab>

                    <Tabs.Tab
                      id="preferences"
                      className="flex-1 py-2 text-sm font-medium cursor-pointer"
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <BiCog className="size-4" /> Preferences
                      </span>
                      <Tabs.Indicator className="bg-accent" />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>

                {/* ACCOUNT TAB */}
                <Tabs.Panel id="account">
                  {user ? (
                    <div className="flex flex-col gap-4">
                      {/* User Info Card */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-default-100 dark:bg-default-50 border border-default-200">
                        <div className="w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-lg">
                          {user.Name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="font-semibold text-base flex items-center gap-2">
                            {user.Name}
                            {user.Policy?.IsAdministrator && (
                              <Chip size="sm" color="accent" className="text-xs">
                                <BiShield /> Admin
                              </Chip>
                            )}
                          </span>
                          <span className="text-xs text-muted truncate">
                            ID: {user.Id}
                          </span>
                        </div>
                      </div>

                      {/* Change Password Form */}
                      <form
                        onSubmit={handleUpdatePassword}
                        className="flex flex-col gap-2 pt-2 border-t border-default-100"
                      >
                        <h4 className="text-sm font-semibold flex items-center gap-1 text-default-700">
                          <BiLock className="size-4" /> Change Password
                        </h4>

                        {passwordMessage && (
                          <div
                            className={`text-xs p-2 rounded-lg ${
                              passwordMessage.type === "success"
                                ? "bg-success/15 text-success border border-success/30"
                                : "bg-danger/15 text-danger border border-danger/30"
                            }`}
                          >
                            {passwordMessage.text}
                          </div>
                        )}

                        <Label htmlFor="current-pw" className="text-xs">
                          Current Password
                        </Label>
                        <Input
                          id="current-pw"
                          variant="secondary"
                          type="password"
                          placeholder="Current password"
                          className="w-full"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />

                        <Label htmlFor="new-pw" className="text-xs">
                          New Password
                        </Label>
                        <Input
                          id="new-pw"
                          variant="secondary"
                          type="password"
                          placeholder="New password"
                          className="w-full"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />

                        <Label htmlFor="confirm-pw" className="text-xs">
                          Confirm New Password
                        </Label>
                        <Input
                          id="confirm-pw"
                          variant="secondary"
                          type="password"
                          placeholder="Confirm new password"
                          className="w-full"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />

                        <Button
                          type="submit"
                          variant="secondary"
                          className="mt-2 w-full cursor-pointer"
                          isDisabled={isUpdatingPassword || !newPassword}
                        >
                          {isUpdatingPassword
                            ? "Updating..."
                            : "Update Password"}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    /* Logged Out View */
                    <div className="flex flex-col gap-3">
                      <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-xs text-warning-700 dark:text-warning-300">
                        Sign in with your Jellyfin account to sync watched episodes, track playback progress, and save resume points across devices.
                      </div>

                      <form
                        onSubmit={handleLogin}
                        className="flex flex-col gap-2 pt-1"
                      >
                        {loginError && (
                          <div className="text-xs p-2 rounded-lg bg-danger/15 text-danger border border-danger/30">
                            {loginError}
                          </div>
                        )}

                        <Label htmlFor="login-username" className="text-xs">
                          Username
                        </Label>
                        <Input
                          id="login-username"
                          variant="secondary"
                          type="text"
                          placeholder="Jellyfin username"
                          className="w-full"
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                        />

                        <Label htmlFor="login-password" className="text-xs">
                          Password
                        </Label>
                        <Input
                          id="login-password"
                          variant="secondary"
                          type="password"
                          placeholder="Password"
                          className="w-full"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                        />

                        <Button
                          type="submit"
                          variant="primary"
                          className="mt-3 w-full cursor-pointer"
                          isDisabled={isLoggingIn || !loginUsername}
                        >
                          {isLoggingIn ? (
                            "Signing in..."
                          ) : (
                            <span className="flex items-center justify-center gap-1">
                              <BiLogIn className="size-4" /> Sign In
                            </span>
                          )}
                        </Button>
                      </form>
                    </div>
                  )}
                </Tabs.Panel>

                {/* PREFERENCES TAB */}
                <Tabs.Panel id="preferences">
                  <div className="flex flex-col gap-4">
                    {/* Theme Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-default-100 dark:bg-default-50 border border-default-200">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Theme</span>
                        <span className="text-xs text-muted">
                          Switch between light and dark mode
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="cursor-pointer flex items-center gap-1.5"
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

                    {/* Audio Preference */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-default-100 dark:bg-default-50 border border-default-200">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold flex items-center gap-1.5">
                          <BiVolumeFull /> Audio Language
                        </span>
                        <span className="text-xs text-muted">
                          Default audio preference
                        </span>
                      </div>
                      <Chip size="sm" color="accent" variant="secondary">
                        Dubbed (Default)
                      </Chip>
                    </div>

                    {/* Server Info */}
                    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-default-100 dark:bg-default-50 border border-default-200">
                      <span className="text-sm font-semibold flex items-center gap-1.5">
                        <BiServer /> Jellyfin Server
                      </span>
                      <span className="text-xs font-mono text-muted break-all">
                        {jellyfinClient.baseUrl}
                      </span>
                      <div className="flex items-center gap-1.5 pt-1 text-xs text-success">
                        <span className="w-2 h-2 rounded-full bg-success inline-block animate-pulse" />
                        Online & Configured
                      </div>
                    </div>
                  </div>
                </Tabs.Panel>
              </Tabs>
            </Modal.Body>

            <Modal.Footer className="pt-2">
              {user ? (
                <Button
                  variant="ghost"
                  className="w-full text-danger hover:bg-danger/10 cursor-pointer flex items-center justify-center gap-1.5"
                  onPress={handleLogout}
                >
                  <BiLogOut className="size-4" /> Sign Out
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full cursor-pointer"
                  onPress={() => onOpenChange(false)}
                >
                  Close
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
