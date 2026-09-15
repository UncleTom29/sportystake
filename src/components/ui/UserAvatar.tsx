"use client";

import React, { useState } from "react";
import { User } from "lucide-react";

export interface UserAvatarProps {
  avatar?: string | null;
  name?: string | null;
  size?: number | string;
  className?: string;
  alt?: string;
}

export default function UserAvatar({
  avatar,
  name,
  size,
  className = "h-10 w-10 text-sm",
  alt,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const cleanName = (name || "").replace(/^@/, "").trim();
  const initial = cleanName ? cleanName[0].toUpperCase() : null;

  const isImage =
    !imgError &&
    Boolean(
      avatar &&
        (avatar.startsWith("data:image") ||
          avatar.startsWith("http://") ||
          avatar.startsWith("https://") ||
          avatar.startsWith("/"))
    );

  const style = typeof size === "number" ? { width: size, height: size } : undefined;

  if (isImage) {
    return (
      <div
        style={style}
        className={`relative shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-3)] ring-1 ring-white/10 ${className}`}
      >
        <img
          src={avatar!}
          alt={alt || cleanName || "Avatar"}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (avatar && avatar.length <= 4) {
    return (
      <div
        style={style}
        className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-3)] shadow-inner ring-1 ring-white/10 ${className}`}
      >
        <span>{avatar}</span>
      </div>
    );
  }

  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-500)]/20 font-black text-[var(--color-brand-400)] shadow-inner ring-1 ring-[var(--color-brand-500)]/30 ${className}`}
    >
      {initial ? initial : <User className="h-1/2 w-1/2 opacity-70" />}
    </div>
  );
}
