import { getApps, initializeApp } from "firebase/app";

export const firebaseConfig = {
  apiKey: "AIzaSyCOraAgwPljai_yaMPvVFVM3CajA_PGRDA",
  authDomain: "comets-app.firebaseapp.com",
  projectId: "comets-app",
  storageBucket: "comets-app.firebasestorage.app",
  messagingSenderId: "922473921047",
  appId: "1:922473921047:web:07387cd5482f032044ba52",
};

export const initFirebase = () => {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
};
