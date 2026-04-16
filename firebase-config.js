import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgqSzzLl747LTf8RqikcK2ASTH8nKQbGw",
  authDomain: "beauty-masters-studio-8df01.firebaseapp.com",
  projectId: "beauty-masters-studio-8df01",
  storageBucket: "beauty-masters-studio-8df01.firebasestorage.app",
  messagingSenderId: "246052354077",
  appId: "1:246052354077:web:bd39551114b337a5b86ef4",
  measurementId: "G-FP13HXF5WP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Анонимный вход
signInAnonymously(auth).catch(console.error);

export function playSound(type) {
  const sounds = {
    notification: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    confirm: 'https://www.soundjay.com/misc/sounds/button-09.mp3',
    complete: 'https://www.soundjay.com/misc/sounds/applause-01.mp3'
  };
  const audio = new Audio(sounds[type] || sounds.notification);
  audio.play().catch(e => console.log('Звук заблокирован'));
}