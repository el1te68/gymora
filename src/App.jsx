import { Navigate, Route, HashRouter, Routes } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './Layout';
import MusclesPage from './pages/MusclesPage';
import ExercisesPage from './pages/ExercisesPage';
import ProgramsPage from './pages/ProgramsPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import TrainPage from './pages/TrainPage';
import HistoryPage from './pages/HistoryPage';
import BodyWeightPage from './pages/BodyWeightPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import NutritionPage from './pages/NutritionPage';
import FoodsPage from './pages/FoodsPage';
import NutritionGoalPage from './pages/NutritionGoalPage';
import NutritionHistoryPage from './pages/NutritionHistoryPage';

export default function App() {
  return (
    <SettingsProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/train" replace />} />
            <Route path="/train" element={<TrainPage />} />
            <Route path="/programs" element={<ProgramsPage />} />
            <Route path="/programs/:id" element={<ProgramDetailPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/muscles" element={<MusclesPage />} />
            <Route path="/nutrition" element={<NutritionPage />} />
            <Route path="/nutrition/goals" element={<NutritionGoalPage />} />
            <Route path="/nutrition/history" element={<NutritionHistoryPage />} />
            <Route path="/foods" element={<FoodsPage />} />
            <Route path="/body-weight" element={<BodyWeightPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </SettingsProvider>
  );
}
