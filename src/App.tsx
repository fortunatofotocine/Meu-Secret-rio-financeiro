import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Financeiro from './pages/Financeiro';
import DespesasFixas from './pages/DespesasFixas';
import Agenda from './pages/Agenda';
import Mensagens from './pages/Mensagens';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="despesas-fixas" element={<DespesasFixas />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="mensagens" element={<Mensagens />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
