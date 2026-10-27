// vite-plugin-pwa makes "virtual:pwa-register/react" only in real builds. Tests import this stand-in
// (vitest.config.ts), with no update waiting; tests/update-toast.test.tsx mocks it with one.
export function useRegisterSW(_options?: unknown) {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async (_reload?: boolean) => {},
  };
}
