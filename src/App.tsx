import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CustomerDashboard from "./pages/CustomerDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import NotFound from "./pages/NotFound";
import QRScanner from "./components/QRScanner";
import ApiDocs from "./pages/ApiDocs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            
            {/* Auth Routes - Protected from logged in users */}
            <Route 
              path="/login" 
              element={
                <ProtectedRoute requireAuth={false}>
                  <Login />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/signup" 
              element={
                <ProtectedRoute requireAuth={false}>
                  <Signup />
                </ProtectedRoute>
              } 
            />
            
            {/* Customer Routes */}
            <Route 
              path="/customer/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/customer/add-device" 
              element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <QRScanner />
                </ProtectedRoute>
              } 
            />
            

            {/* Super Admin Routes */}
            <Route 
              path="/superadmin/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Redirect legacy routes */}
            <Route path="/customer" element={<Navigate to="/customer/dashboard" replace />} />

            <Route path="/superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
