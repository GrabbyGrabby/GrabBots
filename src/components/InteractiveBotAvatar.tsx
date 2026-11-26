import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  getExample,
  renderAvatarSvg,
  type AvatarDefinition,
  type AvatarMood,
  type AvatarState,
} from "open-bot-avatar";
import { mountAvatar, type MountedAvatar } from "open-bot-avatar/dom";

const GALLERY_DEFINITIONS: Record<string, AvatarDefinition> = {
  bunny: {
    version: 1,
    id: "bunny",
    name: "Bunny",
    body: {
      path: "M50 40C68 40 80 50 80 64C80 78 68 86 50 86C32 86 20 78 20 64C20 50 32 40 50 40ZM30 46C26 36 24 24 26 16C28 10 34 10 37 15C40 22 42 34 42 44ZM58 44C58 34 61 22 66 15C69 10 76 11 76 17C76 25 74 36 70 46Z",
    },
    eyes: { x: 50, y: 62, spacing: 17, scale: 1.15 },
  },
  egg: {
    version: 1,
    id: "egg",
    name: "Egg",
    body: {
      path: "M50 10C66 10 82 34 82 58C82 76 68 88 50 88C32 88 18 76 18 58C18 34 34 10 50 10Z",
    },
    eyes: { x: 50, y: 54, spacing: 17, scale: 1.2 },
  },
  cat: {
    version: 1,
    id: "cat",
    name: "Cat",
    body: {
      path: "M50 23C68 23 82 30 82 45C82 58 68 65 50 65C32 65 18 58 18 45C18 30 32 23 50 23ZM24 42C21 32 20 22 22 15C23 11 26 10 29 12C34 16 39 21 44 28L36 42ZM64 42L56 28C61 21 66 16 71 12C74 10 77 11 78 15C80 22 79 32 76 42ZM38 56L62 56C70 56 74 66 74 76C74 83 70 86 63 86L37 86C30 86 26 83 26 76C26 66 30 56 38 56ZM70 72C77 74 81 70 80 64C79 60 81 57 84 58C87 59 88.5 63 88 68C87 77 80 83 70 81Z",
    },
    eyes: { x: 50, y: 43, spacing: 17, scale: 1.1 },
  },
  bull: {
    version: 1,
    id: "bull",
    name: "Bull",
    body: {
      path: "M40 28L60 28C70 28 76 36 76 48L76 62C76 74 66 84 50 84C34 84 24 74 24 62L24 48C24 36 30 28 40 28ZM32 40C22 38 15 32 15 24C15 18 18 13 22 10C25 8 28 10 27 13C25 18 24 22 28 26C31 29 36 30 42 30ZM58 30C64 30 69 29 72 26C76 22 75 18 73 13C72 10 75 8 78 10C82 13 85 18 85 24C85 32 78 38 68 40ZM29 55C23 56 17 55 12 52C9 50 8 47 10 45C14 41 22 40 28 42ZM72 42C78 40 86 41 90 45C92 47 91 50 88 52C83 55 77 56 71 55Z",
    },
    eyes: { x: 50, y: 52, spacing: 17, scale: 1.15 },
  },
  cow: {
    version: 1,
    id: "cow",
    name: "Cow",
    body: {
      path: "M40 28L60 28C70 28 76 36 76 48L76 62C76 74 66 84 50 84C34 84 24 74 24 62L24 48C24 36 30 28 40 28ZM32 40C22 38 15 32 15 24C15 18 18 13 22 10C25 8 28 10 27 13C25 18 24 22 28 26C31 29 36 30 42 30ZM58 30C64 30 69 29 72 26C76 22 75 18 73 13C72 10 75 8 78 10C82 13 85 18 85 24C85 32 78 38 68 40ZM29 55C23 56 17 55 12 52C9 50 8 47 10 45C14 41 22 40 28 42ZM72 42C78 40 86 41 90 45C92 47 91 50 88 52C83 55 77 56 71 55Z",
    },
    eyes: { x: 50, y: 52, spacing: 17, scale: 1.15 },
  },
};

export const AVATAR_SPECS: Record<string, AvatarDefinition> = {
  ...GALLERY_DEFINITIONS,
  controller: getExample("controller")!,
};

const PALETTE_HEX: Record<string, string> = {
  blue: "#377FE6",
  teal: "#14b3b0",
  purple: "#8057C8",
  coral: "#E5634E",
  green: "#009957",
  orange: "#ff6a1a",
  red: "#D94B52",
  cyan: "#0EA5C6",
  chrome: "#9BA4B0",
  silver: "#A8ADB4",
  pink: "#D84F8B",
  yellow: "#D8A729",
};

