// No-op shim to disable polySeg worker registration during production build
export function registerPolySegWorker() {
  // Intentionally left blank – segmentation worker disabled
}

export default { registerPolySegWorker }