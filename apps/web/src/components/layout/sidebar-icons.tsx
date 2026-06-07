import Image from "next/image";
import { cn } from "@/lib/cn";

const icon = (src: string, alt: string, size: number) => (
  <Image src={src} alt={alt} width={size} height={size} className="block shrink-0" />
);

const logoMarkFilter =
  "brightness(0) sepia(1) saturate(12) hue-rotate(-15deg) brightness(1.5)";

export function SummitLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-[7px]", className)}>
      <Image
        src="/brand/fullsphere-mark.png"
        alt="FullSphere"
        width={30}
        height={30}
        className="h-[30px] w-[30px] shrink-0 object-contain"
        style={{ filter: logoMarkFilter }}
        priority
      />
      <span
        className="text-[17px] font-semibold tracking-[-0.01em] text-[#1A1A18]"
        style={{ fontFamily: "var(--font-urbanist)" }}
      >
        FullSphere
      </span>
      <span className="rounded bg-black/5 px-1.5 py-px text-[11px] font-medium tracking-[0.02em] text-[#5A5850]">
        AI
      </span>
    </div>
  );
}

export function SummitLogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/fullsphere-mark.png"
      alt="FullSphere"
      width={32}
      height={32}
      className={cn("h-8 w-8 shrink-0 object-contain object-center", className)}
      style={{ filter: logoMarkFilter }}
      priority
    />
  );
}

export function SidebarSearchIcon() {
  return icon("/sidebar/search-icon.svg", "", 16);
}

export function SidebarAccountAvatar() {
  return (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e2e8f0]">
      <span className="type-caption font-medium leading-none text-[#64748b]">A</span>
    </span>
  );
}
