import { Outlet, Route, Routes } from "react-router";
import { ArcPage, Watching, EpisodePage } from "@/pages";
import { DataProvider } from "./context";

function App() {
  return (
    <Routes>
      <Route element={<DataProvider />}>
        <Route path="watching" element={<Watching />} />
        <Route path=":arcId" element={<Outlet />}>
          <Route index element={<ArcPage />} />
          <Route path=":episodeId" element={<EpisodePage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
