import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import { TempDisableProvider } from './context/TempDisableContext';
import NameEntry from './components/NameEntry';
import Layout from './components/Layout';
import SpinPage from './pages/SpinPage';
import RestaurantList from './pages/RestaurantList';
import AdminDashboard from './pages/AdminDashboard';
import SpinLog from './pages/SpinLog';
import './index.css';

function AppRoutes() {
  const { userName } = useUser();
  const [spinKey, setSpinKey] = useState(0);

  if (!userName) return <NameEntry />;

  return (
    <TempDisableProvider>
      <BrowserRouter>
        <Layout spinRefresh={spinKey}>
          <Routes>
            <Route path="/" element={<SpinPage onSpin={() => setSpinKey((k) => k + 1)} />} />
            <Route path="/restaurants" element={<RestaurantList />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/log" element={<SpinLog />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TempDisableProvider>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppRoutes />
    </UserProvider>
  );
}
