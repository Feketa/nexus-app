import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, MessageSquare, Clock, FileText, BarChart2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const tooltipStyle = {
  contentStyle: { background: "hsl(222,47%,10%)", border: "1px solid hsl(217,32%,18%)", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "hsl(210,40%,96%)" },
};

const DAYS_UK = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalMsgs, setTotalMsgs] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ date: string; queries: number; responses: number }[]>([]);
  const [hourlyData, setHourlyData] = useState<{ hour: string; count: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);

      const [msgRes, docRes, sessRes] = await Promise.all([
        supabase.from("chat_messages").select("id, created_at, role").eq("user_id", user!.id),
        supabase.from("documents").select("id", { count: "exact" }).eq("user_id", user!.id),
        supabase.from("chat_sessions").select("id", { count: "exact" }).eq("user_id", user!.id),
      ]);

      const msgs = msgRes.data ?? [];
      const userMsgs = msgs.filter((m) => m.role === "user");
      const asMsgs = msgs.filter((m) => m.role === "assistant");

      setTotalMsgs(userMsgs.length);
      setTotalDocs(docRes.count ?? 0);
      setSessions(sessRes.count ?? 0);

      // Build last-7-days data
      const now = new Date();
      const last7: { date: string; queries: number; responses: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const label = DAYS_UK[d.getDay()];
        const ds = d.toDateString();
        last7.push({
          date: label,
          queries: userMsgs.filter((m) => new Date(m.created_at).toDateString() === ds).length,
          responses: asMsgs.filter((m) => new Date(m.created_at).toDateString() === ds).length,
        });
      }
      setWeeklyData(last7);

      // Hourly distribution (all time)
      const hourCounts: Record<number, number> = {};
      userMsgs.forEach((m) => {
        const h = new Date(m.created_at).getHours();
        hourCounts[h] = (hourCounts[h] ?? 0) + 1;
      });
      const hourly = Array.from({ length: 24 }, (_, h) => ({
        hour: `${h.toString().padStart(2, "0")}:00`,
        count: hourCounts[h] ?? 0,
      })).filter((_, i) => i % 2 === 0); // show every 2 hours
      setHourlyData(hourly);

      setLoading(false);
    }
    load();
  }, [user]);

  const kpis = [
    { label: "Всього запитів", value: loading ? "—" : totalMsgs.toString(), icon: MessageSquare, change: "від вас" },
    { label: "Активних сесій", value: loading ? "—" : sessions.toString(), icon: TrendingUp, change: "розмов" },
    { label: "Документів", value: loading ? "—" : totalDocs.toString(), icon: FileText, change: "завантажено" },
    { label: "AI Модель", value: "Gemini", icon: Clock, change: "Flash 2.5" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Аналітика</h1>
        <p className="text-sm text-muted-foreground mt-1">Ваша активність на платформі</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass-card rounded-xl p-4 border border-border/40 hover:border-primary/20 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <k.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[11px] font-medium text-emerald-400">{k.change}</span>
            </div>
            <p className="text-xl font-bold">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-0.5">Активність за тиждень</h3>
        <p className="text-xs text-muted-foreground mb-4">Запити та відповіді AI · 7 днів</p>
        {loading ? (
          <div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
        ) : weeklyData.every((d) => d.queries === 0 && d.responses === 0) ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2">
            <BarChart2 className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Дані з'являться після перших запитів до AI</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="qv1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(189,94%,43%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(189,94%,43%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="qv2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(239,68%,62%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(239,68%,62%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="queries" name="Запити" stroke="hsl(189,94%,43%)" strokeWidth={2} fill="url(#qv1)" />
              <Area type="monotone" dataKey="responses" name="Відповіді AI" stroke="hsl(239,68%,62%)" strokeWidth={2} fill="url(#qv2)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Hourly chart */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-0.5">Розподіл по годинах</h3>
        <p className="text-xs text-muted-foreground mb-4">Коли ви найбільш активні</p>
        {loading ? (
          <div className="h-32 bg-muted/20 rounded-lg animate-pulse" />
        ) : hourlyData.every((d) => d.count === 0) ? (
          <div className="h-32 flex flex-col items-center justify-center gap-2">
            <BarChart2 className="w-8 h-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Немає даних</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "Запитів"]} />
              <Bar dataKey="count" fill="hsl(189,94%,43%)" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
