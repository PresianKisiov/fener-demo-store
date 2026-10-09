/**
 * Line drawings of the demo products. The demo has no product photos, so each
 * product points to one of these by its `illustration` field.
 */
type Kind = "clip" | "booklight" | "neck" | "desk" | "minidesk" | "bedside" | "strip" | "floor";

const LIGHT = "rgb(255 210 122 / 0.75)";

function Drawing({ kind }: { kind: Kind }) {
  switch (kind) {
    case "clip":
      return (
        <>
          <path d="M104 70 L150 70 L176 162 L58 162 Z" fill={LIGHT} stroke="none" />
          <path d="M70 176 h56 M70 176 v-16 h56 v16" />
          <path d="M98 160 C 96 120, 66 104, 92 64" />
          <rect x="84" y="50" width="70" height="20" rx="10" transform="rotate(8 119 60)" />
        </>
      );
    case "booklight":
      return (
        <>
          <path d="M72 96 L128 96 L158 150 L42 150 Z" fill={LIGHT} stroke="none" />
          <path d="M34 150 Q 67 138 100 152 Q 133 138 166 150 L166 172 Q 133 160 100 174 Q 67 160 34 172 Z" />
          <path d="M100 152 V 174" />
          <path d="M100 150 V 100" />
          <rect x="66" y="84" width="68" height="13" rx="6.5" />
        </>
      );
    case "neck":
      return (
        <>
          <path d="M52 108 L74 108 L88 168 L28 168 Z" fill={LIGHT} stroke="none" />
          <path d="M126 108 L148 108 L172 168 L112 168 Z" fill={LIGHT} stroke="none" />
          <path d="M62 102 C 52 40, 148 40, 138 102" />
          <path d="M70 58 C 84 76, 116 76, 130 58" opacity="0.45" />
          <circle cx="62" cy="104" r="11" />
          <circle cx="138" cy="104" r="11" />
        </>
      );
    case "desk":
      return (
        <>
          <path d="M132 76 L158 92 L176 168 L96 168 Z" fill={LIGHT} stroke="none" />
          <ellipse cx="70" cy="172" rx="38" ry="8" />
          <path d="M70 164 L52 108 L118 62" />
          <circle cx="52" cy="108" r="6" />
          <circle cx="118" cy="62" r="6" />
          <path d="M118 62 L152 74 L142 98 L120 84 Z" />
        </>
      );
    case "minidesk":
      return (
        <>
          <path d="M62 66 L148 66 L170 166 L40 166 Z" fill={LIGHT} stroke="none" />
          <rect x="48" y="166" width="104" height="10" rx="5" />
          <path d="M150 166 V 58" />
          <rect x="54" y="52" width="104" height="14" rx="7" />
        </>
      );
    case "bedside":
      return (
        <>
          <circle cx="100" cy="100" r="62" fill={LIGHT} stroke="none" opacity="0.55" />
          <path d="M72 58 H128 L146 112 H54 Z" fill="rgb(255 210 122 / 0.9)" />
          <path d="M100 112 V 160" />
          <path d="M70 172 Q 100 156 130 172 Z" />
        </>
      );
    case "strip":
      return (
        <>
          <path d="M38 82 L162 82 L184 168 L16 168 Z" fill={LIGHT} stroke="none" />
          <rect x="24" y="58" width="152" height="18" rx="3" />
          <path d="M38 82 H162" strokeDasharray="2 10" strokeWidth="7" />
        </>
      );
    case "floor":
      return (
        <>
          <path d="M126 64 L150 64 L174 136 L102 136 Z" fill={LIGHT} stroke="none" />
          <ellipse cx="70" cy="176" rx="30" ry="6" />
          <path d="M70 170 V 46 Q 70 30 96 30 Q 136 30 138 56" />
          <path d="M122 52 H154 L150 66 H126 Z" />
        </>
      );
  }
}

export function LampArt({ kind, className, title }: { kind: string; className?: string; title?: string }) {
  const known: Kind[] = ["clip", "booklight", "neck", "desk", "minidesk", "bedside", "strip", "floor"];
  const safe = (known.includes(kind as Kind) ? kind : "clip") as Kind;
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      stroke="var(--color-night)"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Drawing kind={safe} />
    </svg>
  );
}
