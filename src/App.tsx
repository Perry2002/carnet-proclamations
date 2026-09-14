import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminLayout from './pages/AdminLayout';
import CultesPage from './pages/CultesPage';
import CroisadesPage from './pages/CroisadesPage';
import PublicForm from './pages/PublicForm';
import { Analytics } from "@vercel/analytics/react"

export default function App() {
  return (
    <BrowserRouter>
      <Analytics />
      <Routes>
        <Route path="/" element={<Navigate to="/admin/cultes" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="cultes" replace />} />
          <Route path="cultes" element={<CultesPage />} />
          <Route path="croisades" element={<CroisadesPage />} />
        </Route>
        <Route path="/c/:slug" element={<PublicForm />} />
        <Route path="*" element={<Navigate to="/admin/cultes" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
