import { useState, useEffect } from "react";
import { Search, MessageSquare, Upload, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Severity = "info" | "warning" | "success" | "critical";

interface AuditEvent {
  id: string;
  type: "chat" | "upload" | "system" | "error";
  action: string;
  actor: string;
  details: string;
  timestamp: string;
  severity: Severity;
}

const severityConfig = {
  success: { class: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", dot: "bg-emerald-400" },
  info:    { class: "text-primary bg-primary/10 border-primary/20",             dot: "bg-primary"    },
  warning: { class: "text-amber-400 bg-amber-400/10 border-amber-400/20",       dot: "bg-amber-400"  },
  critical:{ class: "text-destructive bg-destructive/10 border-destructive/20", dot: "bg-destructive"},
};

const severityLabels: Record<Severity, string> = {
  success: "Успіх", info: "Інфо", warning: "Увага", critical: "Критично",
};

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("uk-UA", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function AuditLogs() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("Всі");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [{ data: messages }, { data: docs }] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("id, role, content, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("documents")
          .select("id, name, file_size, status, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const built: AuditEvent[] = [];

      (docs ?? []).forEach((d: any) => {
        built.push({
          id: `doc-${d.id}`,
          type: "upload",
          action: "Файл завантажено",
          actor: d.user_id?.slice(0, 8) + "…",
          details: `${d.name} · ${(d.file_size / 1024 / 1024).toFixed(1)} МБ · статус: ${d.status}`,
          timestamp: formatTs(d.created_at),
          severity: d.status === "error" ? "critical" : "success",
        });
      });

      (messages ?? []).forEach((m: any) => {
        if (m.role !== "user") return;
        built.push({
          id: `msg-${m.id}`,
          type: "chat",
          action: "Запит до AI",
          actor: m.user_id?.slice(0, 8) + "…",
          details: m.content.slice(0, 80) + (m.content.length > 80 ? "…" : ""),
          timestamp: formatTs(m.created_at),
          severity: "info",
        });
      });

      built.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setEvents(built);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = events.filter((e) => {
    const matchSearch = search === "" ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.details.toLowerCase().includes(search.toLowerCase());
    const matchSev = severityFilter === "Всі" || severityLabels[e.severity] === severityFilter;
    return matchSearch && matchSev;
  });

  const critCount = events.filter((e) => e.severity === "critical").length;

  const iconMap = {
    chat:   MessageSquare,
    upload: Upload,
    system: CheckCircle2,
    error:  AlertTriangle,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Журнал аудиту</h1>
          <p className="text-sm text-muted-foreground mt-1">Всі системні події та дії користувачів</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {critCount > 0 && (
            <span className="glass-card px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive">
              {critCount} критичних
            </span>
          )}
          <span className="glass-card px-3 py-1.5 rounded-lg border border-border/40 text-muted-foreground">
            {events.length} подій
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Пошук подій..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/30 border-border/40 focus-visible:ring-primary/40"
          />
        </div>
        <div className="flex gap-1.5">
          {["Всі", "Успіх", "Інфо", "Увага", "Критично"].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200
                ${severityFilter === s
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-muted/30 text-muted-foreground border-border/40 hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Events */}
      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-muted-foreground text-sm">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Завантаження подій...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Немає подій для відображення</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40">
                  {["Подія", "Актор", "Деталі", "Час", "Рівень"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const Icon = iconMap[e.type];
                  const sc = severityConfig[e.severity];
                  return (
                    <tr key={e.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <span className="text-xs font-medium">{e.action}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{e.actor}</td>
                      <td className="px-5 py-3 max-w-xs">
                        <p className="text-xs text-muted-foreground truncate">{e.details}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">{e.timestamp}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${sc.class}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {severityLabels[e.severity]}
                        </span>
                      </td>
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
