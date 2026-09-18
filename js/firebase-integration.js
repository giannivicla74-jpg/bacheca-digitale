import { auth } from './firebase-config.js';
import { 
    isDemoBlocked,
    getWorkers, 
    addWorker, 
    updateWorker, 
    deleteWorker, 
    subscribeWorkers,
    getNotices, 
    addNotice, 
    updateNotice, 
    deleteNotice, 
    subscribeNotices,
    getPayslips, 
    addPayslip, 
    updatePayslip, 
    deletePayslip, 
    subscribePayslips,
    getLeaveRequests, 
    addLeaveRequest, 
    updateLeaveRequest, 
    deleteLeaveRequest,
    subscribeLeaveRequests,
    getNotifications,
    addNotification as addNotificationCloud,
    updateNotification as updateNotificationCloud,
    deleteNotification as deleteNotificationCloud,
    subscribeNotifications,
    markNotificationsAsReadInCloud,
    registerDeviceToken,
    getDeviceTokensByRole,
    getDeviceTokensByWorker,
    getAllDeviceTokens,
    DEFAULT_VEHICLES,
    getVehicles,
    subscribeVehicles,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicleFaults,
    subscribeVehicleFaults,
    addVehicleFault,
    updateVehicleFault,
    deleteVehicleFault,
    getCompanyProfile,
    saveCompanyProfile,
    subscribeCompanyProfile
} from './database.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { parseMultiPayslipPDF, splitAndGenerateBase64 } from './pdf-splitter.js';

window.parseMultiPayslipPDF = parseMultiPayslipPDF;
window.splitAndGenerateBase64 = splitAndGenerateBase64;

// Tracciamento dei listener Real-time
let realtimeUnsubscribers = [];
let previousLeaveRequests = [];
let previousNotifications = [];
let previousVehicleFaults = [];

// Helper per sincronizzare in-place l'array globale preservando i riferimenti lessicali
function syncArrayInPlace(targetArray, newItems) {
    if (Array.isArray(targetArray)) {
        targetArray.splice(0, targetArray.length, ...newItems);
        return targetArray;
    }
    return newItems;
}

// Esponiamo le funzioni database anche a livello globale per uso e collaudo
window.viclaCloudDB = {
    getWorkers, addWorker, updateWorker, deleteWorker, subscribeWorkers,
    getNotices, addNotice, updateNotice, deleteNotice, subscribeNotices,
    getPayslips, addPayslip, updatePayslip, deletePayslip, subscribePayslips,
    getLeaveRequests, addLeaveRequest, updateLeaveRequest, deleteLeaveRequest, subscribeLeaveRequests,
    getNotifications, addNotificationCloud, updateNotificationCloud, deleteNotificationCloud, subscribeNotifications,
    getVehicles, addVehicle, updateVehicle, deleteVehicle, subscribeVehicles,
    getVehicleFaults, addVehicleFault, updateVehicleFault, deleteVehicleFault, subscribeVehicleFaults,
    getCompanyProfile, saveCompanyProfile, subscribeCompanyProfile,
    markNotificationsAsReadInCloud,
    setupRealtimeCloudSubscriptions,
    stopRealtimeCloudSubscriptions: () => {
        realtimeUnsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
        realtimeUnsubscribers = [];
        window.isCloudRealtimeActive = false;
    }
};

// ==========================================
// FIREBASE INTEGRATION LAYER (Real-time Cloud Sync)
// ==========================================

console.log("🚀 [Firebase] Inizializzazione sincronizzazione completa Cloud Firestore...");

