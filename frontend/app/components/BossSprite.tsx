"use client";

// 10x8 pixel sprite: '.' transparent, 'D' outline, 'B' body, 'E' eye white, 'P' pupil
const BOSS_SPRITE = [
  ".DDDDDDDD.",
  "DBBBBBBBBD",
  "DBBEBBEBBD",
  "DBBPBBPBBD",
  "DBBBBBBBBD",
  "DBBBBBBBBD",
  "DBBBBBBBBD",
  ".D.D.D.D.D",
];

const SPRITE_COLORS: Record<string, string> = {
  ".": "transparent",
  D: "#1d2b53",
  B: "#29adff",
  E: "#fff1e8",
  P: "#080c1f",
};

export default function BossSprite({
  shaking = false,
  float = false,
  size = 8,
}: {
  shaking?: boolean;
  float?: boolean;
  size?: number;
}) {
  return (
    <div className="sprite-wrap">
      <div
        className={`sprite-grid${shaking ? " shake" : ""}${float ? " float" : ""}`}
        style={{
          gridTemplateColumns: `repeat(10, ${size}px)`,
          gridTemplateRows: `repeat(8, ${size}px)`,
        }}
      >
        {BOSS_SPRITE.flatMap((row, y) =>
          row.split("").map((cell, x) => (
            <div
              key={`${x}-${y}`}
              style={{
                width: size,
                height: size,
                background: SPRITE_COLORS[cell],
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
