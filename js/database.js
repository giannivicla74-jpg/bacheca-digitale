import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    setDoc,
    updateDoc, 
    doc, 
    deleteDoc,
    query,
    where,
    writeBatch,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ==========================================
// 1. UTENTI / LAVORATORI (users)
// ==========================================
export const DEMO_BLOCKED_IDS = new Set([
    'W01', 'W02', 'W03', 'W04', 'W05', 'W06',
    'N01', 'N02', 'N03', 'N04', 'N05',
    'P01', 'P02', 'P03', 'P04', 'P05',
    'REQ01', 'REQ02', 'REQ03', 'REQ04',
    'NOTIF_01', 'NOTIF_02', 'NOTIF_03',
    'VEH_001', 'VEH_002', 'VEH_003', 'VEH_004', 'VEH_005'
]);

export function isDemoBlocked(item) {
    if (!item) return false;
    if (item.id && DEMO_BLOCKED_IDS.has(item.id)) return true;
    if (item.surname && item.surname.toLowerCase().includes('bianchi') && item.name && item.name.toLowerCase().includes('giuseppe')) return true;
    if (item.surname && item.surname.toLowerCase().includes('rossi') && item.name && item.name.toLowerCase().includes('mario')) return true;
    if (item.title && item.title.includes('Benvenuto nel Portale Digitale')) return true;
    return false;
}

