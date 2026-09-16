import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Funzione di login
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Errore di login:", error);
        return { success: false, error: error.message };
    }
}

// Funzione di logout
export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error("Errore di logout:", error);
        return { success: false, error: error.message };
    }
}

// Monitoraggio stato utente
export function listenAuthState(callback) {
    onAuthStateChanged(auth, (user) => {
        callback(user);
    });
}
