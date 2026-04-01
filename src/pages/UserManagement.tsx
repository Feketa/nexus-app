import { useState, useEffect } from "react";
import { Users, Plus, Search, Shield, Headphones, UserCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "support" | "client";

interface UserEntry {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  department: string | null;
  created_at: string;
  updated_at: string;
}

const roleConfig: Record<string, { icon: typeof Shield; class: string; bg: string; label: string }> = {
  admin:   { icon: Shield,      class: "text-primary border-primary/30 bg-primary/10",        bg: "bg-primary/10",        label: "Admin"   },
  support: { icon: Headphones,  class: "text-secondary border-secondary/30 bg-secondary/10",  bg: "bg-secondary/10",      label: "Support" },
  client:  { icon: UserCircle,  class: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", bg: "bg-emerald-400/10", label: "Client" },
};

const avatarColors = [
  "from-cyan-400 to-blue-500",
  "from-indigo-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Щойно";
  if (mins < 60) return `${mins} хв тому`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Вчора";
  return `${days} днів тому`;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("Всі");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setUsers(data as UserEntry[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = users.filter((u) => {
    const name = u.display_name ?? "";
    const email = u.email ?? "";
    const matchSearch = search === "" ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "Всі" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = {
    admin:   users.filter((u) => u.role === "admin").length,
    support: users.filter((u) => u.role === "support").length,
    client:  users.filter((u) => u.role === "client").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Управління користувачами</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} користувачів у системі</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 transition-transform active:scale-95">
          <Plus className="w-3.5 h-3.5" /> Додати користувача
        </Button>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(["admin", "support", "client"] as Role[]).map((role) => {
          const rc = roleConfig[role];
          return (
            <div
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? "Всі" : role)}
              className={`glass-card rounded-xl p-4 border transition-all duration-200 cursor-pointer
                ${roleFilter === role ? `border-primary/30 ${rc.bg}` : "border-border/40 hover:border-border"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{roleCounts[role]}</p>
                  <p className="text-xs text-muted-foreground">{rc.label}</p>
                </div>
                <rc.icon className={`w-5 h-5 ${rc.class.split(" ")[0]}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Пошук за іменем або email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted/30 border-border/40 focus-visible:ring-primary/40"
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-muted-foreground text-sm">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Завантаження...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {search || roleFilter !== "Всі" ? "Немає результатів для пошуку" : "Немає користувачів"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40">
                  {["Користувач", "Email", "Роль", "Відділ", "Зареєстрований", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => {
                  const rc = roleConfig[u.role] ?? roleConfig.client;
                  const RoleIcon = rc.icon;
                  const initials = (u.display_name ?? u.email ?? "?")
                    .split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr key={u.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[idx % avatarColors.length]} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-[10px] font-bold text-white">{initials}</span>
                          </div>
                          <span className="text-sm font-medium">{u.display_name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Mail className="w-3 h-3" /> {u.email ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${rc.class}`}>
                          <RoleIcon className="w-3 h-3" />
                          {rc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{u.department ?? "—"}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{formatDate(u.created_at)}</td>
                      <td className="px-5 py-3" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
