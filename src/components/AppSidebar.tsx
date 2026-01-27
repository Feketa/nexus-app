import {
  LayoutDashboard,
  MessageSquare,
  FolderLock,
  Database,
  BarChart3,
  Settings,
  FlaskConical,
  Users,
  LogOut,
  Cpu,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Дашборд", url: "/", icon: LayoutDashboard },
  { title: "AI Чат", url: "/chat", icon: MessageSquare },
  { title: "Сховище документів", url: "/vault", icon: FolderLock },
  { title: "База знань", url: "/knowledge", icon: Database },
  { title: "Аналітика", url: "/analytics", icon: BarChart3 },
];

const adminNav = [
  { title: "Налаштування", url: "/settings", icon: Settings },
  { title: "Prompt Lab", url: "/prompt-lab", icon: FlaskConical },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const currentPath = location.pathname;
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "??";
  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Користувач";
  const displayEmail = user?.email || "";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      {/* Logo */}
      <SidebarHeader className="px-4 py-5 border-b border-border/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center cyan-glow">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm gradient-text leading-none">NexusAI</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Enterprise Platform</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4">
        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase px-4 mb-1">
              Головне
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 mx-2
                        ${isActive(item.url)
                          ? "bg-primary/15 text-primary border border-primary/20 cyan-glow"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                    >
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive(item.url) ? "text-primary" : ""}`} />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && isActive(item.url) && (
                        <ChevronRight className="w-3 h-3 ml-auto text-primary/60" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Navigation */}
        <SidebarGroup className="mt-4">
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase px-4 mb-1">
              Адміністрування
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                    <NavLink
                      to={item.url}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 mx-2
                        ${isActive(item.url)
                          ? "bg-secondary/15 text-secondary border border-secondary/20 indigo-glow"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                    >
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive(item.url) ? "text-secondary" : ""}`} />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && isActive(item.url) && (
                        <ChevronRight className="w-3 h-3 ml-auto text-secondary/60" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border/40 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={collapsed ? "Профіль" : undefined}>
              <NavLink
                to="/profile"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive("/profile")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white">{initials}</span>
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{displayEmail}</p>
                  </div>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={collapsed ? "Вийти" : undefined}>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Вийти</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
