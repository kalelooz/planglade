"use client";
import {
  Cube as Box, Folder, FolderOpen, Briefcase, Code as Code2, Layout, Palette,
  DeviceMobile as Smartphone, Globe, Database, Database as Server, Rocket, Target, Star, Heart,
  Lightning as Zap, Sparkle as Sparkles, Package, Bag as ShoppingBag, Lightbulb, Megaphone, Camera,
  MusicNote as Music, FilmStrip as Film, Book, BookOpen, GraduationCap, Flask as FlaskConical, Wrench,
  Hammer, Compass, MapTrifold as Map, Airplane as Plane, Car, Coffee, Cpu, Cloud, Lock,
  Stack as Layers, type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

// Curated icon set for projects — keep it tight on purpose so the picker stays scannable.
export const PROJECT_ICONS: Record<string, PhosphorIcon> = {
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
            />
          </button>
        );
      })}
    </div>
  );
}