export async function getWorkers() {
    const workersCol = collection(db, 'users');
    const snapshot = await getDocs(workersCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function subscribeWorkers(callback, onError) {
    const workersCol = collection(db, 'users');
    return onSnapshot(workersCol, (snapshot) => {
        const workers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(workers);
    }, (error) => {
        console.warn("⚠️ [Realtime Users]", error);
        if (onError) onError(error);
    });
}

export async function addWorker(workerData) {
    if (isDemoBlocked(workerData)) {
        console.warn("🚫 [Guard Firestore] Rifiutato salvataggio lavoratore demo:", workerData.id);
        return workerData.id;
    }
    if (workerData.id) {
        const workerRef = doc(db, 'users', workerData.id);
        await setDoc(workerRef, workerData, { merge: true });
        return workerData.id;
    }
    const workersCol = collection(db, 'users');
    const docRef = await addDoc(workersCol, workerData);
    return docRef.id;
}

export async function updateWorker(id, workerData) {
    const workerRef = doc(db, 'users', id);
    await setDoc(workerRef, workerData, { merge: true });
}

export async function deleteWorker(id) {
    const workerRef = doc(db, 'users', id);
    await deleteDoc(workerRef);
}

// ==========================================
// 2. COMUNICAZIONI AZIENDALI (notices)
// ==========================================
export async function getNotices() {
    const noticesCol = collection(db, 'notices');
    const snapshot = await getDocs(noticesCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function subscribeNotices(callback, onError) {
    const noticesCol = collection(db, 'notices');
    return onSnapshot(noticesCol, (snapshot) => {
        const notices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(notices);
    }, (error) => {
        console.warn("⚠️ [Realtime Notices]", error);
        if (onError) onError(error);
    });
}

export async function addNotice(noticeData) {
    if (isDemoBlocked(noticeData)) {
        console.warn("🚫 [Guard Firestore] Rifiutata comunicazione demo:", noticeData.id);
        return noticeData.id;
    }
    if (noticeData.id) {
        const noticeRef = doc(db, 'notices', noticeData.id);
        await setDoc(noticeRef, noticeData, { merge: true });
        return noticeData.id;
    }
    const noticesCol = collection(db, 'notices');
    const docRef = await addDoc(noticesCol, noticeData);
    return docRef.id;
}

export async function updateNotice(id, noticeData) {
    const noticeRef = doc(db, 'notices', id);
    await setDoc(noticeRef, noticeData, { merge: true });
}

export async function deleteNotice(id) {
    const noticeRef = doc(db, 'notices', id);
    await deleteDoc(noticeRef);
}

// ==========================================
// 3. RICHIESTE PERMESSI & FERIE (leaveRequests)
// ==========================================
export async function getLeaveRequests() {
    const requestsCol = collection(db, 'leaveRequests');
    const snapshot = await getDocs(requestsCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function subscribeLeaveRequests(callback, onError) {
    const requestsCol = collection(db, 'leaveRequests');
    return onSnapshot(requestsCol, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(requests);
    }, (error) => {
        console.warn("⚠️ [Realtime LeaveRequests]", error);
        if (onError) onError(error);
    });
}

export async function addLeaveRequest(requestData) {
    if (isDemoBlocked(requestData)) {
        console.warn("🚫 [Guard Firestore] Rifiutata richiesta permessi demo:", requestData.id);
        return requestData.id;
    }
    if (requestData.id) {
        const reqRef = doc(db, 'leaveRequests', requestData.id);
        await setDoc(reqRef, requestData, { merge: true });
        return requestData.id;
    }
    const requestsCol = collection(db, 'leaveRequests');
    const docRef = await addDoc(requestsCol, requestData);
    return docRef.id;
}

export async function updateLeaveRequest(id, requestData) {
    const requestRef = doc(db, 'leaveRequests', id);
    await setDoc(requestRef, requestData, { merge: true });
}

export async function deleteLeaveRequest(id) {
    const requestRef = doc(db, 'leaveRequests', id);
    await deleteDoc(requestRef);
}

// ==========================================
// 4. BUSTE PAGA (payslips)
// ==========================================
export async function getPayslips() {
    const payslipsCol = collection(db, 'payslips');
    const snapshot = await getDocs(payslipsCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function subscribePayslips(callback, onError) {
    const payslipsCol = collection(db, 'payslips');
    return onSnapshot(payslipsCol, (snapshot) => {
        const payslips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(payslips);
    }, (error) => {
        console.warn("⚠️ [Realtime Payslips]", error);
        if (onError) onError(error);
    });
}

export async function addPayslip(payslipData) {
    if (isDemoBlocked(payslipData)) {
        console.warn("🚫 [Guard Firestore] Rifiutata busta paga demo:", payslipData.id);
        return payslipData.id;
    }
    if (payslipData.id) {
        const payslipRef = doc(db, 'payslips', payslipData.id);
        await setDoc(payslipRef, payslipData, { merge: true });
        return payslipData.id;
    }
    const payslipsCol = collection(db, 'payslips');
    const docRef = await addDoc(payslipsCol, payslipData);
    return docRef.id;
}

export async function updatePayslip(id, payslipData) {
    const payslipRef = doc(db, 'payslips', id);
    await setDoc(payslipRef, payslipData, { merge: true });
}

export async function deletePayslip(id) {
    const payslipRef = doc(db, 'payslips', id);
    await deleteDoc(payslipRef);
}

// ==========================================
// 5. NOTIFICHE PUSH & ALERT (notifications)
// ==========================================
export async function getNotifications() {
    const notifsCol = collection(db, 'notifications');
    const snapshot = await getDocs(notifsCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function subscribeNotifications(callback, onError) {
    const notifsCol = collection(db, 'notifications');
    return onSnapshot(notifsCol, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(notifs);
    }, (error) => {
        console.warn("⚠️ [Realtime Notifications]", error);
        if (onError) onError(error);
    });
}

export async function addNotification(notifData) {
    if (isDemoBlocked(notifData)) {
        console.warn("🚫 [Guard Firestore] Rifiutata notifica demo:", notifData.id);
        return notifData.id;
    }
    const notifId = notifData.id || ("NOTIF_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
    const notifRef = doc(db, 'notifications', notifId);
    const payload = { ...notifData, id: notifId };
    await setDoc(notifRef, payload, { merge: true });
    return notifId;
}

export async function updateNotification(id, notifData) {
    const notifRef = doc(db, 'notifications', id);
    await setDoc(notifRef, notifData, { merge: true });
}

export async function deleteNotification(id) {
    const notifRef = doc(db, 'notifications', id);
    await deleteDoc(notifRef);
}

export async function markNotificationsAsReadInCloud(notificationIds = []) {
    if (!notificationIds || notificationIds.length === 0) return;
    try {
        const batch = writeBatch(db);
        notificationIds.forEach(id => {
            const notifRef = doc(db, 'notifications', id);
            batch.update(notifRef, { read: true, readAt: new Date().toISOString() });
        });
        await batch.commit();
    } catch (e) {
        console.warn("Batch mark read warning, fallback a singolo aggiornamento:", e);
        for (const id of notificationIds) {
            try {
                const notifRef = doc(db, 'notifications', id);
                await updateDoc(notifRef, { read: true, readAt: new Date().toISOString() });
            } catch (err) {}
        }
    }
}

// ==========================================
// 6. DISPOSITIVI & TOKEN PUSH PWA (deviceTokens)
// ==========================================
// 8. DISPOSITIVI & TOKEN PUSH (FCM / Web Push)
// ==========================================
export function getDeviceFriendlyName(ua) {
    if (!ua) return 'Dispositivo Sconosciuto';
    if (/iPhone/i.test(ua)) return 'Apple iPhone';
    if (/iPad/i.test(ua)) return 'Apple iPad';
    if (/Android/i.test(ua)) {
        const match = ua.match(/Android\s+([0-9.]+)/i);
        return `Smartphone Android ${match ? match[1] : ''}`.trim();
    }
    if (/Windows/i.test(ua)) return 'PC Windows';
    if (/Macintosh/i.test(ua)) return 'Apple Mac';
    if (/Linux/i.test(ua)) return 'Dispositivo Linux';
    return 'Browser Web';
}

export async function registerDeviceToken({ token, role, workerId, userAgent }) {
    if (!token) return;
    try {
        const safeTokenStr = typeof token === 'string' ? token : JSON.stringify(token);
        const safeId = "DEV_" + btoa(safeTokenStr.slice(-24)).replace(/[^a-zA-Z0-9]/g, '_');
        const tokenRef = doc(db, 'deviceTokens', safeId);
        const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown');
        const deviceData = {
            id: safeId,
            token: safeTokenStr,
            role: role || 'admin', // 'admin' | 'worker'
            workerId: workerId || (role === 'admin' ? 'ADMIN' : 'ALL'),
            deviceName: getDeviceFriendlyName(ua),
            userAgent: ua,
            updatedAt: new Date().toISOString()
        };
        await setDoc(tokenRef, deviceData, { merge: true });
        console.log("📱 [Device Token] Dispositivo registrato su Firestore:", safeId, deviceData.deviceName, role, workerId);
        return safeId;
    } catch (e) {
        console.warn("⚠️ [Device Token] Errore salvataggio token:", e);
    }
}

export async function getDeviceTokensByRole(role = 'admin') {
    try {
        const tokensCol = collection(db, 'deviceTokens');
        const q = query(tokensCol, where('role', '==', role));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn("⚠️ [Device Token] Errore recupero token per ruolo:", role, e);
        return [];
    }
}

export async function getDeviceTokensByWorker(workerId) {
    if (!workerId) return [];
    try {
        const tokensCol = collection(db, 'deviceTokens');
        const q = query(tokensCol, where('workerId', '==', workerId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn("⚠️ [Device Token] Errore recupero token per lavoratore:", workerId, e);
        return [];
    }
}

export async function getAllDeviceTokens() {
    try {
        const tokensCol = collection(db, 'deviceTokens');
        const snapshot = await getDocs(tokensCol);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn("⚠️ [Device Token] Errore recupero tutti i token:", e);
        return [];
    }
}

// ==========================================
// 9. PARCO MEZZI & ATTREZZATURE (vehicles)
// ==========================================
export const DEFAULT_VEHICLES = [];

export async function getVehicles() {
    try {
        const col = collection(db, 'vehicles');
        const snapshot = await getDocs(col);
        if (snapshot.empty) return [];
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn("⚠️ [Vehicles] Errore recupero mezzi Firestore:", e);
        return [];
    }
}

export function subscribeVehicles(callback) {
    try {
        const col = collection(db, 'vehicles');
        return onSnapshot(col, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(list);
        }, (err) => {
            console.warn("⚠️ [Vehicles] Errore onSnapshot vehicles:", err);
        });
    } catch (e) {
        console.warn("⚠️ [Vehicles] Errore setup onSnapshot vehicles:", e);
        return () => {};
    }
}

export async function addVehicle(vehicleData) {
    if (isDemoBlocked(vehicleData)) {
        console.warn("🚫 [Guard Firestore] Rifiutato mezzo demo:", vehicleData.id);
        return vehicleData.id;
    }
    const docId = vehicleData.id || ("VEH_" + Date.now().toString(36).toUpperCase());
    const docRef = doc(db, 'vehicles', docId);
    const payload = { ...vehicleData, id: docId, updatedAt: new Date().toISOString() };
    await setDoc(docRef, payload, { merge: true });
    return docId;
}

export async function updateVehicle(id, vehicleData) {
    if (!id) return;
    const docRef = doc(db, 'vehicles', id);
    await updateDoc(docRef, { ...vehicleData, updatedAt: new Date().toISOString() });
}

export async function deleteVehicle(id) {
    if (!id) return;
    const docRef = doc(db, 'vehicles', id);
    await deleteDoc(docRef);
}

// ==========================================
// 10. SEGNALAZIONI GUASTI MEZZI (vehicleFaults)
// ==========================================
export async function getVehicleFaults() {
    try {
        const col = collection(db, 'vehicleFaults');
        const snapshot = await getDocs(col);
        if (snapshot.empty) return [];
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn("⚠️ [Vehicle Faults] Errore recupero guasti Firestore:", e);
        return [];
    }
}

export function subscribeVehicleFaults(callback) {
    try {
        const col = collection(db, 'vehicleFaults');
        return onSnapshot(col, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(list);
        }, (err) => {
            console.warn("⚠️ [Vehicle Faults] Errore onSnapshot vehicleFaults:", err);
        });
    } catch (e) {
        console.warn("⚠️ [Vehicle Faults] Errore setup onSnapshot vehicleFaults:", e);
        return () => {};
    }
}

export async function addVehicleFault(faultData) {
    const docId = faultData.id || ("FLT_" + Date.now().toString(36).toUpperCase());
    const docRef = doc(db, 'vehicleFaults', docId);
    const payload = {
        ...faultData,
        id: docId,
        dateReported: faultData.dateReported || new Date().toISOString().split('T')[0],
        timeReported: faultData.timeReported || new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        status: faultData.status || 'Aperta',
        photos: Array.isArray(faultData.photos) ? faultData.photos : [],
        updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
    return docId;
}

export async function updateVehicleFault(id, faultData) {
    if (!id) return;
    const docRef = doc(db, 'vehicleFaults', id);
    await updateDoc(docRef, { ...faultData, updatedAt: new Date().toISOString() });
}

export async function deleteVehicleFault(id) {
    if (!id) return;
    const docRef = doc(db, 'vehicleFaults', id);
    await deleteDoc(docRef);
}

