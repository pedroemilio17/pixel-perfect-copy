import { createFileRoute } from "@tanstack/react-router";
import DigitalTwinDashboard from "@/features/digital-twin/DigitalTwinDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gêmeo digital do dessalinizador solar — DeSol" },
      {
        name: "description",
        content:
          "Explore o modelo 3D r33, sensores, histórico e relatórios do dessalinizador solar. Demonstração identificada e integração por API.",
      },
      { property: "og:title", content: "Gêmeo digital — DeSol" },
    ],
  }),
  component: DigitalTwinDashboard,
});
