import { storage } from './firebase-config.js';
import { 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

// Carica un file (es. busta paga o allegato avviso)
export async function uploadFile(path, file) {
    try {
        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);
        return { success: true, url: downloadURL };
    } catch (error) {
        console.error("Errore caricamento file:", error);
        return { success: false, error: error.message };
    }
}

// Elimina un file
export async function deleteFile(path) {
    try {
        const fileRef = ref(storage, path);
        await deleteObject(fileRef);
        return { success: true };
    } catch (error) {
        console.error("Errore eliminazione file:", error);
        return { success: false, error: error.message };
    }
}
