import { Sunrise } from "lucide-react";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export default function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap font-extrabold tracking-[-0.035em] text-slate-950 ${className}`}>
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-current">
        <Sunrise className="size-5 text-orange-700" strokeWidth={1.8} />
      </span>
      <span>Sunrise <span className="text-orange-700">Academy</span></span>
    </span>
  );
}