async function loadDataFromCloud() {
    try {
        console.log("📥 [Firebase] Scaricamento dati completi dal Cloud...");
        const [cloudWorkers, cloudNotices, cloudPayslips, cloudLeaves, cloudNotifs, cloudVehicles, cloudFaults, cloudProfile] = await Promise.all([
            getWorkers().catch(e => { console.warn("Errore getWorkers:", e); return []; }),
            getNotices().catch(e => { console.warn("Errore getNotices:", e); return []; }),
            getPayslips().catch(e => { console.warn("Errore getPayslips:", e); return []; }),
            getLeaveRequests().catch(e => { console.warn("Errore getLeaveRequests:", e); return []; }),
            getNotifications().catch(e => { console.warn("Errore getNotifications:", e); return []; }),
            getVehicles().catch(e => { console.warn("Errore getVehicles:", e); return []; }),
            getVehicleFaults().catch(e => { console.warn("Errore getVehicleFaults:", e); return []; }),
            getCompanyProfile().catch(e => { console.warn("Errore getCompanyProfile:", e); return null; })
        ]);

        // 1. LAVORATORI: Se presenti nel cloud, aggiorna cache locale. Se cloud vuoto ma locale presente, fai push al cloud!
        if (cloudWorkers && cloudWorkers.length > 0) {
            const cleanWorkers = cloudWorkers.map(w => {
                if (typeof window.normalizeWorker === 'function') {
                    return window.normalizeWorker(w);
                }
                if (!w.surname && w.name) {
                    const parts = w.name.trim().split(/\s+/);
                    if (parts.length > 1) {
                        w.surname = parts[0];
                        w.name = parts.slice(1).join(' ');
                    } else {
                        w.surname = w.name.trim();
                        w.name = '';
                    }
                }
                if (!w.department) w.department = 'Produzione';
                if (!w.category) w.category = w.role || 'Operaio';
                return w;
            });
            window.workers = syncArrayInPlace(window.workers, cleanWorkers);
            localStorage.setItem('vicla_workers', JSON.stringify(window.workers));
            console.log(`✅ [Firebase] ${cleanWorkers.length} lavoratori sincronizzati dal cloud.`);
        } else {
            // Cloud non ha ancora lavoratori: verifica se l'utente ne ha inseriti in locale e salvali nel cloud!
            try {
                const localWorkers = (window.workers && window.workers.length > 0) 
                    ? window.workers 
                    : JSON.parse(localStorage.getItem('vicla_workers') || '[]');
                if (localWorkers.length > 0) {
                    console.log(`☁️ [Firebase] Caricamento di ${localWorkers.length} lavoratori locali nel Cloud...`);
                    for (const lw of localWorkers) {
                        if (lw && lw.name) {
                            await addWorker(lw).catch(e => console.warn("Errore upload worker locale:", e));
                        }
                    }
                }
            } catch(e) {
                console.warn("Errore recupero workers locali:", e);
            }
        }

        // 2. COMUNICAZIONI AZIENDALI
        if (cloudNotices && cloudNotices.length > 0) {
            window.notices = syncArrayInPlace(window.notices, cloudNotices);
            localStorage.setItem('vicla_notices', JSON.stringify(window.notices));
        }

        // 3. BUSTE PAGA
        if (cloudPayslips && cloudPayslips.length > 0) {
            window.payslips = syncArrayInPlace(window.payslips, cloudPayslips);
            localStorage.setItem('vicla_payslips', JSON.stringify(window.payslips));
        }

        // 4. RICHIESTE PERMESSI & FERIE
        if (cloudLeaves && cloudLeaves.length > 0) {
            cloudLeaves.forEach(cl => {
                const local = (window.leaveRequests || []).find(lr => lr.id === cl.id);
                if (local && local.archived !== undefined && cl.archived === undefined) {
                    cl.archived = local.archived;
                }
            });
            previousLeaveRequests = JSON.parse(JSON.stringify(cloudLeaves));
            window.leaveRequests = syncArrayInPlace(window.leaveRequests, cloudLeaves);
            localStorage.setItem('vicla_leave_requests', JSON.stringify(window.leaveRequests));
        }

        // 5. NOTIFICHE PUSH & DRAWER
        if (cloudNotifs && cloudNotifs.length > 0) {
            const cleanNotifs = cloudNotifs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            previousNotifications = JSON.parse(JSON.stringify(cleanNotifs));
            window.notifications = syncArrayInPlace(window.notifications, cleanNotifs);
            localStorage.setItem('vicla_notifications', JSON.stringify(window.notifications));
        }

        // 6. PARCO MEZZI & ATTREZZATURE
        if (cloudVehicles && cloudVehicles.length > 0) {
            window.vehicles = syncArrayInPlace(window.vehicles, cloudVehicles);
            localStorage.setItem('vicla_vehicles', JSON.stringify(window.vehicles));
        }

        // 7. SEGNALAZIONI GUASTI MEZZI
        if (cloudFaults && cloudFaults.length > 0) {
            const sortedFaults = cloudFaults.sort((a, b) => new Date(b.dateReported + ' ' + (b.timeReported || '00:00')) - new Date(a.dateReported + ' ' + (a.timeReported || '00:00')));
            previousVehicleFaults = JSON.parse(JSON.stringify(sortedFaults));
            window.vehicleFaults = syncArrayInPlace(window.vehicleFaults, sortedFaults);
            localStorage.setItem('vicla_vehicle_faults', JSON.stringify(window.vehicleFaults));
        }

        // 8. PROFILO AZIENDALE DINAMICO (Sincronizzazione Multi-Device PC <-> Mobile)
        if (cloudProfile && cloudProfile.name) {
            console.log("🏢 [Firebase] Profilo aziendale caricato dal cloud:", cloudProfile.name);
            localStorage.setItem('bacheca_company_profile', JSON.stringify(cloudProfile));
            localStorage.setItem('bacheca_company_configured', 'true');
            if (typeof window.applyCompanyProfileToHeader === 'function') {
                window.applyCompanyProfileToHeader(cloudProfile);
            }
            if (typeof window.closeCompanyRegistrationModal === 'function') {
                window.closeCompanyRegistrationModal();
            }
        } else {
            try {
                const localProfile = JSON.parse(localStorage.getItem('bacheca_company_profile') || 'null');
                if (localProfile && localProfile.name) {
                    console.log("☁️ [Firebase] Caricamento profilo aziendale locale nel cloud...");
                    await saveCompanyProfile(localProfile).catch(() => {});
                }
            } catch(e) {}
        }

        // Aggiorna tutti i componenti dell'interfaccia
        refreshAllInterfaceComponents();

        console.log("✅ [Firebase] Sincronizzazione iniziale completata! Avvio Real-time listener...");
        setupRealtimeCloudSubscriptions();

    } catch (e) {
        console.error("❌ [Firebase] Errore nel caricamento dal cloud:", e);
    }
}

