// Cornerstone core is loaded dynamically by callers; avoid static imports here

let toolsModulePromise: Promise<any> | null = null
let toolsInitDone = false

export async function getToolsModule(): Promise<any> {
  if (!toolsModulePromise) {
    toolsModulePromise = import('@cornerstonejs/tools')
  }
  const mod = await toolsModulePromise
  ;(window as any).__csTools = mod
  return mod
}

export async function initToolsOnce(): Promise<void> {
  // Ensure core is initialized before tools if caller forgot
  // We don't re-init core here; we assume caller handled it.
  const tools = await getToolsModule()
  if (!toolsInitDone && typeof tools.init === 'function') {
    await tools.init()
    toolsInitDone = true
  }
}

// Hook for config to initialize enums at runtime
export async function initializeToolEnumsInConfig(initializeFn: (enums: any) => void): Promise<void> {
  const tools = await getToolsModule()
  if (tools?.Enums) {
    initializeFn(tools.Enums)
  }
}