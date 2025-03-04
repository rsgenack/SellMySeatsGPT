import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./hooks/use-auth";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "./lib/protected-route";

import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import AdminDashboardPage from "@/pages/admin/dashboard-page";
import AdminEmailSetupPage from "@/pages/admin/email-setup-page";
import AdminEmailMonitorPage from "@/pages/admin/email-monitor-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute 
        path="/admin" 
        component={AdminDashboardPage} 
        requireAdmin
      />
      <ProtectedRoute 
        path="/admin/email-setup" 
        component={AdminEmailSetupPage} 
        requireAdmin 
      />
      <ProtectedRoute 
        path="/admin/email-monitor" 
        component={AdminEmailMonitorPage} 
        requireAdmin 
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;