function refreshAllInterfaceComponents() {
    if (typeof window.renderWorkersTable === 'function') window.renderWorkersTable();
    if (typeof window.renderDepartmentAnalytics === 'function') window.renderDepartmentAnalytics();
    if (typeof window.renderAdminPayslipsTab === 'function') window.renderAdminPayslipsTab();
    if (typeof window.renderAdminRequestsTab === 'function') window.renderAdminRequestsTab();
    if (typeof window.renderAdminDashboard === 'function') window.renderAdminDashboard();
    if (typeof window.renderNoticeTrackingDetails === 'function') window.renderNoticeTrackingDetails();
    if (typeof window.populateWorkerSelect === 'function') window.populateWorkerSelect();
    if (typeof window.renderNotificationsDrawer === 'function') window.renderNotificationsDrawer();
    if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();

    // Aggiorna componenti veicoli e guasti
    if (typeof window.renderVehicleFleetTab === 'function') window.renderVehicleFleetTab();
    if (typeof window.populateVehicleSelect === 'function') window.populateVehicleSelect();

    if (window.isWorkerAuthenticated || window.selectedWorkerId) {
        if (typeof window.updateWorkerDashboardResidueValues === 'function') window.updateWorkerDashboardResidueValues();
        if (typeof window.renderWorkerNotices === 'function') window.renderWorkerNotices();
        if (typeof window.renderWorkerPayslips === 'function') window.renderWorkerPayslips();
        if (typeof window.renderWorkerRequestsArea === 'function') window.renderWorkerRequestsArea();
        if (typeof window.renderWorkerVehicleFaults === 'function') window.renderWorkerVehicleFaults();
    }
}

