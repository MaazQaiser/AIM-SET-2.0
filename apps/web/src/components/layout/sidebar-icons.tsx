import Image from "next/image";
import { cn } from "@/lib/cn";

const icon = (src: string, alt: string, size: number) => (
  <Image src={src} alt={alt} width={size} height={size} className="block shrink-0" />
);

export function SummitLogo() {
  return (
    <Image
      src="/brand/summit-logo.svg"
      alt="Summit"
      width={162}
      height={48}
      className="h-8 w-auto shrink-0 object-contain object-left"
      priority
    />
  );
}

export function SummitLogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/summit-mark.svg"
      alt="Summit"
      width={32}
      height={32}
      className={cn("h-8 w-8 shrink-0 object-contain object-center", className)}
      priority
    />
  );
}

export function SidebarSearchIcon() {
  return icon("/sidebar/search-icon.svg", "", 16);
}

export function SidebarAccountAvatar() {
  return (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5e7eb]">
      <span className="text-[9px] font-semibold leading-none text-[#6b7280]">A</span>
    </span>
  );
}
