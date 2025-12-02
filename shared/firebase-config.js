// ============================================
// FIREBASE CONFIGURATION FOR EKINTABULE TICKETS
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyCLFyj3DrojzT3WJ7adgbcR89HuMOm-V4E",
  authDomain: "ekintabule-tickets.firebaseapp.com",
  projectId: "ekintabule-tickets",
  storageBucket: "ekintabule-tickets.firebasestorage.app",
  messagingSenderId: "886000786154",
  appId: "1:886000786154:web:0e21db5eb8b5b71d5dd593"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
}

// Get Firestore database reference
let db;
if (typeof firebase !== 'undefined' && firebase.firestore) {
  db = firebase.firestore();
}

// ============================================
// TICKET FUNCTIONS (FIREBASE)
// ============================================

// Save a ticket to Firebase
async function saveTicketToFirebase(ticket) {
  try {
    await db.collection('tickets').doc(ticket.id).set({
      ...ticket,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: ticket.status || 'GENERATED',
      scanned: false,
      used: false
    });
    return true;
  } catch (error) {
    console.error('Error saving ticket to Firebase:', error);
    return false;
  }
}

// Save multiple tickets to Firebase
async function saveAllTicketsToFirebase(tickets) {
  try {
    const batch = db.batch();
    tickets.forEach(ticket => {
      const ticketRef = db.collection('tickets').doc(ticket.id);
      batch.set(ticketRef, {
        ...ticket,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: ticket.status || 'GENERATED',
        scanned: false,
        used: false
      });
    });
    await batch.commit();
    console.log(`✅ Saved ${tickets.length} tickets to Firebase`);
    return true;
  } catch (error) {
    console.error('Error saving tickets to Firebase:', error);
    return false;
  }
}

// Get ticket from Firebase
async function getTicketFromFirebase(ticketId) {
  try {
    const doc = await db.collection('tickets').doc(ticketId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting ticket from Firebase:', error);
    return null;
  }
}

// Get all tickets from Firebase
async function getAllTicketsFromFirebase() {
  try {
    const snapshot = await db.collection('tickets').orderBy('createdAt', 'desc').get();
    const tickets = [];
    snapshot.forEach(doc => {
      tickets.push({ id: doc.id, ...doc.data() });
    });
    return tickets;
  } catch (error) {
    console.error('Error getting tickets from Firebase:', error);
    return [];
  }
}

// Mark ticket as used in Firebase
async function markTicketAsUsedInFirebase(ticketId, scannedBy = 'gate') {
  try {
    await db.collection('tickets').doc(ticketId).update({
      status: 'USED',
      scanned: true,
      used: true,
      scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
      scannedBy: scannedBy
    });
    return true;
  } catch (error) {
    console.error('Error marking ticket as used:', error);
    return false;
  }
}

// Log scan to Firebase
async function logScanToFirebase(ticketId, result, ticketData = null) {
  try {
    await db.collection('scanLogs').add({
      ticketId: ticketId,
      result: result,
      ticketData: ticketData,
      scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
      device: navigator.userAgent.substring(0, 100),
      scannedBy: sessionStorage.getItem('userRole') || 'unknown'
    });
    return true;
  } catch (error) {
    console.error('Error logging scan:', error);
    return false;
  }
}

// Get scan logs from Firebase
async function getScanLogsFromFirebase(limit = 100) {
  try {
    const snapshot = await db.collection('scanLogs')
      .orderBy('scannedAt', 'desc')
      .limit(limit)
      .get();
    const logs = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    return logs;
  } catch (error) {
    console.error('Error getting scan logs:', error);
    return [];
  }
}

// Get ticket stats from Firebase
async function getStatsFromFirebase() {
  try {
    const snapshot = await db.collection('tickets').get();
    let total = 0;
    let generated = 0;
    let sold = 0;
    let used = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      total++;
      if (data.status === 'GENERATED') generated++;
      if (data.status === 'SOLD') sold++;
      if (data.status === 'USED' || data.scanned || data.used) used++;
    });
    
    return { total, generated, sold, used };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { total: 0, generated: 0, sold: 0, used: 0 };
  }
}

console.log('✅ Firebase config loaded for ekintabule-tickets');
