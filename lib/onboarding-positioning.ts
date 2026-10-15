export const TOUR_VIEWPORT_MARGIN = 16
export const TOUR_TARGET_MARGIN = 8

export interface ViewportSize {
  width: number
  height: number
}

export interface RectBounds {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

export function isRectInsideViewport(
  rect: RectBounds,
  viewport: ViewportSize,
  margin = TOUR_TARGET_MARGIN
): boolean {
  return rect.width > 0
    && rect.height > 0
    && rect.top >= margin
    && rect.left >= margin
    && rect.right <= viewport.width - margin
    && rect.bottom <= viewport.height - margin
}

function viewportSize(): ViewportSize {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }
}

function nextLayoutFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export async function ensureTargetSafelyPositioned(target: HTMLElement): Promise<void> {
  if (isRectInsideViewport(target.getBoundingClientRect(), viewportSize())) return

  target.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" })
  await nextLayoutFrame()

  if (!isRectInsideViewport(target.getBoundingClientRect(), viewportSize())) {
    throw new Error("Tour target could not be positioned safely inside the viewport")
  }
}
