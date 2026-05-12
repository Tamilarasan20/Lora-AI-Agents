import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Agents from "@/pages/Agents";
import SophiePage from "@/pages/agents/Sophie";
import Models from "@/pages/Models";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents/sophie" element={<SophiePage />} />
        <Route path="models" element={<Models />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
