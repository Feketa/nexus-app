import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import AIChat from "./pages/AIChat";
import DocumentVault from "./pages/DocumentVault";
import AdminSettings from "./pages/AdminSettings";
import UserManagement from "./pages/UserManagement";
import UserProfile from "./pages/UserProfile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ChatProvider>
            <Routes>
              {/* Public */}
              <Route path="/auth" element={<Auth />} />

              {/* Protected */}
              <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
              <Route path="/chat" element={<ProtectedLayout><AIChat /></ProtectedLayout>} />
              <Route path="/vault" element={<ProtectedLayout><DocumentVault /></ProtectedLayout>} />
              <Route path="/settings" element={<ProtectedLayout><AdminSettings /></ProtectedLayout>} />
              <Route path="/users" element={<ProtectedLayout><UserManagement /></ProtectedLayout>} />
              <Route path="/profile" element={<ProtectedLayout><UserProfile /></ProtectedLayout>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ChatProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
