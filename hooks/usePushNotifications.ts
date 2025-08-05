import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';

export default function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });
  }, []);

  return expoPushToken;
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    // Non supporté sur simulateur/Expo Go
    return null;
  }
  return token;
}
