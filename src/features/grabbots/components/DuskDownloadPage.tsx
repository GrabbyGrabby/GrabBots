import { useEffect, useState } from "react";
import { InteractiveBotAvatar } from "@/components/InteractiveBotAvatar";

interface DownloadPlatform {
  available: boolean;
  artifacts?: Array<{ fileName: string; relativePath: string }>;
}

interface DownloadsPayload {
  version: string;
  platforms?: {
    windows?: DownloadPlatform;
    linux?: DownloadPlatform;
    android?: DownloadPlatform;
  };
}

const SQUAD_BOTS = [
  { id: "zeus", name: "zeus", role: "chief of staff", type: "bunny" as const, color: "#377FE6" },
  { id: "kraken", name: "kraken", role: "web & research", type: "egg" as const, color: "#0EA5C6" },
  { id: "knull", name: "knull", role: "systems & code", type: "cat" as const, color: "#ff6a1a" },
  { id: "xerxes", name: "xerxes", role: "operations", type: "controller" as const, color: "#14b3b0" },
];

export function DuskDownloadPage() {
  const [data, setData] = useState<DownloadsPayload | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/grabbots/downloads")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: DownloadsPayload | null) => {
        if (active && payload) setData(payload);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const version = data?.version ?? "0.1.177";

  return (
    <div className="h-screen overflow-y-auto bg-white text-[#131316]" style={{ fontFamily: '"Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-6 py-[18px]">
        <a href="/" className="inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-[#131316] no-underline">
          <img src="/app-icon.svg" alt="" width={28} height={28} className="size-7 rounded-[7px]" />
          <span>GrabBots</span>
        </a>
        <nav className="flex items-center gap-1">
          <a href="/download" aria-current="page" className="rounded-full bg-[#f5f5f3] px-3 py-2 text-[15px] font-medium text-[#131316] no-underline">
            download
          </a>
          <a href="/" className="rounded-full px-3 py-2 text-[15px] font-medium text-[#131316] no-underline hover:bg-[#f5f5f3]">
            workspace
          </a>
          <a href="/pair" className="ml-2 rounded-full bg-[#131316] px-4 py-2 text-[15px] font-medium text-white no-underline hover:bg-[#2a2a30]">
            sign in
          </a>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1208px] px-6 pb-20 pt-10">
        <section className="max-w-2xl">
          <h1 className="text-[clamp(44px,7vw,86px)] font-medium leading-[0.96] tracking-[-0.055em] text-[#131316]">
            Download
            <br />
            GrabBots
          </h1>
          <p className="mt-5 max-w-[34em] text-[clamp(17px,1.5vw,20px)] leading-[1.5] tracking-[-0.012em] text-[#4b4b55]">
            Open it, sign in to the AI you already use or start on the free models, and your first bot is working a couple of minutes later. Free for personal use, no account needed.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            {data?.platforms?.windows?.available && data.platforms.windows.artifacts?.[0] ? (
              <a
                href={`/api/grabbots/downloads/file/${encodeURIComponent(data.platforms.windows.artifacts[0].fileName)}`}
                download={data.platforms.windows.artifacts[0].fileName}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#131316] px-6 text-[16px] font-medium text-white no-underline hover:bg-[#2a2a30]"
              >
                Download for Windows
              </a>
            ) : (
              <a
                href="#all"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#131316] px-6 text-[16px] font-medium text-white no-underline hover:bg-[#2a2a30]"
              >
                Download for Windows
              </a>
            )}
            <a
              href="#all"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#efefed] px-6 text-[16px] font-medium text-[#131316] no-underline hover:bg-[#e4e4e1]"
            >
              All downloads
            </a>
          </div>
          <p className="mt-3 text-[13px] font-medium text-[#55555f]">
            Windows 10 and 11 · Linux · Android APK · Version {version}
          </p>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="grabbots squad">
          {SQUAD_BOTS.map((bot) => (
            <a
              key={bot.id}
              href="/"
              onMouseEnter={() => setHovered(bot.id)}
              onMouseLeave={() => setHovered((prev) => (prev === bot.id ? null : prev))}
              className="flex items-center gap-3.5 rounded-[20px] bg-[#f5f5f3] p-4 text-[#131316] no-underline transition-colors hover:bg-[#ecece8]"
            >
              <InteractiveBotAvatar
                type={bot.type}
                color={bot.color}
                name={bot.name}
                size={46}
                hoverActive
                state={hovered === bot.id ? "celebrate" : "idle"}
              />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold lowercase text-[#131316]">{bot.name}</div>
                <div className="text-[13px] lowercase text-[#55555f]">{bot.role}</div>
              </div>
            </a>
          ))}
        </section>

        <section id="all" className="mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-[clamp(28px,3.4vw,42px)] font-medium lowercase leading-[1.05] tracking-[-0.04em] text-[#131316]">
              all downloads.
            </h2>
            <p className="text-[14px] lowercase text-[#55555f]">version {version}</p>
          </div>

          <ul className="mt-6 divide-y divide-[#e9e9e6] border-y border-[#e9e9e6] p-0">
            <li className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <b className="text-[16px] font-medium text-[#131316]">Windows</b>
                <span className="ml-2 text-[14px] text-[#55555f]">x64 · Installer .exe</span>
              </div>
              {data?.platforms?.windows?.available && data.platforms.windows.artifacts?.[0] ? (
                <a
                  href={`/api/grabbots/downloads/file/${encodeURIComponent(data.platforms.windows.artifacts[0].fileName)}`}
                  download={data.platforms.windows.artifacts[0].fileName}
                  className="inline-flex min-h-[40px] items-center rounded-full bg-[#131316] px-5 text-[14px] font-medium text-white no-underline hover:bg-[#2a2a30]"
                >
                  Download
                </a>
              ) : (
                <span className="inline-flex min-h-[40px] items-center rounded-full bg-[#efefed] px-5 text-[14px] font-medium text-[#55555f]">
                  Not packaged yet
                </span>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <b className="text-[16px] font-medium text-[#131316]">Linux</b>
                <span className="ml-2 text-[14px] text-[#55555f]">x64 · .deb &amp; .AppImage</span>
              </div>
              {data?.platforms?.linux?.available && data.platforms.linux.artifacts?.[0] ? (
                <a
                  href={`/api/grabbots/downloads/file/${encodeURIComponent(data.platforms.linux.artifacts[0].fileName)}`}
                  download={data.platforms.linux.artifacts[0].fileName}
                  className="inline-flex min-h-[40px] items-center rounded-full bg-[#131316] px-5 text-[14px] font-medium text-white no-underline hover:bg-[#2a2a30]"
                >
                  Download
                </a>
              ) : (
                <span className="inline-flex min-h-[40px] items-center rounded-full bg-[#efefed] px-5 text-[14px] font-medium text-[#55555f]">
                  Not packaged yet
                </span>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <b className="text-[16px] font-medium text-[#131316]">Android</b>
                <span className="ml-2 text-[14px] text-[#55555f]">Phone app · .apk</span>
              </div>
              {data?.platforms?.android?.available && data.platforms.android.artifacts?.[0] ? (
                <a
                  href={`/api/grabbots/downloads/file/${encodeURIComponent(data.platforms.android.artifacts[0].fileName)}`}
                  download={data.platforms.android.artifacts[0].fileName}
                  className="inline-flex min-h-[40px] items-center rounded-full bg-[#131316] px-5 text-[14px] font-medium text-white no-underline hover:bg-[#2a2a30]"
                >
                  Download
                </a>
              ) : (
                <span className="inline-flex min-h-[40px] items-center rounded-full bg-[#efefed] px-5 text-[14px] font-medium text-[#55555f]">
                  Not packaged yet
                </span>
              )}
            </li>
          </ul>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-4 border-t border-[#e9e9e6] px-6 py-8 text-[14px] lowercase text-[#55555f]">
        <div className="flex items-center gap-2 font-medium text-[#131316]">
          <img src="/app-icon.svg" alt="" width={20} height={20} className="size-5 rounded-[5px]" />
          <span>grabbots</span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <a href="/" className="text-[#44444d] no-underline hover:text-[#131316]">workspace</a>
          <a href="/download" className="text-[#44444d] no-underline hover:text-[#131316]">downloads</a>
          <a href="/pair" className="text-[#44444d] no-underline hover:text-[#131316]">sign in</a>
        </div>
      </footer>
    </div>
  );
}
