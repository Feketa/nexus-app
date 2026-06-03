import { useState, useEffect } from "react";
import { Camera, Save, Shield, Globe, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function UserProfile() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setName(data.display_name || "");
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("user_id", user.id);

    if (error) toast.error("Помилка збереження: " + error.message);
    else toast.success("Профіль збережено!");
    setSaving(false);
  };

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : (user?.email?.[0] || "?").toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Профіль користувача</h1>
        <p className="text-sm text-muted-foreground mt-1">Особисті налаштування</p>
      </div>

      {/* Avatar Section */}
      <div className="glass-card rounded-2xl p-6 border border-border/40">
        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center cyan-glow">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h2 className="font-bold text-lg">{name || user?.email?.split("@")[0] || "Користувач"}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Shield className="w-3 h-3" /> Користувач
            </span>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
            >
              <LogOut className="w-3.5 h-3.5" /> Вийти
            </Button>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="glass-card rounded-2xl p-6 border border-border/40 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Особиста інформація
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Повне ім'я</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Іван Петренко"
              className="bg-muted/30 border-border/40 focus-visible:ring-primary/40 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email адреса</Label>
            <Input
              value={user?.email || ""}
              disabled
              className="bg-muted/10 border-border/30 text-sm opacity-60"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 transition-transform active:scale-95"
        >
          {saving
            ? <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Збереження...</>
            : <><Save className="w-4 h-4" /> Зберегти зміни</>
          }
        </Button>
      </div>
    </div>
  );
}
