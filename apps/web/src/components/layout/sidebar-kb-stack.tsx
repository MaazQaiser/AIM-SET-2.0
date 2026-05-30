/** Figma node 152:1176 — Knowledge Base document stack (vector) */

function SlideCardShadow() {
  return (
    <filter id="kbSlideShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="3.17" stdDeviation="1.59" floodColor="#000" floodOpacity="0.15" />
    </filter>
  );
}

function AboutSlide() {
  return (
    <g transform="translate(53.5 84) rotate(-8) translate(-51.5 -29)">
      <rect
        width="103"
        height="58"
        rx="2.57"
        fill="#fcfaff"
        filter="url(#kbSlideShadow)"
      />
      <text x="5" y="14" fill="#070707" fillOpacity="0.5" fontSize="10.7" fontWeight="500">
        About
      </text>
      <text x="22" y="30" fill="#070707" fillOpacity="0.35" fontSize="2.5">
        years of experience
      </text>
      <text x="22" y="44" fill="#070707" fillOpacity="0.5" fontSize="16" fontWeight="500">
        9+
      </text>
      <text x="57" y="35" fill="#070707" fillOpacity="0.35" fontSize="2.5">
        People in the team
      </text>
      <text x="57" y="49" fill="#070707" fillOpacity="0.5" fontSize="16" fontWeight="500">
        30+
      </text>
      <rect x="5" y="52" width="28" height="0.8" fill="#070707" fillOpacity="0.15" rx="0.4" />
      <rect x="70" y="52" width="28" height="0.8" fill="#070707" fillOpacity="0.15" rx="0.4" />
    </g>
  );
}

function IntroSlide() {
  return (
    <g transform="translate(70.5 59) rotate(-8) translate(-51.5 -29)">
      <rect
        width="103"
        height="58"
        rx="2.57"
        fill="#fcfaff"
        filter="url(#kbSlideShadow)"
      />
      <text x="5" y="14" fill="#070707" fillOpacity="0.5" fontSize="10.7" fontWeight="500">
        Intro
      </text>
      {[24, 27, 30, 33].map((y) => (
        <rect key={`l-${y}`} x="14" y={y} width="34" height="0.8" fill="#070707" fillOpacity="0.2" rx="0.4" />
      ))}
      {[36, 39, 42].map((y) => (
        <rect key={`r-${y}`} x="59" y={y} width="34" height="0.8" fill="#070707" fillOpacity="0.2" rx="0.4" />
      ))}
      <rect x="5" y="52" width="24" height="0.8" fill="#070707" fillOpacity="0.15" rx="0.4" />
      <rect x="74" y="52" width="24" height="0.8" fill="#070707" fillOpacity="0.15" rx="0.4" />
    </g>
  );
}

function ProjectOverviewSlide() {
  const line = (y: number, w = 66) => (
    <rect key={y} x="5" y={y} width={w} height="0.8" fill="#434343" fillOpacity="0.35" rx="0.4" />
  );

  return (
    <g transform="translate(164 68) rotate(7.2) translate(-43 -62)">
      <rect
        width="86"
        height="124"
        rx="2.57"
        fill="#fcfbff"
        filter="url(#kbSlideShadow)"
      />
      <text x="5" y="12" fill="#070707" fontSize="10.7" fontWeight="500">
        Project Overview
      </text>
      <text x="5" y="18" fill="#0b0c10" fontSize="2.8" fontWeight="600">
        Onboarding
      </text>
      {[22, 25, 28, 31].map((y) => line(y))}
      <text x="5" y="38" fill="#0b0c10" fontSize="2.2" fontWeight="600">
        Platform Overview
      </text>
      {[42, 45, 48].map((y) => line(y, 74))}
      <text x="5" y="56" fill="#0b0c10" fontSize="2.2" fontWeight="600">
        Account Setup
      </text>
      {[60, 63, 66].map((y) => line(y, 74))}
      <text x="5" y="74" fill="#0b0c10" fontSize="2.2" fontWeight="600">
        Your First AI Task
      </text>
      {[78, 81, 84].map((y) => line(y, 74))}
      <text x="5" y="92" fill="#0b0c10" fontSize="2.2" fontWeight="600">
        Project Spaces
      </text>
      {[96, 99].map((y) => line(y, 74))}
      <line x1="5" y1="108" x2="81" y2="108" stroke="#434343" strokeOpacity="0.25" strokeWidth="0.5" />
      <text x="5" y="118" fill="#434343" fontSize="1.4" fontWeight="500">
        © 2025 NeurKit
      </text>
    </g>
  );
}

export function SidebarKbDocumentsStack({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 218 129"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <SlideCardShadow />
      </defs>
      <AboutSlide />
      <IntroSlide />
      <ProjectOverviewSlide />
    </svg>
  );
}
