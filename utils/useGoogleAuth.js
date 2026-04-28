import * as Google from 'expo-auth-session/providers/google';

const WEB_CLIENT_ID = '614515567588-9ci21svv3ouo2taes7k1b52qim28v8jm.apps.googleusercontent.com';
const IOS_CLIENT_ID = '614515567588-hos175rdqbad64t5rks2scjv7ef7vps1.apps.googleusercontent.com';

export function useGoogleAuth() {
  return Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
  });
}
