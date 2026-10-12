import { badgeTone } from "../utils";

export default function Badge({ value, tone }) {
  if (!value) return "—";
  const tones = {
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    info: "bg-sky-100 text-sky-800",
    bad: "bg-rose-100 text-rose-800",
    neutral: "bg-slate-100 text-slate-600",
  };
  const selectedTone = tone || badgeTone(value);

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tones[selectedTone] || tones.neutral}`}>
      {value}
    </span>
  );
}