function resolveHexColor(color?: string): string {
  if (!color) return "#ff6a1a";
  if (PALETTE_HEX[color]) return PALETTE_HEX[color];
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;
  if (/^[0-9a-f]{6}$/i.test(color)) return `#${color}`;
  return "#377FE6";
}

export function resolveAvatarKind(type?: string, name?: string): AvatarDefinition {
  const rawType = (type ?? "").toLowerCase().trim();
  const rawName = (name ?? "").toLowerCase().trim();

  if (rawType === "controller" || rawType === "bunny" || rawType === "egg" || rawType === "cat" || rawType === "bull" || rawType === "cow") {
    return AVATAR_SPECS[rawType]!;
  }
  const example = rawType ? getExample(rawType) : undefined;
  if (example) return example;

  if (rawName.includes("xerxes")) return AVATAR_SPECS.controller;
  if (rawName.includes("knull")) return AVATAR_SPECS.cat;
  if (rawName.includes("kraken")) return AVATAR_SPECS.egg;
  if (rawName.includes("zeus")) return AVATAR_SPECS.bunny;

  return AVATAR_SPECS.bunny;
}

function mapState(state?: string): { obaState: AvatarState; obaMood: AvatarMood } {
  switch (state) {
    case "thinking":
      return { obaState: "thinking", obaMood: "neutral" };
    case "working":
    case "loading":
    case "writing":
    case "sending":
    case "receiving":
    case "uploading":
    case "spawning":
    case "listening":
      return { obaState: "working", obaMood: "neutral" };
    case "alerting":
    case "suspicious":
    case "angry":
    case "scared":
    case "sad":
      return { obaState: "blocked", obaMood: "neutral" };
    case "done":
    case "celebrate":
    case "proud":
    case "happy":
    case "excited":
      return { obaState: "done", obaMood: "happy" };
    case "searching":
    case "curious":
    case "waiting":
    case "sleeping":
    case "drowsy":
    default:
      return { obaState: "idle", obaMood: "neutral" };
  }
}

export interface InteractiveBotAvatarProps {
  type?: string;
  color?: string;
  size?: number;
  className?: string;
  hoverActive?: boolean;
  name?: string;
  state?: string;
  faceColor?: "white" | "black" | null;
  animated?: boolean;
  trackPointer?: boolean;
}

export function InteractiveBotAvatarComponent({
  type,
  color = "blue",
  size = 40,
  className = "",
  hoverActive = true,
  name,
  state = "idle",
  faceColor,
  animated = true,
  trackPointer = true,
}: InteractiveBotAvatarProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<MountedAvatar | null>(null);
  const [hovered, setHovered] = useState(false);

  const definition = useMemo(() => resolveAvatarKind(type, name), [type, name]);
  const fillColor = useMemo(() => resolveHexColor(color), [color]);
  const eyeColor = faceColor === "white" ? "#ffffff" : "#151515";
  const { obaState, obaMood } = useMemo(() => mapState(state), [state]);

  const isStill = animated === false && !hovered;
  const activeState: AvatarState = hovered && hoverActive ? "done" : isStill ? "idle" : obaState;
  const activeMood: AvatarMood = hovered && hoverActive ? "happy" : obaMood;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const mounted = mountAvatar(el, {
      definition,
      color: fillColor,
      eyeColor,
      depth: 6,
      state: activeState,
      mood: activeMood,
      followPointer: trackPointer !== false,
      still: isStill,
      reducedMotion: isStill ? true : "system",
      label: name ?? definition.name,
    });
    mountedRef.current = mounted;
    return () => {
      mounted.destroy();
      mountedRef.current = null;
    };
  }, []);

  useEffect(() => {
    mountedRef.current?.update({
      definition,
      color: fillColor,
      eyeColor,
      depth: 6,
      state: activeState,
      mood: activeMood,
      followPointer: trackPointer !== false,
      still: isStill,
      reducedMotion: isStill ? true : "system",
      label: name ?? definition.name,
    });
  }, [definition, fillColor, eyeColor, activeState, activeMood, trackPointer, isStill, name]);

  const ssrSvg = useMemo(
    () =>
      renderAvatarSvg(definition, {
        color: fillColor,
        eyeColor,
        depth: 6,
        state: activeState,
        mood: activeMood,
        reducedMotion: true,
        size,
      }),
    [definition, fillColor, eyeColor, activeState, activeMood, size],
  );

  return (
    <div
      ref={hostRef}
      data-open-avatar={definition.id}
      className={`interactive-bot-avatar relative inline-flex shrink-0 select-none items-center justify-center ${className}`}
      style={{ width: size, height: size, aspectRatio: "1 / 1" }}
      onPointerEnter={() => hoverActive && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: ssrSvg }}
    />
  );
}

export const InteractiveBotAvatar = memo(InteractiveBotAvatarComponent);
