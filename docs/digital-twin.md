# Gêmeo digital DeSol — revisão 33

## O que funciona

- GLB local em `public/models/dessalinizador-solar-r33.glb`, sem dependência de URL assinada ou de login no Higgsfield.
- Modelo recebido: GLB 2.0, 1.749.364 bytes, 224 nodes exportados e 225 objetos na cena carregada, incluindo a raiz. Seis objetos SENSOR correspondem aos quatro papéis funcionais; todos foram encontrados.
- SHA-256: `61dd4c141a9e2c87a5d385b8e807c261612b453b22013c5f2f5e72775a37e596`.
- OrbitControls: arraste, rotação 360°, zoom limitado, rotação automática opcional, reset e tela cheia. A câmera também responde às setas, +/- e Home quando focada, além dos botões de giro lateral. Redução de movimento desativa a rotação automática.
- Raycasting dos sensores, reconhecimento de filhos/ancestrais, prioridade de sensores e seleção de oito grupos de componentes. Destaque reversível por cópia de materiais; vidro, água, calha e transparências não são substituídos.
- Inspeção efetiva com `scene.traverse`; nomes esperados ausentes são reportados no console e no painel, sem criar um vínculo fictício.
- Layout responsivo, seleção textual por teclado, indicação de qualidade, horário da leitura, bateria/RSSI/diagnóstico quando recebidos, fallback com imagens técnicas para 404/GLB inválido/WebGL indisponível e botão de nova tentativa.
- Fixtures originais em `src/features/digital-twin/data/demo.json`. Dados fixos de 09/10/2026: não se inventa um relógio de telemetria ao vivo. Horários apresentados em America/Cuiaba; filtros e timestamps do contrato em UTC.
- DEMO com cenários explícitos de falha de comunicação ou leitura inválida. Eventos e dados exportados continuam com `source: demo`.
- Quatro gráficos, filtros por sensor/período, tabela de registros e CSV somente dos registros carregados e filtrados. Gateway tem uma amostra no fixture original, sinalizada como insuficiente para série histórica. O cenário de falha acrescenta uma segunda amostra simulada.
- Lacunas e leituras ausentes/inválidas interrompem a linha; não são convertidas em zeros. A cadência de referência DEMO é 15 minutos nos gráficos, sem afirmar que seja a cadência de um dispositivo físico.
- Painel anterior de TDS/temperatura/reservatório/produção preservado em seção expansível. As rotas `/preditivo`, `/mapa`, `/operacional` e a API `/api/v1` continuam disponíveis. Unidades legadas não são convertidas arbitrariamente em mm ou L/h do modelo novo.

## Arquitetura

`src/routes/index.tsx` mantém a rota TanStack existente e renderiza `DigitalTwinDashboard`. O visualizador Three.js é carregado sob demanda no navegador. A página e o restante da telemetria continuam disponíveis enquanto ele carrega ou falha.

- `model.ts`: manifesto, mapeamento, contrato Zod, fixtures, saúde, filtros, lacunas e CSV.
- `ModelViewer.tsx` / `model-loader.ts`: GLTFLoader, OrbitControls, iluminação, raycasting, gerenciamento e descarte de recursos, renderização somente quando a cena/câmera muda, timeout e recuperação.
- `telemetry-client.ts` / `use-telemetry.ts`: adaptador REST, validação e cancelamento, polling a cada 15 s e backoff de 30/60 s após falhas. Essa frequência é da interface, não uma taxa presumida de amostragem do hardware.
- `src/lib/digital-twin-proxy.server.ts`: proxy somente no backend. O frontend consulta `/api/digital-twin/*`; o token nunca é devolvido na configuração nem colocado em variáveis `VITE_*`. Redirecionamentos são recusados para não encaminhar a autorização a outro destino.

A API anterior tem um contrato diferente: reservatório em porcentagem e produção acumulada, sem os quatro registros padronizados, eventos ou comprovação de hardware. Por isso a integração r33 usa um adaptador próprio e preserva a API anterior, em vez de fabricar conversões ou tratar suas fixtures como dados reais.

## Configuração real (opcional)

