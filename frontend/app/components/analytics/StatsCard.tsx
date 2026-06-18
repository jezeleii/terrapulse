import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

export function StatsCard({ title, value, change, trend = "neutral" }: StatsCardProps) {
  const trendColor =
    trend === "up" ? "text-[#7ef6e0]" :
    trend === "down" ? "text-red-400" :
    "text-white/40";

  return (
    <div className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-4 hover:border-[#7ef6e0]/35 transition-colors">
      <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-2">
        {title.toUpperCase()}
      </div>
      <div className="text-xl font-black tracking-tight text-white">{value}</div>
      {change && (
        <div className={`text-[11px] font-bold mt-1 tracking-widest ${trendColor}`}>{change}</div>
      )}
    </div>
  );
}
