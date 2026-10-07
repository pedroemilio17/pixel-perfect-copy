# DeSol — Telemetria Hídrica Inteligente

Aplicativo responsivo em modo escuro, com visual o mais simples possível inspirado no iOS: fundo quase preto, cartões arredondados (cantos grandes) em cinza escuro, sem bordas pesadas, muito espaço, títulos grandes em negrito, listas agrupadas estilo Ajustes do iPhone, controles segmentados e barra de abas inferior no celular.

Identidade segue a logo enviada: o amarelo #FFF53D da logo é a cor principal (botões, item ativo, destaques); a logo aparece no topo da navegação. Ciano #06b6d4 para água, esmeralda #10b981 para status bom, âmbar #f59e0b para alertas, vermelho iOS para crítico — usados com moderação. Fonte com cara de SF Pro (Inter com espaçamento ajustado). Todo o conteúdo em português e com dados simulados que mudam ao vivo.

## Navegação
- Barra lateral recolhível no desktop (mostra só os ícones quando recolhida) e menu na parte de baixo no celular.
- 4 páginas, cada uma com seu próprio endereço e título:
  - `/` Painel em tempo real
  - `/preditivo` Módulo de IA (PIML)
  - `/mapa` Mapa e telemetria
  - `/operacional` Controle e alertas
- Faixa de status no topo: "Rádio LoRa: Conectado (15 km) | Modo Offline-First Ativo | ESP32 Online", com pontos pulsando.

## 1. Painel
- 4 cartões: Salinidade/TDS (180 ppm, "Água Potável / Padrão Excelente"), Temperatura (54,2 °C), Reservatório (barra 82% — 41L/50L), Produção (18,4 L/dia, "+12% vs. ontem").
- Valores variam levemente a cada poucos segundos.
- Gráfico de linhas interativo das últimas 24h: Temperatura (°C) x Produção (L), com dois eixos e dica ao passar o mouse.

## 2. Módulo preditivo
- Cartão de destaque com gradiente suave: acurácia de 96,9%.
- Mostrador circular "Previsão de Produção de Amanhã: 21,5 L" (modelo de Dunkle + radiação solar), com detalhes de radiação/temperatura.
- Saúde dos componentes: condensador 98%, mais 3 outros componentes com barras; "Nenhuma manutenção necessária nos próximos 15 dias".

## 3. Mapa
- Mapa estilizado desenhado (sem serviço externo): relevo, rios, linhas do alcance LoRa, 5–6 comunidades com pontos clicáveis.
- Painel do ponto selecionado: sinal (-92 dBm), última sincronização, status.
- Histórico de sincronização offline em lista.

## 4. Operacional
- Feed de alertas com cores: verde (água apta), amarelo (reservatório próximo da capacidade), vermelho (temperatura crítica); novos alertas surgem periodicamente; filtros por severidade.
- Botão "Forçar Sincronização Local (Bluetooth/LoRa)" com animação de carregamento e aviso de sucesso.

## Detalhes técnicos
- Tokens de cor em oklch no `src/styles.css` (tema escuro como padrão), Geist via `<link>` no root.
- Componentes shadcn necessários (card, badge, progress, button, sidebar, sonner, chart/recharts); `bun add recharts`.
- Gerador de dados simulados num hook compartilhado (`useTelemetry`) com intervalo; nada de backend.
- `head()` próprio por rota; Toaster montado no root.