Sem `DESOL_API_BASE_URL`, o modo é DEMO e nenhum serviço externo é consultado. `GET /api/digital-twin/config` expõe somente modo, identificador de dispositivo e intervalo esperado opcional.

Copie `.env.example` para `.env.local` para desenvolvimento. O Vite carrega apenas as quatro configurações privadas abaixo no processo do servidor; elas não entram nos defines do cliente. Variáveis já injetadas no processo têm precedência. Em produção, configure as variáveis/bindings de runtime no serviço de hospedagem, sem versionar valores secretos.

| Variável | Significado |
| --- | --- |
| `DESOL_API_BASE_URL` | Base HTTPS do backend, incluindo o prefixo da API, por exemplo `https://backend.example/api/`. HTTP só é aceito para localhost em desenvolvimento. |
| `DESOL_DEVICE_ID` | Identificador real registrado no backend; obrigatório em modo real. |
| `DESOL_API_TOKEN` | Bearer token opcional, apenas no backend, se o serviço exigir esse método. Não inserir no frontend. |
| `DESOL_SAMPLE_INTERVAL_SECONDS` | Intervalo confirmado de amostragem física, em segundos; omitido enquanto não for conhecido. O resumo pode fornecê-lo também. |

Reinicie o servidor após modificar essas configurações. Não habilite o modo real apenas para remover a faixa DEMO: ele requer o serviço com o contrato abaixo.

## Contrato REST do backend

Com base `https://backend.example/api/` e dispositivo `device-a`, são consultados:

| Operação | URL do serviço |
| --- | --- |
| Resumo | `GET /api/devices/device-a/summary` |
| Últimas amostras | `GET /api/devices/device-a/telemetry/latest` |
| Histórico | `GET /api/devices/device-a/telemetry/history?from=<ISO UTC>&to=<ISO UTC>` |
| Eventos | `GET /api/devices/device-a/events?from=<ISO UTC>&to=<ISO UTC>` |

Latest/history retornam array de registros ou `{ "records": [...] }`; eventos retornam array ou `{ "events": [...] }`. Sem filtro explícito de período, o adaptador consulta as últimas 24 h. CSV é gerado no navegador a partir dos registros disponíveis. O frontend não presume histórico além dos dados recebidos. Se o backend usar paginação, agregação ou um contrato diferente, adapte `telemetry-client.ts` ao contrato confirmado antes de operar.

Cada registro segue o contrato do pacote, com validações adicionais de unidade, métrica, tipo de valor, timestamp, fonte e identificador:

```json
{
  "deviceId": "device-a",
  "sensorId": "solar_irradiance",
  "metric": "irradiance_w_m2",
  "value": 725.4,
  "unit": "W/m²",
  "timestamp": "2026-10-09T13:00:00Z",
  "quality": "good",
  "source": "real"
}
```

Esse exemplo é um contrato ilustrativo, não evidência de uma leitura física. `quality`: `good`, `suspect`, `bad`, `missing`. `value` pode ser `null`; gateway usa boolean. Campos opcionais: `diagnosticCode`, `batteryPct` (0–100), `rssiDbm`.

| sensorId | metric | unit |
| --- | --- | --- |
| `solar_irradiance` | `irradiance_w_m2` | `W/m²` |
| `water_level` | `water_level_mm` | `mm` |
| `production_flow` | `production_flow_l_h` | `L/h` |
| `gateway` | `gateway_online` | `boolean` |

Resumo:

```json
{
  "deviceId": "device-a",
  "hardwareConfirmed": true,
  "communication": "online",
  "lastSeen": "2026-10-09T13:00:00Z",
  "sampleIntervalSeconds": 60
}
```

`hardwareConfirmed` e `communication` precisam ser informações reais do backend. Sessenta segundos é apenas um exemplo; não foi configurado como taxa física padrão. Na ausência de confirmação, o estado permanece desconhecido. Um registro DEMO retornado em modo real, dispositivo incorreto, unidade errada ou JSON inválido invalida a sincronização.

Eventos: `{ "id": "event-id", "timestamp": "ISO UTC", "sensorId": "water_level", "severity": "warning", "message": "Diagnóstico recebido do backend", "source": "real" }`. `sensorId` pode ser omitido/null; severity é `info`, `warning` ou `error`.