// ==========================================
// ASCOLTO REATTIVO REAL-TIME (onSnapshot)
// ==========================================
function setupRealtimeCloudSubscriptions() {
    console.log("⚡ [Firebase Realtime] Attivazione listener onSnapshot bidirezionali...");
    
    // Reset eventuali listener attivi
    realtimeUnsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
    realtimeUnsubscribers = [];

    // 1. LAVORATORI IN TEMPO REALE
    const unsubWorkers = subscribeWorkers((cloudWorkers) => {
        if (!Array.isArray(cloudWorkers)) return;
        const cleanWorkers = cloudWorkers.filter(w => !isDemoBlocked(w)).map(w => {
            if (typeof window.normalizeWorker === 'function') return window.normalizeWorker(w);
            return w;
        });
        window.workers = syncArrayInPlace(window.workers, cleanWorkers);
        localStorage.setItem('vicla_workers', JSON.stringify(window.workers));
        
        if (typeof window.renderWorkersTable === 'function') window.renderWorkersTable();
        if (typeof window.renderDepartmentAnalytics === 'function') window.renderDepartmentAnalytics();
        if (typeof window.populateWorkerSelect === 'function') window.populateWorkerSelect();
        if (typeof window.renderAdminDashboard === 'function') window.renderAdminDashboard();
        if (typeof window.updateWorkerDashboardResidueValues === 'function') {
            window.updateWorkerDashboardResidueValues();
        }
    });
    realtimeUnsubscribers.push(unsubWorkers);

    // 2. COMUNICAZIONI AZIENDALI IN TEMPO REALE
    const unsubNotices = subscribeNotices((cloudNotices) => {
        if (!Array.isArray(cloudNotices)) return;
        const cleanNotices = cloudNotices.filter(n => !isDemoBlocked(n));
        window.notices = syncArrayInPlace(window.notices, cleanNotices);
        localStorage.setItem('vicla_notices', JSON.stringify(window.notices));

        if (typeof window.renderAdminDashboard === 'function') window.renderAdminDashboard();
        if (typeof window.renderNoticeTrackingDetails === 'function') window.renderNoticeTrackingDetails();
        if (typeof window.renderWorkerNotices === 'function') window.renderWorkerNotices();
    });
    realtimeUnsubscribers.push(unsubNotices);

    // 3. BUSTE PAGA IN TEMPO REALE (Firme degli operai e pubblicazioni Admin)
    const unsubPayslips = subscribePayslips((cloudPayslips) => {
        if (!Array.isArray(cloudPayslips)) return;
        const cleanPayslips = cloudPayslips.filter(p => !isDemoBlocked(p));
        window.payslips = syncArrayInPlace(window.payslips, cleanPayslips);
        localStorage.setItem('vicla_payslips', JSON.stringify(window.payslips));

        if (typeof window.renderAdminPayslipsTab === 'function') window.renderAdminPayslipsTab();
        if (typeof window.renderWorkerPayslips === 'function') window.renderWorkerPayslips();
        if (typeof window.renderAdminDashboard === 'function') window.renderAdminDashboard();
    });
    realtimeUnsubscribers.push(unsubPayslips);

    // 4. RICHIESTE PERMESSI & FERIE IN TEMPO REALE (Notifica e conferma immediata all'operaio e avviso Admin)
    const unsubLeaves = subscribeLeaveRequests((cloudLeaves) => {
        if (!Array.isArray(cloudLeaves)) return;
        const cleanLeaves = cloudLeaves.filter(r => !isDemoBlocked(r));
        
        // A) Verifica transizione di stato per l'operaio attualmente connesso (Approvazione / Rifiuto)
        // CRITICO: Eseguito SOLO se è attiva una sessione operaio/dipendente e NON l'Admin!
        const isWorkerSession = (window.currentRole === 'operaio' || window.currentRole === 'dipendente') && !window.isAdminAuthenticated;
        const currentWorkerId = isWorkerSession ? window.selectedWorkerId : null;
        if (currentWorkerId && previousLeaveRequests.length > 0) {
            cleanLeaves.forEach(newReq => {
                if (newReq.workerId === currentWorkerId) {
                    const oldReq = previousLeaveRequests.find(r => r.id === newReq.id);
                    if (oldReq && oldReq.status !== newReq.status && (newReq.status === 'Approvata' || newReq.status === 'Rifiutata')) {
                        const icon = newReq.status === 'Approvata' ? '✅' : '❌';
                        const toastType = newReq.status === 'Approvata' ? 'success' : 'error';
                        if (typeof window.showToast === 'function') {
                            window.showToast(`${icon} La tua richiesta di ${newReq.leaveType || 'permesso'} è stata ${newReq.status.toUpperCase()} dalla Direzione!`, toastType);
                        }
                    }
                }
            });
        }

        // B) Notifica visiva immediata per l'Amministratore quando un lavoratore invia una nuova richiesta
        const isAdmin = (window.currentRole === 'admin' || window.isAdminAuthenticated);
        if (isAdmin && previousLeaveRequests.length > 0) {
            cleanLeaves.forEach(newReq => {
                const alreadyPresent = previousLeaveRequests.some(r => r.id === newReq.id);
                if (!alreadyPresent && newReq.status === 'In attesa') {
                    const reqWorker = (window.workers || []).find(w => w.id === newReq.workerId);
                    const workerName = reqWorker ? `${reqWorker.surname} ${reqWorker.name}` : (newReq.workerId || 'Lavoratore');
                    if (typeof window.showToast === 'function') {
                        window.showToast(`📩 Nuova richiesta ${newReq.leaveType || 'ferie/permessi'} inviata da ${workerName}`, "info");
                    }
                }
            });
        }

        previousLeaveRequests = JSON.parse(JSON.stringify(cleanLeaves));

        window.leaveRequests = syncArrayInPlace(window.leaveRequests, cleanLeaves);
        localStorage.setItem('vicla_leave_requests', JSON.stringify(window.leaveRequests));

        if (typeof window.renderAdminRequestsTab === 'function') window.renderAdminRequestsTab();
        if (typeof window.renderWorkerRequestsArea === 'function') window.renderWorkerRequestsArea();
        if (typeof window.renderAdminDashboard === 'function') window.renderAdminDashboard();
        if (typeof window.updateWorkerDashboardResidueValues === 'function') {
            window.updateWorkerDashboardResidueValues();
        }
    });
    realtimeUnsubscribers.push(unsubLeaves);

    // 5. NOTIFICHE PUSH & DRAWER IN TEMPO REALE
    const unsubNotifs = subscribeNotifications((cloudNotifs) => {
        if (!Array.isArray(cloudNotifs)) return;
        const cleanNotifs = cloudNotifs.filter(n => !isDemoBlocked(n));
        const sortedNotifs = cleanNotifs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        // Alert immediato all'utente connesso (Admin o Operaio) se riceve una nuova notifica dal cloud
        if (previousNotifications.length > 0) {
            sortedNotifs.forEach(n => {
                const isForMe = (typeof window.isNotificationForCurrentUser === 'function')
                    ? window.isNotificationForCurrentUser(n)
                    : ((window.currentRole === 'admin' && (n.workerId === 'ADMIN' || n.workerId === 'ALL')) ||
                       (window.selectedWorkerId && (n.workerId === window.selectedWorkerId || n.workerId === 'ALL')));

                if (!n.read && isForMe) {
                    const alreadyPresent = previousNotifications.some(p => p.id === n.id);
                    if (!alreadyPresent) {
                        if (typeof window.showToast === 'function') {
                            window.showToast(`🔔 ${n.title}: ${n.message}`, "info");
                        }
                        if (typeof window.dispatchBrowserPushNotification === 'function') {
                            window.dispatchBrowserPushNotification(n.title, n.message, n.targetTab || 'notices');
                        }
                    }
                }
            });
        }
        previousNotifications = JSON.parse(JSON.stringify(sortedNotifs));

        window.notifications = syncArrayInPlace(window.notifications, sortedNotifs);
        localStorage.setItem('vicla_notifications', JSON.stringify(window.notifications));

        if (typeof window.renderNotificationsDrawer === 'function') window.renderNotificationsDrawer();
        if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();
    });
    realtimeUnsubscribers.push(unsubNotifs);

    // 6. PARCO MEZZI IN TEMPO REALE
    const unsubVehicles = subscribeVehicles((cloudVehicles) => {
        if (!Array.isArray(cloudVehicles)) return;
        const cleanVehicles = cloudVehicles.filter(v => !isDemoBlocked(v));
        window.vehicles = syncArrayInPlace(window.vehicles, cleanVehicles);
        localStorage.setItem('vicla_vehicles', JSON.stringify(window.vehicles));
        if (typeof window.renderVehicleFleetTab === 'function') window.renderVehicleFleetTab();
        if (typeof window.populateVehicleSelect === 'function') window.populateVehicleSelect();
    });
    realtimeUnsubscribers.push(unsubVehicles);

    // 7. SEGNALAZIONI GUASTI MEZZI IN TEMPO REALE
    const unsubFaults = subscribeVehicleFaults((cloudFaults) => {
        if (!Array.isArray(cloudFaults)) return;
        const sortedFaults = cloudFaults.sort((a, b) => new Date(b.dateReported + ' ' + (b.timeReported || '00:00')) - new Date(a.dateReported + ' ' + (a.timeReported || '00:00')));

        // Notifica immediata se c'è un nuovo guasto
        if (previousVehicleFaults.length > 0) {
            sortedFaults.forEach(nf => {
                const alreadyThere = previousVehicleFaults.some(pf => pf.id === nf.id);
                if (!alreadyThere) {
                    const isAdmin = (window.currentRole === 'admin' || window.isAdminAuthenticated);
                    if (isAdmin) {
                        const icon = nf.severity === 'ALTA' ? '🚨' : (nf.severity === 'MEDIA' ? '⚠️' : '🔧');
                        if (typeof window.showToast === 'function') {
                            window.showToast(`${icon} NUOVO GUASTO: ${nf.vehicleName} (${nf.severity}) segnalato da ${nf.workerName}`, "warning");
                        }
                        if (typeof window.dispatchBrowserPushNotification === 'function') {
                            window.dispatchBrowserPushNotification(
                                `${icon} Segnalazione Guasto: ${nf.vehicleName}`,
                                `${nf.workerName} (${nf.cantiere || 'Cantiere'}): ${nf.description || 'Nessuna nota'}`,
                                'vehicles'
                            );
                        }
                    }
                }
            });
        }
        previousVehicleFaults = JSON.parse(JSON.stringify(sortedFaults));

        window.vehicleFaults = syncArrayInPlace(window.vehicleFaults, sortedFaults);
        localStorage.setItem('vicla_vehicle_faults', JSON.stringify(window.vehicleFaults));

        if (typeof window.renderVehicleFleetTab === 'function') window.renderVehicleFleetTab();
        if (typeof window.renderWorkerVehicleFaults === 'function') window.renderWorkerVehicleFaults();
    });
    realtimeUnsubscribers.push(unsubFaults);

    // 8. PROFILO AZIENDALE IN TEMPO REALE
    const unsubProfile = subscribeCompanyProfile((profile) => {
        if (!profile || !profile.name) return;
        console.log("🏢 [Firebase Realtime] Profilo aziendale aggiornato dal cloud:", profile.name);
        localStorage.setItem('bacheca_company_profile', JSON.stringify(profile));
        localStorage.setItem('bacheca_company_configured', 'true');
        if (typeof window.applyCompanyProfileToHeader === 'function') {
            window.applyCompanyProfileToHeader(profile);
        }
        if (typeof window.closeCompanyRegistrationModal === 'function') {
            window.closeCompanyRegistrationModal();
        }
    });
    realtimeUnsubscribers.push(unsubProfile);

    window.isCloudRealtimeActive = true;
    console.log("⚡ [Firebase Realtime] Tutti i listener onSnapshot attivi e sincronizzati!");
}

