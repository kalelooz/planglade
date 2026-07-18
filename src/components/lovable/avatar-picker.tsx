"use client";
import { useMemo, useState } from "react";
import BoringAvatar from "boring-avatars";
import { Shuffle, ArrowCounterClockwise as RotateCcw } from "@phosphor-icons/react";
import { useStore } from "@/lib/store";
import type { BoringAvatarVariant } from "@/lib/mock-data";

const VARIANTS: BoringAvatarVariant[] = ["marble", "beam", "pixel", "sunset", "ring", "bauhaus"];

// 15 curated palettes. Each Boring Avatar takes 5 colors.
const PALETTES: string[][] = [
  ["#92A1C6", "#146A7C", "#F0AB3D", "#C271B4", "#C20D90"], // Sand
  ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51"], // Forest
  ["#0A2463", "#3E92CC", "#D8E1FF", "#FFFAFF", "#247BA0"], // Ocean
  ["#F8B195", "#F67280", "#C06C84", "#6C5B7B", "#355C7D"], // Sunset
  ["#222831", "#393E46", "#6D7785", "#A6B0BF", "#EEEEEE"], // Mono
  ["#A8E6CF", "#DCEDC1", "#FFD3B6", "#FFAAA5", "#FF8B94"], // Spring
  ["#FFB997", "#F67E7D", "#843B62", "#0B032D", "#74546A"], // Berry
  ["#06D6A0", "#118AB2", "#073B4C", "#FFD166", "#EF476F"], // Pop
  ["#003049", "#D62828", "#F77F00", "#FCBF49", "#EAE2B7"], // Heat
  ["#1B263B", "#415A77", "#778DA9", "#E0E1DD", "#0D1B2A"], // Slate
  ["#FFE066", "#F25F5C", "#247BA0", "#70C1B3", "#50514F"], // Retro
  ["#5F0F40", "#9A031E", "#FB8B24", "#E36414", "#0F4C5C"], // Spice
  ["#FFCDB2", "#FFB4A2", "#E5989B", "#B5838D", "#6D6875"], // Rose
  ["#03071E", "#370617", "#6A040F", "#9D0208", "#D00000"], // Ember
  ["#CAD2C5", "#84A98C", "#52796F", "#354F52", "#2F3E46"], // Sage
];

const SEED_POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomSeed(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += SEED_POOL[Math.floor(Math.random() * SEED_POOL.length)];
  return s;
}

type AvatarTile = {
  variant: BoringAvatarVariant;
  colors: string[];
  seed: string;
};

function generateGallery(count: number): AvatarTile[] {
  const tiles: AvatarTile[] = [];
  for (let i = 0; i < count; i++) {
    tiles.push({
      variant: VARIANTS[i % VARIANTS.length],
      colors: PALETTES[Math.floor(Math.random() * PALETTES.length)],
      seed: randomSeed(),
    });
  }
  // Shuffle so variants aren't in order
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export function AvatarPicker({ memberId }: { memberId: string }) {
  const member = useStore((s) => s.members.find((m) => m.id === memberId));
  const updateMember = useStore((s) => s.updateMember);
  const [gallery, setGallery] = useState<AvatarTile[]>(() => generateGallery(40));

  if (!member) return null;

  const current = member.avatar;
  const previewName = current?.seed ?? member.name;
  const previewVariant = current?.variant ?? "marble";
  const previewColors = current?.colors ?? PALETTES[0];

  const apply = (tile: AvatarTile) => {
    updateMember(memberId, { avatar: { variant: tile.variant, colors: tile.colors, seed: tile.seed } });
  };

  const revert = () => updateMember(memberId, { avatar: undefined });
  const shuffle = () => setGallery(generateGallery(40));

  const isSelected = (tile: AvatarTile) =>
    current?.variant === tile.variant &&
    current?.seed === tile.seed &&
    JSON.stringify(current?.colors) === JSON.stringify(tile.colors);

  return (
    <div className="space-y-4">
      {/* Live preview */}
      <div className="flex items-center gap-4 rounded-md border bg-card px-4 py-3">
        <BoringAvatar size={56} name={previewName} variant={previewVariant} colors={previewColors} />
        <BoringAvatar size={32} name={previewName} variant={previewVariant} colors={previewColors} />
        <BoringAvatar size={20} name={previewName} variant={previewVariant} colors={previewColors} />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={shuffle}
            title="Generate a new set of options"
            className="lov-btn"
          >
            <Shuffle className="h-3 w-3" /> Shuffle
          </button>
          <button
            onClick={revert}
            title="Revert to initials"
            className="lov-btn lov-btn-ghost"
          >
            <RotateCcw className="h-3 w-3" /> Use initials
          </button>
        </div>
      </div>

      {/* Gallery — 40 pre-generated options */}
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Pick a look · {gallery.length} options
        </div>
        <div className="grid grid-cols-10 gap-2">
          {gallery.map((tile, i) => (
            <button
              key={`${tile.variant}-${tile.seed}-${i}`}
              onClick={() => apply(tile)}
              title={tile.variant}
              className={`flex aspect-square items-center justify-center rounded-md border p-1 transition-transform hover:scale-110 ${
                isSelected(tile) ? "border-primary ring-2 ring-primary" : "border-border hover:border-ring"
              }`}
            >
              <BoringAvatar size={36} name={tile.seed} variant={tile.variant} colors={tile.colors} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Keep the type-augmented store import compatible — `seed` is new.
export type { BoringAvatarVariant };
