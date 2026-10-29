import { useState } from "react";
import { Layout } from "@/components";
import { Button, Input, Label } from "@heroui/react";
import { useDataContext } from "@/context/DataContext";
import { Toast, toast } from "@heroui/react";
import { useNavigate } from "react-router";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useDataContext();
  const navigate = useNavigate();
  const handleLogin = async () => {
    try {
      await login(email, password);
      navigate("/");
    } catch {
      toast.danger("Invalid username or password");
    }
  };
  return (
    <Layout>
      <Toast.Provider />
      <div className="flex flex-col gap-2 justify-center items-center h-full">
        <div className="flex flex-col gap-2 justify-start items-start w-full max-w-sm">
          <Label htmlFor="input-type-username">Username</Label>
          <Input
            id="input-type-username"
            variant="secondary"
            placeholder="Username"
            type="text"
            className="w-full mb-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Label htmlFor="input-type-password">Password</Label>
          <Input
            id="input-type-password"
            variant="secondary"
            placeholder="Password"
            type="password"
            className="w-full mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button className="w-full" onPress={handleLogin}>
            Login
          </Button>
        </div>
      </div>
    </Layout>
  );
}