// ==========================================
// PATCH INTERCETTORI AZIONI UI -> CLOUD
// ==========================================

// 1. PATCH ANAGRAFICA LAVORATORI
const originalSaveNewWorker = window.saveNewWorker;
window.saveNewWorker = async function() {
    let created = null;
    if (typeof originalSaveNewWorker === 'function') {
        created = originalSaveNewWorker();
    }
    const newWorker = created || (window.workers && window.workers.length > 0 ? window.workers[window.workers.length - 1] : null);
    if (newWorker && newWorker.id) {
        try {
            await addWorker(newWorker);
            console.log("Nuovo lavoratore salvato in cloud:", newWorker.id);
            if (newWorker.matricola && newWorker.pin) {
                const email = newWorker.matricola.toLowerCase() + "@vicla.it";
                const password = newWorker.pin + "vicla";
                await createUserWithEmailAndPassword(auth, email, password).catch(e => console.log("User Auth already exists", e));
            }
        } catch(e) {
            console.error("Errore salvataggio nuovo lavoratore in cloud:", e);
        }
    }
    return newWorker;
};

window.triggerSaveEditedWorkerToCloud = async function(updatedWorker) {
    try {
        await updateWorker(updatedWorker.id, updatedWorker);
        console.log("Lavoratore aggiornato in cloud:", updatedWorker.id);
    } catch(e) {
        console.error("Errore aggiornamento lavoratore in cloud:", e);
    }
};

