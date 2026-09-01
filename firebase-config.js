import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDavgBQbJYzYw_m26bAdWsXPChxsntAMK0",
  authDomain: "glory-momo.firebaseapp.com",
  projectId: "glory-momo",
  storageBucket: "glory-momo.firebasestorage.app",
  messagingSenderId: "1033152928115",
  appId: "1:1033152928115:web:40adb3a6723f1559d38d06",
  measurementId: "G-HG5G9MD8L1",
  databaseURL: "https://glory-momo-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
