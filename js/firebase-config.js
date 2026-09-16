import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDJXCWKdVFN0wvl9ON6dKLkj07Wh0srqZA",
  authDomain: "portale-vicla.firebaseapp.com",
  projectId: "portale-vicla",
  storageBucket: "portale-vicla.firebasestorage.app",
  messagingSenderId: "548242902217",
  appId: "1:548242902217:web:9c6ecf6e80ae484b321118"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with multi-tab offline persistence
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const storage = getStorage(app);