const originalConfirmDeleteWorker = window.confirmDeleteWorker;
window.confirmDeleteWorker = function(workerId) {
    const originalCallback = window.showConfirmDialog;
    window.showConfirmDialog = function(title, message, callbackYes) {
        originalCallback(title, message, async function() {
            callbackYes();
            await deleteWorker(workerId).catch(err => console.error("Errore cancellazione worker in cloud:", err));
        });
    };
    if (typeof originalConfirmDeleteWorker === 'function') {
        originalConfirmDeleteWorker(workerId);
    }
    window.showConfirmDialog = originalCallback;
};

const originalUpdateWorkerBalanceInline = window.updateWorkerBalanceInline;
window.updateWorkerBalanceInline = async function(workerId, type, value) {
    if (typeof originalUpdateWorkerBalanceInline === 'function') {
        originalUpdateWorkerBalanceInline(workerId, type, value);
    }
    const w = window.workers.find(wk => wk.id === workerId);
    if (w) await updateWorker(workerId, w).catch(err => console.error(err));
};

const originalUpdateWorkerLevelInline = window.updateWorkerLevelInline;
window.updateWorkerLevelInline = async function(workerId, value) {
    if (typeof originalUpdateWorkerLevelInline === 'function') {
        originalUpdateWorkerLevelInline(workerId, value);
    }
    const w = window.workers.find(wk => wk.id === workerId);
    if (w) await updateWorker(workerId, w).catch(err => console.error(err));
};

// 2. PATCH COMUNICAZIONI AZIENDALI
const originalHandleCreateNotice = window.handleCreateNotice;
window.handleCreateNotice = async function(event) {
    if (typeof originalHandleCreateNotice === 'function') {
        originalHandleCreateNotice(event);
    }
    setTimeout(async () => {
        const newNotice = window.notices[window.notices.length - 1];
        if (newNotice) await addNotice(newNotice).catch(e => console.error("Errore addNotice cloud:", e));
    }, 500);
};

