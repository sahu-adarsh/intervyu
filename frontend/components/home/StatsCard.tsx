'use client';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: 'violet' | 'emerald' | 'blue';
}

const accentMap = {
  violet: 'text-violet-400',
  emerald: 'text-emerald-400',
  blue: 'text-blue-400',
};

export default function StatsCard({ label, value, icon, accent = 'violet' }: StatsCardProps) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 flex flex-col gap-2">
      <div className={`${accentMap[accent]}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );
}
