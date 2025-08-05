import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Tableau de logs en mémoire, accessible via closure
const logMessages: string[] = [];

function addLog(msg: string) {
  const timestamp = new Date().toISOString();
  const fullMsg = `[${timestamp}] ${msg}`;
  logMessages.push(fullMsg);
  console.log(fullMsg);
}

// Fonction pour récupérer les logs (à exposer pour affichage debug)
export function getNotificationLogs() {
  return [...logMessages];
}

export async function registerForPushNotificationsAsync() {
  addLog('[Push] Début enregistrement...');
  let token = null;

  if (!Device.isDevice) {
    addLog('[Push] Pas un appareil réel, notifications désactivées.');
    alert('Les notifications push fonctionnent uniquement sur un appareil réel.');
    return null;
  }

  try {
    addLog('[Push] Vérification des permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      addLog('[Push] Permission non accordée, demande en cours...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    addLog(`[Push] Permission finale: ${finalStatus}`);

    if (finalStatus !== 'granted') {
      addLog('[Push] Permission refusée, arrêt.');
      alert('Impossible d’obtenir la permission pour les notifications !');
      return null;
    }

    addLog('[Push] Obtention du token Expo...');
    const tokenData = await Notifications.getExpoPushTokenAsync();
    token = tokenData.data;
    addLog(`[Push] Token reçu: ${token}`);

    if (Platform.OS === 'android') {
      addLog('[Push] Configuration canal Android...');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF8200',
        sound: 'default',
      });
    }
  } catch (error: any) {
    addLog(`[Push] ERREUR: ${error.message || error}`);
    alert(`Erreur lors de l'activation des notifications: ${error.message || error}`);
    return null;
  }

  addLog('[Push] Enregistrement terminé.');
  return token;
}
