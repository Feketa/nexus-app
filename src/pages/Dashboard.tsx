import { useEffect, useState } from "react";
import { MessageSquare, FileText, Brain, TrendingUp, Zap, Clock, ArrowUpRight, CircleDot } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const chartData = [
  { time: "Пн", queries: 0 },
  { time: "Вт", queries: 0 },
  { time: "Ср", queries: 0 },
  { time: "Чт", queries: 0 },
  { time: "Пт", queries: 0 },
  { time: "Сб", queries: 0 },
  { time: "Нд", queries: 0 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [weeklyData, setWeeklyData] = useState(chartData);
  const [recentMessages, setRecentMessages] = useState<Array<{ content: string; created_at: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function loadData() {
      setLoading(true);
      const [msgRes, docRes, recentRes] = await Promise.all([
        supabase.from("chat_messages").select("id, created_at", { count: "exact" }).eq("user_id", user!.id).eq("role", "user"),
        supabase.from("documents").select("id", { count: "exact" }).eq("user_id", user!.id),
        supabase.from("chat_messages").select("content, created_at, role").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5),
      ]);

      setTotalMessages(msgRes.count ?? 0);
      setTotalDocs(docRes.count ?? 0);
      if (recentRes.data) setRecentMessages(recentRes.data);

      // Build weekly chart from message timestamps
      if (msgRes.data) {
        const days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
        const counts: Record<string, number> = {};
        msgRes.data.forEach((m) => {
          const d = days[new Date(m.created_at).getDay()];
          counts[d] = (counts[d] ?? 0) + 1;
        });
        setWeeklyData(days.slice(1).concat(days[0]).map((d) => ({ time: d, queries: counts[d] ?? 0 })));
      }
      setLoading(false);
    }
    loadData();
  }, [user]);

  const stats = [
    {
      label: "Всього запитів",
      value: loading ? "—" : totalMessages.toLocaleString("uk-UA"),
      change: "всього",
      icon: MessageSquare,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: "Активних документів",
      value: loading ? "—" : totalDocs.toLocaleString("uk-UA"),
      change: "завантажено",
      icon: FileText,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
    },
    {
      label: "AI Модель",
      value: "Gemini",
      change: "Flash 2.5",
      icon: Brain,
      color: "text-secondary",
      bg: "bg-secondary/10",
      border: "border-secondary/20",
    },
    {
      label: "Статус системи",
      value: "Активна",
      change: "онлайн",
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
  ];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "щойно";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} хв тому`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} год тому`;
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Дашборд <span className="gradient-text">NexusAI</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Ласкаво просимо — ось ваш огляд платформи</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground glass-card px-3 py-1.5 rounded-lg">
          <CircleDot className="w-3 h-3 text-emerald-400 animate-pulse" />
          Система активна
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`glass-card rounded-xl p-5 border ${s.border} transition-all duration-300 hover:scale-[1.02]`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Weekly chart */}
        <div className="xl:col-span-2 glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm">Активність по днях</h3>
              <p className="text-xs text-muted-foreground">Ваші запити за останній тиждень</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(189,94%,43%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(189,94%,43%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(222,47%,10%)", border: "1px solid hsl(217,32%,18%)", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "hsl(210,40%,96%)" }}
                itemStyle={{ color: "hsl(189,94%,43%)" }}
              />
              <Area type="monotone" dataKey="queries" name="Запити" stroke="hsl(189,94%,43%)" strokeWidth={2} fill="url(#qGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* System status */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-1">Статус системи</h3>
          <p className="text-xs text-muted-foreground mb-4">Компоненти платформи</p>
          <div className="space-y-3">
            {[
              { name: "AI Gateway", status: "active", info: "Gemini Flash" },
              { name: "База даних", status: "active", info: "PostgreSQL" },
              { name: "Сховище файлів", status: "active", info: "Documents bucket" },
            ].map((m) => (
              <div key={m.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400 shadow-[0_0_6px_hsl(142,76%,36%)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.info}</p>
                </div>
                <span className="text-[10px] font-medium text-emerald-400">OK</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Ваша остання активність</h3>
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>
        {recentMessages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Ще немає повідомлень. Почніть чат!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentMessages.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-primary/20" : "bg-secondary/20"}`}>
                  {m.role === "user"
                    ? <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    : <Brain className="w-3.5 h-3.5 text-secondary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/80 truncate">{m.content}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(m.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
