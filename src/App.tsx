import { Outlet, Route, Routes, Navigate } from "react-router";
import { ArcPage, EpisodePage, LoginPage } from "@/pages";
import { DataProvider } from "./context";

function App() {
  return (
    <Routes>
      <Route element={<DataProvider />}>
        <Route path="/" element={<Navigate to="/1" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path=":arcId" element={<Outlet />}>
          <Route index element={<ArcPage />} />
          <Route path=":episodeId" element={<EpisodePage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
