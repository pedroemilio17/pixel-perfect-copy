export async function loadModelBytes(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  });
  if (!response.ok)
    throw new Error(`Não foi possível carregar o modelo (HTTP ${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 20) throw new Error("O arquivo não é um modelo GLB válido.");
  const header = new DataView(buffer);
  if (
    header.getUint32(0, true) !== 0x46546c67 ||
    header.getUint32(4, true) !== 2 ||
    header.getUint32(8, true) !== buffer.byteLength
  )
    throw new Error("O arquivo não é um modelo GLB 2.0 válido.");
  return buffer;
}
