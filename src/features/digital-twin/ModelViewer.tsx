import { useEffect, useRef, useState } from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Maximize2,
  MousePointer2,
  RotateCcw,
  Rotate3D,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  componentFromObject,
  inspectSceneNames,
  isSensor,
  parts,
  sensors,
  type ComponentId,
} from "./model";
import { loadModelBytes } from "./model-loader";

export type SceneReport = ReturnType<typeof inspectSceneNames>;
type Controls = {
  reset: () => void;
  rotate: (enabled: boolean) => void;
  highlight: (id: ComponentId | null) => void;
  zoom: (factor: number) => void;
  move: (azimuth: number, polar: number) => void;
};
type Props = {
  selected: ComponentId;
  onSelect: (id: ComponentId) => void;
  onInspect: (report: SceneReport | null) => void;
};
export default function ModelViewer({ selected, onSelect, onInspect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<Controls | undefined>(undefined);
  const callbacks = useRef({ selected, onSelect, onInspect });
  callbacks.current = { selected, onSelect, onInspect };
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [hovered, setHovered] = useState<ComponentId | null>(null);
  const [reference, setReference] = useState<"exterior" | "basin">("exterior");

  useEffect(() => {
    actions.current?.highlight(selected);
  }, [selected]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const controller = new AbortController();
    setStatus("loading");
    setRotating(false);
    setHovered(null);
    callbacks.current.onInspect(null);
    const initialize = async () => {
      const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }, bytes] =
        await Promise.all([
          import("three"),
          import("three/addons/loaders/GLTFLoader.js"),
          import("three/addons/controls/OrbitControls.js"),
          import("three/addons/environments/RoomEnvironment.js"),
          loadModelBytes("/models/dessalinizador-solar-r33.glb", controller.signal),
        ]);
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        });
      } catch {
        throw new Error(
          "WebGL não está disponível neste navegador. Consulte a referência e os sensores pelo menu.",
        );
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      container.appendChild(renderer.domElement);
      renderer.domElement.setAttribute(
        "aria-label",
        "Modelo 3D do dessalinizador. Use o menu de sensores e os controles de câmera para navegação por teclado.",
      );
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#141b24");
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const environment = pmrem.fromScene(room, 0.04);
      room.dispose();
      pmrem.dispose();
      scene.environment = environment.texture;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x50647c, 1));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
      keyLight.position.set(4, 7, 4);
      scene.add(keyLight);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.2;
      orbit.enablePan = false;
      orbit.maxPolarAngle = Math.PI * 0.94;
      orbit.autoRotateSpeed = 0.6;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const motionChanged = () => {
        if (reducedMotion.matches) {
          orbit.autoRotate = false;
          setRotating(false);
        }
      };
      reducedMotion.addEventListener("change", motionChanged);
      let model: InstanceType<typeof THREE.Group> | undefined = undefined;
      let frame = 0;
      let needsRender = true;
      const requestRender = () => {
        needsRender = true;
      };
      orbit.addEventListener("change", requestRender);
      let highlighted: {
        mesh: InstanceType<typeof THREE.Mesh>;
        original: InstanceType<typeof THREE.Material> | InstanceType<typeof THREE.Material>[];
        temporary: InstanceType<typeof THREE.Material>[];
      }[] = [];
      const restoreMaterials = () => {
        for (const item of highlighted) {
          item.mesh.material = item.original;
          item.temporary.forEach((material) => material.dispose());
        }
        highlighted = [];
      };
      const highlight = (id: ComponentId | null) => {
        needsRender = true;
        restoreMaterials();
        model?.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || componentFromObject(object) !== id) return;
          const original = object.material;
          const temporary = (Array.isArray(original) ? original : [original]).map((material) => {
            const copy = material.clone();
            if (copy instanceof THREE.MeshStandardMaterial) {
              copy.emissive.set("#23b8db");
              copy.emissiveIntensity = 0.3;
            } else if (copy instanceof THREE.MeshBasicMaterial)
              copy.color.lerp(new THREE.Color("#23b8db"), 0.3);
            return copy;
          });
          highlighted.push({ mesh: object, original, temporary });
          object.material = Array.isArray(original) ? temporary : temporary[0]!;
        });
      };
      const resize = () => {
        needsRender = true;
        const width = container.clientWidth,
          height = container.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let down = { x: 0, y: 0 };
      const findHit = (event: PointerEvent): ComponentId | null => {
        if (!model) return null;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const candidates = raycaster
          .intersectObject(model, true)
          .filter((hit) => hit.object.visible)
          .map((hit) => componentFromObject(hit.object))
          .filter((id): id is ComponentId => !!id);
        return candidates.find(isSensor) ?? candidates[0] ?? null;
      };
      const pointerDown = (event: PointerEvent) => {
        down = { x: event.clientX, y: event.clientY };
      };
      const pointerMove = (event: PointerEvent) => {
        if (event.buttons) return;
        const hit = findHit(event);
        setHovered(hit);
        renderer.domElement.style.cursor = hit ? "pointer" : "grab";
        highlight(hit ?? callbacks.current.selected);
      };
      const pointerUp = (event: PointerEvent) => {
        if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
        const hit = findHit(event);
        if (hit) callbacks.current.onSelect(hit);
      };
      const pointerLeave = () => {
        setHovered(null);
        highlight(callbacks.current.selected);
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        setMessage("A sessão WebGL foi interrompida. Tente recarregar o visualizador.");
        setStatus("error");
      };
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointermove", pointerMove);
      renderer.domElement.addEventListener("pointerup", pointerUp);
      renderer.domElement.addEventListener("pointerleave", pointerLeave);
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      const disposeModel = (root: InstanceType<typeof THREE.Group>) => {
        const geometries = new Set<InstanceType<typeof THREE.BufferGeometry>>();
        const materials = new Set<InstanceType<typeof THREE.Material>>();
        const textures = new Set<InstanceType<typeof THREE.Texture>>();
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach(
            (material) => materials.add(material),
          );
        });
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
          material.dispose();
        });
        geometries.forEach((geometry) => geometry.dispose());
        textures.forEach((texture) => texture.dispose());
      };
      cleanup = () => {
        cancelAnimationFrame(frame);
        controller.abort();
        observer.disconnect();
        actions.current = undefined;
        reducedMotion.removeEventListener("change", motionChanged);
        renderer.domElement.removeEventListener("pointerdown", pointerDown);
        renderer.domElement.removeEventListener("pointermove", pointerMove);
        renderer.domElement.removeEventListener("pointerup", pointerUp);
        renderer.domElement.removeEventListener("pointerleave", pointerLeave);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        restoreMaterials();
        orbit.removeEventListener("change", requestRender);
        orbit.dispose();
        if (model) disposeModel(model);
        environment.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      const gltf = await new GLTFLoader().parseAsync(bytes, "/models/");
      if (disposed) {
        disposeModel(gltf.scene);
        return;
      }
      model = gltf.scene;
      const names: string[] = [];
      model.traverse((object) => {
        if (object.name) names.push(object.name);
      });
      const report = inspectSceneNames(names);
      callbacks.current.onInspect(report);
      if (report.missingNames.length)
        console.warn("GLB r33: objetos esperados não encontrados", report.missingNames);
      console.info("GLB r33: cena carregada", {
        objects: report.objectCount,
        mappedComponents: report.found,
      });
      const bounds = new THREE.Box3().setFromObject(model);
      if (bounds.isEmpty()) throw new Error("O GLB não contém geometria visível.");
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      scene.add(model);
      const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.1);
      orbit.minDistance = radius * 0.6;
      orbit.maxDistance = radius * 7;
      const reset = () => {
        orbit.autoRotate = false;
        setRotating(false);
        orbit.enableDamping = false;
        orbit.update();
        const distance =
          (radius / Math.sin(THREE.MathUtils.degToRad(40 / 2))) *
          (camera.aspect < 1 ? 1 / camera.aspect : 1) *
          0.85;
        camera.position.set(distance * 0.6, distance * 0.5, distance * 0.75);
        camera.near = radius / 100;
        camera.far = radius * 100;
        camera.updateProjectionMatrix();
        orbit.target.set(0, 0, 0);
        orbit.update();
        orbit.enableDamping = true;
      };
      reset();
      highlight(callbacks.current.selected);
      actions.current = {
        reset,
        highlight,
        move: (azimuth, polar) => {
          orbit.autoRotate = false;
          setRotating(false);
          orbit.enableDamping = false;
          orbit.update();
          const spherical = new THREE.Spherical().setFromVector3(
            camera.position.clone().sub(orbit.target),
          );
          spherical.theta += azimuth;
          spherical.phi = THREE.MathUtils.clamp(spherical.phi + polar, 0.05, orbit.maxPolarAngle);
          camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(spherical));
          orbit.update();
          orbit.enableDamping = true;
        },
        rotate: (enabled) => {
          orbit.autoRotate = enabled && !reducedMotion.matches;
          setRotating(orbit.autoRotate);
        },
        zoom: (factor) => {
          const offset = camera.position.clone().sub(orbit.target);
          offset.setLength(
            THREE.MathUtils.clamp(offset.length() * factor, orbit.minDistance, orbit.maxDistance),
          );
          camera.position.copy(orbit.target).add(offset);
          orbit.update();
        },
      };
      setStatus("ready");
      const animate = () => {
        if (disposed) return;
        frame = requestAnimationFrame(animate);
        if (!document.hidden) {
          const changed = orbit.update();
          if (needsRender || changed) {
            renderer.render(scene, camera);
            needsRender = false;
          }
        }
      };
      animate();
    };
    initialize().catch((error: unknown) => {
      if (disposed) return;
      cleanup?.();
      cleanup = undefined;
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir o modelo 3D.");
      setStatus("error");
    });
    return () => {
      disposed = true;
      controller.abort();
      cleanup?.();
    };
  }, [retry]);

  return (
    <section className="dt-viewer" aria-label="Visualização do dessalinizador">
      <div className="dt-viewer-top">
        <span>
          <Box size={15} /> Dessalinizador solar <b>r33</b>
        </span>
        <span className="dt-viewer-badge">
          {status === "ready" ? "Modelo interativo" : "Referência do equipamento"}
        </span>
      </div>
      <div
        ref={host}
        className="dt-canvas"
        tabIndex={status === "ready" ? 0 : -1}
        role="group"
        aria-label="Câmera 3D: setas para girar, mais e menos para zoom, Home para restaurar"
        onKeyDown={(event) => {
          const controls = actions.current;
          if (!controls) return;
          if (event.key === "ArrowLeft") controls.move(-0.15, 0);
          else if (event.key === "ArrowRight") controls.move(0.15, 0);
          else if (event.key === "ArrowUp") controls.move(0, -0.12);
          else if (event.key === "ArrowDown") controls.move(0, 0.12);
          else if (event.key === "+" || event.key === "=") controls.zoom(0.8);
          else if (event.key === "-") controls.zoom(1.25);
          else if (event.key === "Home") controls.reset();
          else return;
          event.preventDefault();
        }}
        style={{ visibility: status === "ready" ? "visible" : "hidden" }}
      />
      {status !== "ready" && (
        <div className="dt-model-fallback">
          <img
            loading="lazy"
            src={`/images/digital-twin/${reference === "exterior" ? "exterior-r33" : "basin-r33"}.png`}
            alt={
              reference === "exterior"
                ? "Referência técnica do dessalinizador solar fechado, com painel, tanque e filtro"
                : "Referência da cuba interna e da lâmina de água sob a tampa"
            }
          />
          <div className="dt-fallback-caption" role="status">
            {status === "loading" ? (
              <>
                <LoaderCircle className="animate-spin" size={18} /> Carregando o modelo 3D…
              </>
            ) : (
              <>
                <strong>Visualização 3D indisponível</strong>
                <span>{message}</span>
                <button onClick={() => setRetry((r) => r + 1)}>Tentar novamente</button>
                <button
                  onClick={() => setReference((r) => (r === "exterior" ? "basin" : "exterior"))}
                >
                  Ver referência {reference === "exterior" ? "interna" : "externa"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {hovered && status === "ready" && (
        <div className="dt-hover-label">
          {isSensor(hovered) ? sensors[hovered].label : parts[hovered].label}
        </div>
      )}
      <div className="dt-viewer-bottom">
        <span>
          <MousePointer2 size={14} /> Arraste para girar · clique nas peças
        </span>
        <div className="dt-camera-controls">
          <button
            disabled={status !== "ready"}
            onClick={() => actions.current?.move(-0.2, 0)}
            aria-label="Girar câmera para a esquerda"
            title="Girar para a esquerda"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            disabled={status !== "ready"}
            onClick={() => actions.current?.move(0.2, 0)}
            aria-label="Girar câmera para a direita"
            title="Girar para a direita"
          >
            <ChevronRight size={17} />
          </button>
          <button
            disabled={status !== "ready"}
            onClick={() => actions.current?.zoom(0.8)}
            aria-label="Aproximar câmera"
            title="Aproximar"
          >
            <ZoomIn size={17} />
          </button>
          <button
            disabled={status !== "ready"}
            onClick={() => actions.current?.zoom(1.25)}
            aria-label="Afastar câmera"
            title="Afastar"
          >
            <ZoomOut size={17} />
          </button>
          <button
            disabled={status !== "ready"}
            onClick={() => actions.current?.rotate(!rotating)}
            aria-label="Rotação automática"
            aria-pressed={rotating}
            title="Rotação automática (respeita redução de movimento)"
          >
            <Rotate3D size={17} />
          </button>
          <button
            disabled={status !== "ready"}
            onClick={() => actions.current?.reset()}
            aria-label="Restaurar câmera"
            title="Restaurar câmera"
          >
            <RotateCcw size={17} />
          </button>
          <button
            onClick={() => {
              if (host.current?.parentElement && !document.fullscreenElement)
                void host.current.parentElement.requestFullscreen?.().catch(() => {});
              else void document.exitFullscreen?.().catch(() => {});
            }}
            aria-label="Alternar tela cheia"
            title="Tela cheia"
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
