export type BlockingState = "normal" | "warning" | "blocked";

export function getBlockingState(date: Date, liberadoListaPositiva: boolean): BlockingState {
  if (liberadoListaPositiva) {
    return "normal";
  }

  const currentDay = date.getDate();

  if (currentDay >= 4) {
    return "blocked";
  }

  if (currentDay >= 1 && currentDay <= 3) {
    return "warning";
  }

  return "normal";
}

export function shouldBlockRedirect(date: Date, liberadoListaPositiva: boolean): boolean {
  return getBlockingState(date, liberadoListaPositiva) === "blocked";
}
