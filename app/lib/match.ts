// app/lib/match.ts
export function resultColor(result?: string) {
  if (result === "W") return "#10B981";
  if (result === "L") return "#EF4444";
  return "#F59E0B"; // T / inconnue
}
export function resultLabel(result?: string) {
  if (result === "W") return "VICTOIRE";
  if (result === "L") return "DÉFAITE";
  return "NUL";
}
