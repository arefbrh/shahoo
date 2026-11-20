const tones: Record<string, string> = {
  oils: "bg-forest text-ivory",
  butters: "bg-gold text-deep",
  nuts: "bg-deep text-gold-soft",
  herbs: "bg-cream text-forest",
};

export function ProductMark({
  iconType,
  title,
  subtitle,
}: {
  iconType: string;
  title: string;
  subtitle?: string;
}) {
  const tone = tones[iconType] ?? "bg-cream text-forest";
  return (
    <div className={`flex aspect-[4/3] h-full min-h-44 flex-col justify-between p-5 ${tone}`}>
      <p className="font-display text-xs">SHAHOO</p>
      <div>
        <p className="text-lg font-bold leading-7">{title}</p>
        {subtitle ? <p className="mt-1 text-xs opacity-80">{subtitle}</p> : null}
      </div>
    </div>
  );
}
