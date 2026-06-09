import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

// Layouts
const DistributorLayout = lazy(() => import('./components/Layout/DistributorLayout.jsx'));
const ManagerLayout = lazy(() => import('./components/Layout/ManagerLayout.jsx'));
const ExecutiveLayout = lazy(() => import('./components/Layout/ExecutiveLayout.jsx'));

// Pages
const OpeningPage = lazy(() => import('./pages/OpeningPage.jsx'));
const CaribBreweryLanding = lazy(() => import('./pages/CaribBreweryLanding.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));

// Distributor
const DistributorDashboard = lazy(() => import('./pages/DistributorDashboard.jsx'));
const ProductCatalog = lazy(() => import('./pages/ProductCatalog.jsx'));
const Merchandise = lazy(() => import('./pages/Merchandise.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const MyOrders = lazy(() => import('./pages/MyOrders.jsx'));
const OrderTracking = lazy(() => import('./pages/OrderTracking.jsx'));
const ARDashboard = lazy(() => import('./pages/ARDashboard.jsx'));
const Documents = lazy(() => import('./pages/Documents.jsx'));
const Promotions = lazy(() => import('./pages/Promotions.jsx'));
const AIOrderAssistant = lazy(() => import('./pages/AIOrderAssistant.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));

// Manager
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard.jsx'));
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue.jsx'));
const OrderReview = lazy(() => import('./pages/OrderReview.jsx'));
const AIDecisionCopilot = lazy(() => import('./pages/AIDecisionCopilot.jsx'));
const AIExplainability = lazy(() => import('./pages/AIExplainability.jsx'));
const AIApprovalReport = lazy(() => import('./pages/AIApprovalReport.jsx'));

// Executive
const ExecutiveAnalytics = lazy(() => import('./pages/ExecutiveAnalytics.jsx'));
const SimulationLab = lazy(() => import('./pages/SimulationLab.jsx'));

function Loading() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <CircularProgress color="secondary" />
    </Box>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Opening splash (app entry point) */}
        <Route path="/" element={<OpeningPage />} />

        {/* Public landing page */}
        <Route path="/home" element={<CaribBreweryLanding />} />

        {/* Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Distributor portal */}
        <Route path="/distributor" element={<DistributorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DistributorDashboard />} />
          <Route path="catalog" element={<ProductCatalog />} />
          <Route path="merchandise" element={<Merchandise />} />
          <Route path="cart" element={<Cart />} />
          <Route path="my-orders" element={<MyOrders />} />
          <Route path="order/:id" element={<OrderTracking />} />
          <Route path="ar" element={<ARDashboard />} />
          <Route path="documents" element={<Documents />} />
          <Route path="promotions" element={<Promotions />} />
          <Route path="ai-assistant" element={<AIOrderAssistant />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Manager portal */}
        <Route path="/manager" element={<ManagerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="approvals" element={<ApprovalQueue />} />
          <Route path="review/:id" element={<OrderReview />} />
          <Route path="copilot" element={<AIDecisionCopilot />} />
          <Route path="explainability" element={<AIExplainability />} />
          <Route path="reports" element={<AIApprovalReport />} />
        </Route>

        {/* Executive portal */}
        <Route path="/executive" element={<ExecutiveLayout />}>
          <Route index element={<Navigate to="analytics" replace />} />
          <Route path="analytics" element={<ExecutiveAnalytics />} />
          <Route path="simulation" element={<SimulationLab />} />
          <Route path="ai-summary" element={<ExecutiveAnalytics />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
