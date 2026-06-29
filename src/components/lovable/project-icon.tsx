"use client";
import {
  Box, Folder, FolderOpen, Briefcase, Code2, Layout, Palette,
  Smartphone, Globe, Database, Server, Rocket, Target, Star, Heart,
  Zap, Sparkles, Package, ShoppingBag, Lightbulb, Megaphone, Camera,
  Music, Film, Book, BookOpen, GraduationCap, FlaskConical, Wrench,
  Hammer, Compass, Map, Plane, Car, Coffee, Cpu, Cloud, Lock,
  Layers, type LucideIcon,
} from "lucide-react";

// Curated icon set for projects — keep it tight on purpose so the picker stays scannable.
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  Folder, FolderOpen, Box, Package, Briefcase, Layers,
  Code2, Database, Server, Cpu, Cloud, Lock,
  Layout, Palette, Smartphone, Globe,
  Rocket, Target, Star, Heart, Zap, Sparkles,
  ShoppingBag, Lightbulb, Megaphone,
  Camera, Music, Film,
  Book, BookOpen, GraduationCap, FlaskConical,
  Wrench, Hammer, Compass, Map, Plane, Car, Coffee,
};

export const PROJECT_ICON_NAMES = Object.keys(PROJECT_ICONS);

export function ProjectIcon({
  name,
  accent,
  size = 14,
  className = "",
}: {
  name?: string;
  accent?: string;
  size?: number;
  className?: string;
}) {
  const Icon = (name && PROJECT_ICONS[name]) || Folder;
  return (
    <Icon
      className={`shrink-0 ${className}`}
      style={{ color: accent, width: size, height: size }}
      strokeWidth={2}
    />
  );
}

export function IconPicker({
  value,
  accent,
  onChange,
}: {
  value: string;
  accent?: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1 rounded-md border bg-card p-2 max-h-48 overflow-y-auto">
      {PROJECT_ICON_NAMES.map((name) => {
        const Icon = PROJECT_ICONS[name];
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            title={name}
            className={`lov-icon-btn h-8 w-8 ${selected ? "lov-btn-active" : ""}`}
          >
            <Icon
              className="h-3.5 w-3.5"
              style={{ color: selected ? accent : undefined }}
              strokeWidth={2}
            />
          </button>
        );
      })}
    </div>
  );
}
