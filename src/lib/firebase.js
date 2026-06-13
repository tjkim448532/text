import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCxFkZme6VZQLXefe1HvmT2K1c3FbwHuco",
  authDomain: "text-7d7c6.firebaseapp.com",
  projectId: "text-7d7c6",
  storageBucket: "text-7d7c6.firebasestorage.app",
  messagingSenderId: "872738990150",
  appId: "1:872738990150:web:02ac3928bae15537194247",
  measurementId: "G-YV89DXVJ78"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