const originalSignNotice = window.signNotice;
window.signNotice = async function(noticeId) {
    if (typeof originalSignNotice === 'function') {
        originalSignNotice(noticeId);
    }
    const n = window.notices.find(nt => nt.id === noticeId);
    if (n) await updateNotice(noticeId, n).catch(e => console.error("Errore updateNotice cloud:", e));
};

// 3. PATCH RICHIESTE PERMESSI & FERIE
const originalHandleCreateLeaveRequest = window.handleCreateLeaveRequest;
window.handleCreateLeaveRequest = async function(e) {
    if (typeof originalHandleCreateLeaveRequest === 'function') {
        originalHandleCreateLeaveRequest(e);
    }
    const newReq = window.leaveRequests[window.leaveRequests.length - 1];
    if (newReq) {
        await addLeaveRequest(newReq).catch(err => console.error("Errore addLeaveRequest cloud:", err));
        console.log("☁️ [Firebase] Nuova richiesta inserita in Cloud Firestore:", newReq.id);
        
        // Inoltro Push Notification ai dispositivi dei Responsabili
        const workerObj = (window.workers || []).find(w => w.id === newReq.workerId);
        const workerDisplayName = workerObj ? `${workerObj.surname} ${workerObj.name}` : (newReq.workerId || 'Collaboratore');
        sendPushToManagers({
            title: `Nuova Richiesta ${newReq.leaveType || 'Permesso'}`,
            body: `${workerDisplayName}: richiesta per il ${newReq.datePermesso} (${newReq.hoursNum} ore). Tocca per elaborare.`,
            targetTab: 'requests'
        }).catch(err => console.warn("Errore sendPushToManagers:", err));
    }
};

const originalSaveAndApproveRequest = window.saveAndApproveRequest;
window.saveAndApproveRequest = async function(newStatus) {
    const reqId = window.selectedRequestIdForElaboration;
    if (typeof originalSaveAndApproveRequest === 'function') {
        originalSaveAndApproveRequest(newStatus);
    }
    const req = window.leaveRequests ? window.leaveRequests.find(r => r.id === reqId) : null;
    if (req) {
        await updateLeaveRequest(reqId, req).catch(err => console.error("Errore updateLeaveRequest cloud:", err));
        console.log("☁️ [Firebase] Richiesta elaborata e sincronizzata in Firestore:", reqId, req.status);

        // Inoltro Push Notification al dispositivo dell'operaio specifico
        sendPushToWorker(req.workerId, {
            title: `Richiesta ${req.leaveType || 'Permesso'} ${newStatus.toUpperCase()}`,
            body: `La tua richiesta per il ${req.datePermesso} è stata ${newStatus.toLowerCase()} dalla Direzione.`,
            targetTab: 'requests'
        }).catch(err => console.warn("Errore sendPushToWorker:", err));
    }
    
    if (newStatus === 'Approvata' && req) {
        const w = window.workers ? window.workers.find(wk => wk.id === req.workerId) : null;
        if (w) {
            await updateWorker(w.id, w).catch(err => console.error("Errore updateWorker balance cloud:", err));
            console.log("☁️ [Firebase] Monte ore aggiornato in Firestore per dipendente:", w.id);
        }
    }
};

// 4. PATCH BUSTE PAGA (Firma Digitale & Upload)
// La sincronizzazione (add, delete, update firmata) è ora gestita esplicitamente in index.html
// chiamando window.viclaCloudDB.addPayslip, deletePayslip, updatePayslip nei punti esatti in cui il dato è pronto.


// 5. PATCH NOTIFICHE PUSH & DRAWER (v2.4.0)
const originalAddNotification = window.addNotification;
window.addNotification = function(notifParams) {
    let createdNotif = null;
    if (typeof originalAddNotification === 'function') {
        createdNotif = originalAddNotification(notifParams);
    }
    if (createdNotif) {
        addNotificationCloud(createdNotif).catch(e => console.error("Errore salvataggio notifica Cloud:", e));
        console.log("☁️ [Firebase] Notifica sincronizzata in Firestore:", createdNotif.id);
    }
    return createdNotif;
};

const originalMarkAllNotificationsAsRead = window.markAllNotificationsAsRead;
window.markAllNotificationsAsRead = async function() {
    const userNotifs = (typeof window.getFilteredNotificationsForCurrentUser === 'function') 
        ? window.getFilteredNotificationsForCurrentUser() 
        : (window.notifications || []);
    const ids = userNotifs.map(n => n.id);
    if (typeof originalMarkAllNotificationsAsRead === 'function') {
        originalMarkAllNotificationsAsRead();
    }
    if (ids.length > 0) {
        markNotificationsAsReadInCloud(ids).catch(e => console.error("Errore mark read Cloud:", e));
        console.log("☁️ [Firebase] Notifiche segnate lette su Firestore:", ids.length);
    }
};

