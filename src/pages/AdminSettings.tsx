import { Key, CheckCircle2, Database, Zap, ScrollText } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Налаштування адміна</h1>
        <p className="text-sm text-muted-foreground mt-1">Конфігурація AI провайдера та системних параметрів</p>
      </div>

      {/* AI Provider Info */}
      <section className="glass-card rounded-xl p-6 border border-border/40 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">AI Провайдер</h2>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">AI Gateway — активний</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Підключено до AI Gateway. API ключ налаштовано на сервері — безпечно, без витоку в клієнт.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Модель", value: "Gemini Flash" },
            { label: "Стрімінг", value: "SSE / Активний" },
            { label: "RAG", value: "Активний" },
          ].map((item) => (
            <div key={item.label} className="glass-card rounded-lg p-3 border border-border/30">
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p className="text-xs font-semibold mt-1 text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* System Status */}
      <section className="glass-card rounded-xl p-6 border border-border/40 space-y-3">
        <h2 className="font-semibold text-sm mb-2">Системні параметри</h2>
        {[
          { icon: Database, label: "RAG режим", desc: "База знань використовується для відповідей AI" },
          { icon: Zap, label: "Потокова передача", desc: "Стрімінг відповідей в реальному часі (SSE)" },
          { icon: ScrollText, label: "Журнал аудиту", desc: "Усі дії автоматично логуються" },
        ].map((t) => (
          <div key={t.label} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
            <div className="flex items-center gap-3">
              <t.icon className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            </div>
            <span className="text-[11px] font-medium px-2 py-1 rounded-full text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Активний
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
