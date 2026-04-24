import React, { useState } from "react";
import { Modal, InputGroup, Button, Tabs, Label, Input } from "@heroui/react";
import { BiSearch } from "react-icons/bi";
import { useUser } from "@/hooks";

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
export default function SettingsModal({
  isOpen,
  onOpenChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { user, login, logout, register } = useUser();

  const handleLogin = async () => {
    await login(email, password);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleRegister = async () => {
    await register(email, password);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {/* <Tabs className="w-full text-center flex items-start justify-start">
                  <Tabs.ListContainer>
                    <Tabs.List
                      aria-label="Options"
                      className="w-fit *:h-6 *:w-fit *:px-3 *:text-sm *:font-normal *:data-[selected=true]:text-accent-foreground"
                      selectedValue={activeTab}
                      onValueChange={setActiveTab}
                    >
                      <Tabs.Tab id="general">
                        General
                        <Tabs.Indicator className="bg-accent" />
                      </Tabs.Tab>
                      <Tabs.Tab id="account">
                        Account
                        <Tabs.Indicator className="bg-accent" />
                      </Tabs.Tab>
                      <Tabs.Tab id="bi-weekly">
                        Bi-Weekly
                        <Tabs.Indicator className="bg-accent" />
                      </Tabs.Tab>
                      <Tabs.Tab id="monthly">
                        Monthly
                        <Tabs.Indicator className="bg-accent" />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                  <Tabs.Panel id="general">
                    <div>
                      <h3>General</h3>
                    </div>
                  </Tabs.Panel>
                </Tabs> */}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Tabs className="w-full text-center flex items-start justify-start">
                <Tabs.ListContainer>
                  <Tabs.List
                    aria-label="Options"
                    className="w-fit *:h-6 *:w-fit *:px-3 *:text-sm *:font-normal *:data-[selected=true]:text-accent-foreground"
                    selectedValue={activeTab}
                    onValueChange={setActiveTab}
                  >
                    <Tabs.Tab id="account">
                      Account
                      <Tabs.Indicator className="bg-accent" />
                    </Tabs.Tab>

                    <Tabs.Tab id="settings">
                      Settings
                      <Tabs.Indicator className="bg-accent" />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel id="account">
                  <div className="flex flex-col gap-2 justify-start items-start">
                    <Label htmlFor="input-type-username">Username</Label>
                    <Input
                      id="input-type-username"
                      variant="secondary"
                      placeholder="Username"
                      type="text"
                      className="w-full"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Label htmlFor="input-type-password">Password</Label>
                    <Input
                      id="input-type-password"
                      variant="secondary"
                      placeholder="Password"
                      type="password"
                      className="w-full"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </Tabs.Panel>
                <Tabs.Panel id="settings">
                  <div className="flex flex-col gap-2 justify-start items-start">
                    <Label htmlFor="input-type-email">Email</Label>
                    <Input
                      id="input-type-email"
                      variant="secondary"
                      placeholder="jane@example.com"
                      type="email"
                      className="w-full"
                    />
                    <Label htmlFor="input-type-password">Password</Label>
                    <Input
                      id="input-type-password"
                      variant="secondary"
                      placeholder="Password"
                      type="password"
                      className="w-full"
                    />
                  </div>
                </Tabs.Panel>
              </Tabs>
            </Modal.Body>
            <Modal.Footer>
              <Button
                className="w-full flex-1"
                variant="ghost"
                onPress={handleRegister}
              >
                Sign Up
              </Button>
              <Button className="w-full" onPress={handleLogin}>
                Login
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
