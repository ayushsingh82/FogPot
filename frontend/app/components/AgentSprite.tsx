"use client";

// 8x10 pixel sprite: '.' transparent, 'H' outline/helmet, 'S' visor screen, 'A' armor body
const AGENT_SPRITE = [
  "...HH...",
  "..HHHH..",
  ".HSSSSH.",
  ".HSSSSH.",
  "..HHHH..",
  ".AAAAAA.",
  "AAAAAAAA",
  "AAAAAAAA",
  "AA.AA.AA",
  "AA.AA.AA",
];

const AGENT_COLORS: Record<string, string> = {
  ".": "transparent",
  H: "#101c46",
  S: "#ffe066",
  A: "#3ddc84",
};

export default function AgentSprite({
  float = false,
  size = 8,
}: {
  float?: boolean;
  size?: number;
}) {
  return (
    <div className="sprite-wrap">
      <div
        className={`sprite-grid${float ? " float" : ""}`}
        style={{
          gridTemplateColumns: `repeat(8, ${size}px)`,
          gridTemplateRows: `repeat(10, ${size}px)`,
        }}
      >
        {AGENT_SPRITE.flatMap((row, y) =>
          row.split("").map((cell, x) => (
            <div
              key={`${x}-${y}`}
              style={{
                width: size,
                height: size,
                background: AGENT_COLORS[cell],
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