O proxy tem timeout de 7 s e o cliente, de 8 s. Ao falhar, os últimos registros reais são preservados, a API é indicada como indisponível e a saúde atual fica desconhecida. Não há fallback silencioso para DEMO: o usuário precisa escolher “Explorar DEMO”. Interação 3D e consulta dos dados disponíveis continuam funcionando.

## Saúde e limites

- DEMO nunca confirma hardware saudável/online; a origem simulada permanece visível.
- `offline`: comunicação explicitamente offline no resumo, ou registro recente/válido do gateway com valor false, após conhecer intervalo e confirmar o hardware.
- `error`: qualidade bad ou diagnóstico de erro recebido.
- `unknown`: falta de dados, valor ausente, qualidade suspeita, configuração/instalação não confirmada, timestamp inválido/futuro ou API indisponível.
- `stale`: amostra real mais antiga que duas vezes o intervalo esperado explicitamente configurado.
- `ok`: amostra real válida e recente, com hardware confirmado e intervalo conhecido. Significa leitura atualizada, não potabilidade ou funcionamento hidráulico completo.

Não há porcentagem de saúde, limiar físico/sanitário presumido ou taxa de amostragem inventada. Os 40 mm da cena, os 18° da tampa e as dimensões da calha são características conceituais do modelo, não alarmes ou medições. A transparência e a calha devem continuar sendo revisadas no navegador ao substituir o GLB.

## Testes e validação

`bun run test` executa o teste anterior de roteamento e testes do mapeamento (inclusive o arquivo GLB real), saúde, cenários DEMO, contratos, lacunas, CSV, GLB 404/inválido, origem inválida, API offline e proxy backend. `bunx tsc --noEmit` valida tipos; as incompatibilidades anteriores com Recharts 3 e a inferência do alerta legado foram corrigidas.

`bun run test:e2e` executa Playwright/Chromium com WebGL de software: cliques projetados nas malhas reais dos quatro sensores, drag/rotação/reset, filtros, conteúdo do CSV, 404 e recuperação, API indisponível, DEMO explícito, responsividade, toque/arraste no celular, teclado (incluindo câmera), redução de movimento e fallback sem WebGL. Instale o navegador com `bunx playwright install chromium` ou informe `CHROMIUM_PATH` para um Chromium do sistema. As opções de software são somente do navegador de testes; a aplicação usa WebGL normal.

## O que depende de hardware/serviço

- Confirmação de sensores instalados, local físico do sensor de nível, calibração e unidades do gateway.
- Protocolo de ingestão de ESP32/LoRa, gateway real, autenticação e backend persistente.
- Endpoints operacionais que cumpram ou adaptem o contrato; política de acesso do serviço de hospedagem.
- Intervalos de amostragem, heartbeats e diagnósticos efetivamente disponíveis.
- Regras de segurança/potabilidade, limites e alarmes aprovados por responsáveis técnicos.
- SSE/WebSocket é uma evolução opcional quando o serviço oferecer um protocolo confirmado. O adaptador atual usa REST; não cria MQTT, tópicos, credenciais ou conexões LoRa fictícias.
- Não foi feita publicação/deploy nem ensaio com dispositivos físicos. O build mantém o destino Cloudflare existente.

### Resultado da validação desta entrega

- Instalação com `bun install --frozen-lockfile`: aprovada.
- Build de produção, checagem de tipos e 28 testes Vitest: aprovados.
- Na validação inicial, os sete testes Playwright passaram. Após reposicionar o modelo no topo da página inicial, em 10/10/2026, o teste de celular/teclado passou, mas o teste completo de rotação/reset/filtros/CSV excedeu o tempo limite em capturas e interações com WebGL de software, inclusive na repetição isolada. A suíte completa ainda precisa ser revalidada nessa versão; esse resultado não é considerado aprovado. O carregamento do GLB e a presença do visualizador na primeira tela foram verificados no navegador em desktop e celular.
- ESLint: nenhum erro; seis avisos preexistentes de Fast Refresh nos componentes de UI.
- Modelo e transparências revisados em capturas desktop/mobile. Nenhum ensaio com hardware físico, broker ou gateway real foi executado.
