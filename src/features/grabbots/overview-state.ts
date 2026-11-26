export function initialOverviewView(): "chat" | "overview" {
  if (typeof window === "undefined" || !window.location) return "chat";
  const view = new URLSearchParams(window.location.search ?? "").get("view");
  if (view === "overview") return "overview";
  return "chat";
}

export function noteEnteredChat(actionType: string): void {
  if (actionType !== "showChat" && actionType !== "select" && actionType !== "newTask" && actionType !== "switchTask") {
    return;
  }
  try {
    sessionStorage.setItem("grabbots-entered-chat", "1");
  } catch {
  }
}
