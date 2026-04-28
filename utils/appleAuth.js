// Stub for non-iOS platforms — expo-apple-authentication is iOS only.
export const signInAsync = () => Promise.reject(new Error('Apple Sign In is not available on this platform.'));
export const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 };
