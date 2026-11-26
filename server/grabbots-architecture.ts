import { arch, cpus, release } from "node:os";

import { detectBox, type BoxDetection } from "./bot-box/detect.ts";
import { containerComputerStatus, SHARED_LOCAL_VM_TARGET, type ContainerComputerStatus } from "./container-computer.ts";
import type { Coordinator } from "./coordinator.ts";
import type { DesktopComputer } from "./desktop-computer.ts";
import type { Store } from "./store.ts";

export interface GrabBotsOsPlane {
  platform: NodeJS.Platform;
  arch: string;
  release: string;
  cpuCount: number;
  nodeVersion: string;
  hostControlDriver: string;
  cuaGranted: boolean;
  cuaUnavailableReason: string | null;
  isolationPlane: string;
  sandboxBox: BoxDetection;
  recommendedVmBackend: string;
}

export interface GrabBotsArchitectureSnapshot {
  product: "GrabBots";
  collectedAt: number;
  os: GrabBotsOsPlane;
  localVm: Pick<
    ContainerComputerStatus,
    | "runtime"
    | "available"
    | "daemonUp"
    | "container"
    | "image"
    | "desktopReady"
    | "security"
    | "network"
    | "persistence"
    | "viewer_url"
    | "problem"
  >;
  acpDag: {
    activeNodes: number;
    liveEdges: number;
    edges: ReturnType<Coordinator["liveEdges"]>;
  };
  squad: Array<{
    id: string;
    name: string;
    title: string;
    color: string;
    mascotBody: string;
    chiefOfStaff: boolean;
    busy: boolean;
  }>;
  engines: Array<{
    instanceId: string;
    driverKind: string;
    connected: boolean;
  }>;
}

function osStrategySummary(platform: NodeJS.Platform): {
  hostControlDriver: string;
  isolationPlane: string;
  recommendedVmBackend: string;
} {
  if (platform === "win32") {
    return {
      hostControlDriver: "DXGI Desktop Duplication + Win32 SendInput / UIAutomation + @trycua/cua-driver",
      isolationPlane: "Win32 Job Objects + AppContainer boundaries + WSL2/Podman Linux XFCE Sandbox",
      recommendedVmBackend: "podman",
    };
  }
  if (platform === "linux") {
    return {
      hostControlDriver: "PipeWire ScreenCast + libei / X11 XTest + @trycua/cua-driver",
      isolationPlane: "Bubblewrap (bwrap) unprivileged userns + seccomp-bpf + credential broker",
      recommendedVmBackend: "docker-or-podman",
    };
  }
  return {
    hostControlDriver: "ScreenCaptureKit + CGEvent + @trycua/cua-driver",
    isolationPlane: "Hardened OCI XFCE Container + Loopback noVNC",
    recommendedVmBackend: "container",
  };
}

export async function collectGrabBotsArchitecture(deps: {
  store: Pick<Store, "bots">;
  coordinator: Pick<Coordinator, "active" | "liveEdges">;
  desktopComputer: Pick<DesktopComputer, "granted" | "unavailableReason">;
  instances: () => Array<{ instanceId: string; driverKind: string }>;
  snapshot: (instanceId: string) => unknown;
  boxProbe?: () => BoxDetection;
  probeVm?: () => Promise<ContainerComputerStatus>;
  platform?: NodeJS.Platform;
}): Promise<GrabBotsArchitectureSnapshot> {
  const platform = deps.platform ?? process.platform;
  const strategy = osStrategySummary(platform);
  const sandboxBox = deps.boxProbe ? deps.boxProbe() : detectBox({ env: process.env, platform });

  let vm: ContainerComputerStatus;
  if (deps.probeVm) {
    vm = await deps.probeVm();
  } else {
    try {
      vm = await containerComputerStatus(undefined, platform, SHARED_LOCAL_VM_TARGET);
    } catch (error) {
      vm = {
        platform,
        runtime: null,
        available: [],
        daemonUp: false,
        image: false,
        imageMatches: false,
        managed: false,
        container: "missing",
        network: "unknown",
        security: "unknown",
        persistence: "unknown",
        desktopReady: false,
        desktop_error: null,
        resumable: false,
        create_supported: true,
        ready: false,
        problem: error instanceof Error ? error.message : String(error),
        image_ref: "",
        image_id: null,
        base_image_ref: "",
        driver_version: "",
        container_name: "",
        target_key: SHARED_LOCAL_VM_TARGET.key,
        workspace_path: SHARED_LOCAL_VM_TARGET.workspaceDir,
        workspace_guest_path: "",
        viewer_port: SHARED_LOCAL_VM_TARGET.viewerPort,
        viewer_url: "",
      };
    }
  }

  const active = deps.coordinator.active();
  const edges = deps.coordinator.liveEdges();

  return {
    product: "GrabBots",
    collectedAt: Date.now(),
    os: {
      platform,
      arch: arch(),
      release: release(),
      cpuCount: cpus().length,
      nodeVersion: process.version,
      hostControlDriver: strategy.hostControlDriver,
      cuaGranted: deps.desktopComputer.granted(),
      cuaUnavailableReason: deps.desktopComputer.unavailableReason(),
      isolationPlane: strategy.isolationPlane,
      sandboxBox,
      recommendedVmBackend: strategy.recommendedVmBackend,
    },
    localVm: {
      runtime: vm.runtime,
      available: vm.available,
      daemonUp: vm.daemonUp,
      container: vm.container,
      image: vm.image,
      desktopReady: vm.desktopReady,
      security: vm.security,
      network: vm.network,
      persistence: vm.persistence,
      viewer_url: vm.viewer_url,
      problem: vm.problem,
    },
    acpDag: {
      activeNodes: active.length,
      liveEdges: edges.length,
      edges,
    },
    squad: deps.store.bots
      .filter((b) => !b.hidden)
      .map((b) => ({
        id: b.id,
        name: b.name,
        title: b.title || "Specialist Bot",
        color: b.color,
        mascotBody: b.mascotBody ?? "cat",
        chiefOfStaff: Boolean(b.chiefOfStaff),
        busy: Boolean(b.busy),
      })),
    engines: deps.instances().map((inst) => ({
      instanceId: inst.instanceId,
      driverKind: inst.driverKind,
      connected: Boolean(deps.snapshot(inst.instanceId)),
    })),
  };
}
