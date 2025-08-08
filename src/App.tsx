import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "@/pages/auth/Login";
import SuperDashboard from "@/pages/super/SuperDashboard";
import AdminDashboard from "@/pages/company/AdminDashboard";
import EmployeePortal from "@/pages/employee/EmployeePortal";
import SuperCompanies from "@/pages/super/Companies";
import SuperUsers from "@/pages/super/Users";
import AdminCatalog from "@/pages/company/Catalog";
import AdminPolicies from "@/pages/company/Policies";
import AdminRequests from "@/pages/company/Requests";
import EmployeeCatalog from "@/pages/employee/Catalog";
import EmployeeRepayments from "@/pages/employee/Repayments";
import { AuthProvider, ProtectedRoute } from "@/context/AuthContext";

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
            <Route path="/login" element={<Login />} />

            <Route
              path="/super"
              element={
                <ProtectedRoute roles={["super_admin"]}>
                  <SuperDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee"
              element={
                <ProtectedRoute roles={["employee"]}>
                  <EmployeePortal />
                </ProtectedRoute>
              }
            />

            {/* Super Admin nested pages */}
            <Route
              path="/super/companies"
              element={
                <ProtectedRoute roles={["super_admin"]}>
                  <SuperCompanies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/users"
              element={
                <ProtectedRoute roles={["super_admin"]}>
                  <SuperUsers />
                </ProtectedRoute>
              }
            />

            {/* Company Admin nested pages */}
            <Route
              path="/admin/catalog"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminCatalog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/policies"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminPolicies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/requests"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminRequests />
                </ProtectedRoute>
              }
            />

            {/* Employee nested pages */}
            <Route
              path="/employee/catalog"
              element={
                <ProtectedRoute roles={["employee"]}>
                  <EmployeeCatalog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/repayments"
              element={
                <ProtectedRoute roles={["employee"]}>
                  <EmployeeRepayments />
                </ProtectedRoute>
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