// 6. GESTIONE TOKEN DISPOSITIVO PER NOTIFICHE PUSH A SCHERMO SPENTO (FCM)
export async function syncDevicePushSubscription(role, workerId) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    if (!('serviceWorker' in navigator)) {
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        let tokenStr = null;

        if (registration.pushManager) {
            let sub = await registration.pushManager.getSubscription();
            if (!sub) {
                try {
                    sub = await registration.pushManager.subscribe({
                        userVisibleOnly: true
                    });
                } catch (subErr) {
                    console.warn("⚠️ [FCM/Push] Registrazione PushManager standard:", subErr.message);
                }
            }
            if (sub) {
                tokenStr = JSON.stringify(sub);
            }
        }

        if (!tokenStr) {
            tokenStr = "DEV_" + (workerId || role || 'ADMIN') + "_" + btoa(navigator.userAgent.slice(0, 40)).replace(/[^a-zA-Z0-9]/g, '');
        }

        const effectiveRole = role || (window.currentRole === 'admin' ? 'admin' : 'worker');
        const effectiveWorkerId = workerId || (window.selectedWorkerId || (effectiveRole === 'admin' ? 'ADMIN' : 'ALL'));

        await registerDeviceToken({
            token: tokenStr,
            role: effectiveRole,
            workerId: effectiveWorkerId,
            userAgent: navigator.userAgent
        });
        console.log("📲 [FCM/Push] Dispositivo registrato per notifiche push a schermo spento:", effectiveRole, effectiveWorkerId);
    } catch(err) {
        console.warn("⚠️ [FCM/Push] Errore sincronizzazione sottoscrizione push:", err);
    }
}
window.syncDevicePushSubscription = syncDevicePushSubscription;

// 7. INOLTRO PUSH VERSO I RESPONSABILI O VERSO IL SINGOLO OPERAIO
export async function sendPushToManagers({ title, body, targetTab = 'requests' }) {
    console.log("📲 [FCM/Push] Inoltro push ai dispositivi dei Responsabili...", title);
    try {
        const adminTokens = await getDeviceTokensByRole('admin');
        console.log(`📲 [FCM/Push] Dispositivi responsabili censiti: ${adminTokens.length}`, adminTokens.map(d => d.deviceName || d.id));

        // Se siamo sul client o su server, inoltra all'endpoint push
        try {
            await fetch('/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients: 'admin',
                    tokens: adminTokens,
                    title: title,
                    body: body,
                    targetTab: targetTab
                })
            });
        } catch (netErr) {
            // Se offline o server non risponde, continua senza bloccare l'interfaccia
        }

        // Se il client aperto è un responsabile, emetti anche la notifica locale
        const isCurrentAdmin = (window.currentRole === 'admin' || window.isAdminAuthenticated);
        if (isCurrentAdmin && typeof window.dispatchBrowserPushNotification === 'function') {
            window.dispatchBrowserPushNotification(title, body, targetTab);
        }

        return adminTokens;
    } catch (err) {
        console.warn("⚠️ [FCM/Push] Errore inoltro ai responsabili:", err);
        return [];
    }
}
window.sendPushToManagers = sendPushToManagers;

export async function sendPushToWorker(workerId, { title, body, targetTab = 'requests' }) {
    if (!workerId) return [];
    console.log(`📲 [FCM/Push] Inoltro push all'operaio ${workerId}...`, title);
    try {
        const workerTokens = await getDeviceTokensByWorker(workerId);
        console.log(`📲 [FCM/Push] Dispositivi registrati per operaio ${workerId}: ${workerTokens.length}`);

        try {
            await fetch('/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients: workerId,
                    tokens: workerTokens,
                    title: title,
                    body: body,
                    targetTab: targetTab
                })
            });
        } catch (netErr) {}

        // Se l'operaio è attualmente visualizzato sul client locale
        if (window.selectedWorkerId === workerId && typeof window.dispatchBrowserPushNotification === 'function') {
            window.dispatchBrowserPushNotification(title, body, targetTab);
        }

        return workerTokens;
    } catch (err) {
        console.warn("⚠️ [FCM/Push] Errore inoltro all'operaio:", err);
        return [];
    }
}
window.sendPushToWorker = sendPushToWorker;
window.getAllDeviceTokens = getAllDeviceTokens;

// Caricamento dati iniziale
async function initializeCloudSync() {
    await loadDataFromCloud();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        syncDevicePushSubscription(window.currentRole, window.selectedWorkerId);
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializeCloudSync);
} else {
    initializeCloudSync();
}

