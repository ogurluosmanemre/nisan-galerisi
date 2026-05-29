import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDX-phb9w3CZ-ya-WpABncSVScl4Z7F5gs",
  authDomain: "nisan-galerisi.firebaseapp.com",
  projectId: "nisan-galerisi",
  storageBucket: "nisan-galerisi.firebasestorage.app",
  messagingSenderId: "949477950301",
  appId: "1:949477950301:web:e421f7411cadb8d47e9eb4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
