export const MINI_PLAYER_GEOMETRY_KEY = 'miniPlayerGeometry';
export const DEFAULT_MINI_PLAYER_GEOMETRY = { x: 16, y: 72, width: 360 };
export type MiniPlayerGeometry = typeof DEFAULT_MINI_PLAYER_GEOMETRY;

export function normalizeMiniPlayerGeometry(
  value: unknown
): MiniPlayerGeometry {
  const geometry = value as Partial<MiniPlayerGeometry> | null;
  return geometry &&
    [geometry.x, geometry.y, geometry.width].every(
      (item) => typeof item === 'number' && Number.isFinite(item)
    ) &&
    typeof geometry.width === 'number' &&
    geometry.width > 0
    ? {
        x: geometry.x as number,
        y: geometry.y as number,
        width: geometry.width,
      }
    : { ...DEFAULT_MINI_PLAYER_GEOMETRY };
}
