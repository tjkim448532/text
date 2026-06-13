import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCc64ZyYai0gWp51qV_XKOVAY5d6gBixuM",
  authDomain: "belleforetcs.firebaseapp.com",
  projectId: "belleforetcs",
  storageBucket: "belleforetcs.firebasestorage.app",
  messagingSenderId: "732665193591",
  appId: "1:732665193591:web:f8090194fd62d674675272"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
