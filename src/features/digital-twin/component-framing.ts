import { Box3, PerspectiveCamera, Sphere, Vector3 } from "three";

export type ComponentFrame = { direction: Vector3; distance: number; side: "left" | "right" };
export type OverlayRect = { left: number; top: number; right: number; bottom: number };

/** Choose an independently framed three-quarter view and fit the entire named part. */
export function bestComponentFrame(
  bounds: Box3,
  aspect: number,
  viewport: { width: number; height: number },
  overlay: OverlayRect,
): ComponentFrame {
  const sphere = bounds.getBoundingSphere(new Sphere());
  const safeDistance =
    (sphere.radius / Math.sin(Math.PI / 9)) * 1.8 * (aspect < 1 ? 1 / aspect : 1);
  const camera = new PerspectiveCamera(
    40,
    aspect,
    Math.max(sphere.radius / 100, 0.001),
    sphere.radius * 100,
  );
  const corners: Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new Vector3(x, y, z));
  const panel = {
    left: (overlay.left / viewport.width) * 2 - 1,
    right: (overlay.right / viewport.width) * 2 - 1,
    top: 1 - (overlay.top / viewport.height) * 2,
    bottom: 1 - (overlay.bottom / viewport.height) * 2,
  };
  let best: (ComponentFrame & { score: number }) | undefined;
  const center = sphere.center;

  for (const elevation of [22, 42, 62]) {
    for (let azimuth = 0; azimuth < 360; azimuth += 30) {
      const az = (azimuth * Math.PI) / 180;
      const el = (elevation * Math.PI) / 180;
      const direction = new Vector3(
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az),
      );
      camera.position.copy(center).addScaledVector(direction, safeDistance);
      camera.lookAt(center);
      camera.updateMatrixWorld(true);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const corner of corners) {
        const point = corner.clone().project(camera);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
      const width = Math.max(maxX - minX, 0.001);
      const height = Math.max(maxY - minY, 0.001);
      const fit = Math.min(1.05, 1.72 / width, 1.68 / height);
      const overlap = (left: number, right: number) =>
        (Math.max(0, Math.min(maxX, right) - Math.max(minX, left)) *
          Math.max(0, Math.min(maxY, panel.top) - Math.max(minY, panel.bottom))) /
        (width * height);
      const leftPenalty = overlap(-1, panel.right);
      const rightPenalty = overlap(panel.left, 1);
      const side = leftPenalty < rightPenalty ? "left" : "right";
      const panelPenalty = Math.min(leftPenalty, rightPenalty);
      const score = fit * Math.sqrt(width * height) * (1 - 0.9 * panelPenalty);
      if (!best || score > best.score) {
        best = { direction: direction.clone(), distance: (safeDistance / fit) * 1.04, side, score };
      }
    }
  }
  return (
    best ?? {
      direction: new Vector3(0.5, 0.6, 0.6).normalize(),
      distance: safeDistance,
      side: "right",
    }
  );
}
