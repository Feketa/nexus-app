import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatSearch } from "@/components/ChatSearch";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const hideHeader = location.pathname.startsWith("/chat");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background grid-dots">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          {!hideHeader && (
            <header className="h-14 flex items-center gap-3 px-4 border-b border-border/40 glass sticky top-0 z-30">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
              <div className="flex-1 max-w-sm hidden md:flex">
                <ChatSearch />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">АД</span>
                </div>
              </div>
            </header>
          )}

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
