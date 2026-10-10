import { useState } from "react";
import { act, render, renderHook, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextPresentedComponent, presentationOrder, useComponentTour } from "./presentation";
import { demoRecords, latestBySensor, type ComponentId } from "./model";
import ComponentCallout from "./ComponentCallout";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function useTour(enabled: boolean, available = presentationOrder) {
  const [selected, onSelect] = useState<ComponentId>("solar_irradiance");
  const remaining = useComponentTour({ enabled, selected, available, onSelect });
  return { selected, remaining };
}

describe("apresentação de componentes", () => {
  it("mantém cada componente por 12 segundos e percorre os 12 antes de repetir", () => {
    const { result } = renderHook(() => useTour(true));
    act(() => vi.advanceTimersByTime(11_000));
    expect(result.current).toEqual({ selected: "solar_irradiance", remaining: 1 });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toEqual({ selected: "water_level", remaining: 12 });
    for (const selected of presentationOrder.slice(2)) {
      act(() => vi.advanceTimersByTime(12_000));
      expect(result.current.selected).toBe(selected);
    }
    act(() => vi.advanceTimersByTime(12_000));
    expect(result.current.selected).toBe("solar_irradiance");
  });
  it("interrompe o ciclo ao pausar ou desmontar e reinicia o tempo ao retomar", () => {
    const { result, rerender, unmount } = renderHook(({ enabled }) => useTour(enabled), {
      initialProps: { enabled: true },
    });
    act(() => vi.advanceTimersByTime(5000));
    rerender({ enabled: false });
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.selected).toBe("solar_irradiance");
    expect(vi.getTimerCount()).toBe(0);
    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(11_000));
    expect(result.current.selected).toBe("solar_irradiance");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.selected).toBe("water_level");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("pausa a leitura com a aba oculta e ignora componentes ausentes no GLB", () => {
    const available: ComponentId[] = ["water_level", "roof"];
    const { result } = renderHook(() => useTour(true, available));
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.remaining).toBe(12);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    act(() => vi.advanceTimersByTime(12_000));
    expect(result.current.selected).toBe("water_level");
    act(() => vi.advanceTimersByTime(12_000));
    expect(result.current.selected).toBe("roof");
    expect(nextPresentedComponent("roof", available)).toBe("water_level");
    expect(nextPresentedComponent("roof", [])).toBeUndefined();
  });
  it("mantém identificação DEMO e não inventa telemetria dedicada para peças", () => {
    const props = {
      telemetry: {
        readings: latestBySensor(demoRecords),
        health: {
          solar_irradiance: "unknown",
          water_level: "unknown",
          production_flow: "unknown",
          gateway: "unknown",
        } as const,
        mode: "demo" as const,
      },
      touring: true,
      remaining: 12,
      position: 5,
      count: 12,
      onPause: vi.fn(),
      onResume: vi.fn(),
      onNext: vi.fn(),
      onReset: vi.fn(),
    };
    const { rerender } = render(<ComponentCallout selected="solar_panel" {...props} />);
    expect(screen.getByText("DEMO · Dados simulados")).toBeVisible();
    expect(
      screen.getByText("Este componente não possui medição dedicada configurada."),
    ).toBeVisible();
    expect(screen.getByText("Leituras gerais do dessalinizador")).toBeVisible();
    rerender(<ComponentCallout selected="water_level" {...props} />);
    expect(screen.getByText("Simulação · saúde física não confirmada")).toBeVisible();
    expect(screen.getByText("Última amostra")).toBeVisible();
    expect(screen.queryByText("Leituras gerais do dessalinizador")).toBeNull();
  });
});
