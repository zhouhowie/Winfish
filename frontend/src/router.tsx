import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import PreMarket from '@/pages/PreMarket';
import Desk from '@/pages/Desk';
import Positions from '@/pages/Positions';
import LimitLadder from '@/pages/LimitLadder';
import Review from '@/pages/Review';
import Settings from '@/pages/Settings';
import SectorPage from '@/pages/SectorPage';
import CoreStocks from '@/pages/CoreStocks';
import SectorTrack from '@/pages/SectorTrack';
import Patrol from '@/pages/Patrol';
import ExportPage from '@/pages/ExportPage';
import Feedback from '@/pages/Feedback';
import { Navigate } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      // 发现
      { path: 'emotion', element: <LimitLadder /> },
      { path: 'sector-track', element: <SectorTrack /> },
      { path: 'patrol', element: <Patrol /> },
      // 操盘
      { path: 'core', element: <CoreStocks /> },
      { path: 'desk', element: <Desk /> },
      { path: 'premarket', element: <PreMarket /> },
      { path: 'review', element: <Review /> },
      // 系统
      { path: 'positions', element: <Positions /> },
      { path: 'export', element: <ExportPage /> },
      { path: 'settings', element: <Settings /> },
      { path: 'feedback', element: <Feedback /> },
      // 旧路由兼容
      { path: 'ladder', element: <Navigate to="/emotion" replace /> },
      { path: 'sector', element: <Navigate to="/sector-track" replace /> },
      { path: 'watchlist', element: <Navigate to="/core" replace /> },
      { path: 'discover', element: <Navigate to="/" replace /> },
    ],
  },
]);
