/**
 * Quanto è piena la bubble: i token del contesto all'ultima misura del motore,
 * più quelli di prima, da cui parte il liquido quando il livello cambia.
 */
export type Fill = {
  /** token del contesto; null prima della prima risposta e subito dopo /compact */
  tokens: number | null
  /** la finestra del modello, in token */
  window: number | null
  /** i token della misura precedente */
  previous: number | null
  /** quando il livello è cambiato: la salita si anima solo nei secondi subito dopo */
  changedAt: number | null
  isCompacted: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'bubble-contesto': { fill: Fill }
  }
}
