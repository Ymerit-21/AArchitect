// Google Sign-In on Android requires an androidClientId (SHA-1 keystore).
// Stub it out until that's configured.
export function useGoogleAuth() {
  return [null, null, () => {}];
}
