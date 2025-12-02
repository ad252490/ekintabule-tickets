// ============================================
// EKINTABULE TICKET VERIFICATION SYSTEM
// For third-party QR scanner apps
// ============================================

// Firebase is initialized via shared/firebase-config.js included in index.html
// The 'db' variable is defined there

// Constants
const USER_AGENT_MAX_LENGTH = 150;

// ============================================
// STATE MANAGEMENT
// ============================================

function showState(stateId) {
    // Hide all states
    const states = ['loadingState', 'validState', 'invalidState', 'usedState', 'errorState', 'noTicketState'];
    states.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
        }
    });
    
    // Show requested state
    const state = document.getElementById(stateId);
    if (state) {
        state.style.display = 'flex';
    }
}

// ============================================
// SOUND FUNCTIONS
// ============================================

function playSuccessSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        
        // Create a pleasant success tone
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.frequency.value = 523.25; // C5
        osc2.frequency.value = 659.25; // E5
        
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.log('Could not play sound:', e);
    }
}

function playErrorSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 200;
        osc.type = 'sawtooth';
        
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.log('Could not play sound:', e);
    }
}

function playWarningSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 440;
        
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
        
        // Second beep
        setTimeout(function() {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 440;
            gain2.gain.setValueAtTime(0.3, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.2);
        }, 250);
    } catch (e) {
        console.log('Could not play sound:', e);
    }
}

// ============================================
// TICKET INFO DISPLAY
// ============================================

function displayTicketInfo(elementId, ticket) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    let html = '';
    
    if (ticket.id) {
        html += '<p class="ticket-id">🎫 ' + ticket.id + '</p>';
    }
    
    html += '<p><span>💰 Price:</span> <strong>UGX ' + ((ticket.price || 10000).toLocaleString()) + '</strong></p>';
    
    if (ticket.created || ticket.createdAt) {
        const createdDate = ticket.created ? new Date(ticket.created) : 
                           (ticket.createdAt && ticket.createdAt.toDate ? ticket.createdAt.toDate() : new Date());
        html += '<p><span>📅 Created:</span> <strong>' + createdDate.toLocaleDateString() + '</strong></p>';
    }
    
    if (ticket.scannedAt) {
        const scannedDate = ticket.scannedAt.toDate ? ticket.scannedAt.toDate() : new Date(ticket.scannedAt);
        html += '<p><span>🕐 Scanned:</span> <strong>' + scannedDate.toLocaleString() + '</strong></p>';
    }
    
    if (ticket.status) {
        html += '<p><span>📋 Status:</span> <strong>' + ticket.status + '</strong></p>';
    }
    
    container.innerHTML = html;
}

// ============================================
// LOG SCAN TO FIREBASE
// ============================================

async function logScan(ticketId, result, ticketData) {
    try {
        await db.collection('scanLogs').add({
            ticketId: ticketId,
            result: result,
            ticketData: ticketData,
            scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
            device: navigator.userAgent.substring(0, USER_AGENT_MAX_LENGTH),
            scannedBy: 'verification-page'
        });
        console.log('Scan logged:', result);
    } catch (e) {
        console.error('Could not log scan:', e);
    }
}

// ============================================
// MAIN VERIFICATION FUNCTION
// ============================================

async function verifyTicket(ticketId) {
    if (!ticketId) {
        showState('noTicketState');
        return;
    }
    
    console.log('Verifying ticket:', ticketId);
    showState('loadingState');
    
    try {
        // Look up ticket in Firebase
        const ticketRef = db.collection('tickets').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc.exists) {
            // Ticket not found
            console.log('Ticket not found:', ticketId);
            playErrorSound();
            showState('invalidState');
            
            const scannedValueEl = document.getElementById('scannedValue');
            if (scannedValueEl) {
                scannedValueEl.textContent = 'Scanned: ' + ticketId;
            }
            
            await logScan(ticketId, 'INVALID', null);
            return;
        }
        
        const ticket = ticketDoc.data();
        ticket.id = ticketDoc.id;
        
        // Check if already used
        if (ticket.status === 'USED' || ticket.scanned === true || ticket.used === true) {
            console.log('Ticket already used:', ticketId);
            playWarningSound();
            showState('usedState');
            displayTicketInfo('usedTicketInfo', ticket);
            
            await logScan(ticketId, 'DUPLICATE', ticket);
            return;
        }
        
        // Valid ticket - Mark as used
        await ticketRef.update({
            status: 'USED',
            scanned: true,
            used: true,
            scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
            scannedBy: 'verification-page',
            scannedDevice: navigator.userAgent.substring(0, 100)
        });
        
        console.log('Ticket validated and marked as used:', ticketId);
        playSuccessSound();
        showState('validState');
        displayTicketInfo('validTicketInfo', ticket);
        
        // Show timestamp
        const timestampEl = document.getElementById('validTimestamp');
        if (timestampEl) {
            timestampEl.textContent = 'Verified at: ' + new Date().toLocaleString();
        }
        
        await logScan(ticketId, 'VALID', ticket);
        
    } catch (error) {
        console.error('Error verifying ticket:', error);
        playErrorSound();
        showState('errorState');
        
        const errorMsgEl = document.getElementById('errorMessage');
        if (errorMsgEl) {
            errorMsgEl.textContent = 'Error: ' + (error.message || 'Could not verify ticket');
        }
    }
}

// ============================================
// MANUAL TICKET ENTRY
// ============================================

function verifyManualTicket() {
    const input = document.getElementById('manualTicketId');
    if (input && input.value.trim()) {
        const ticketId = input.value.trim().toUpperCase();
        // Update URL with ticket parameter
        window.history.replaceState({}, '', '?ticket=' + encodeURIComponent(ticketId));
        verifyTicket(ticketId);
    }
}

// Handle enter key on manual input
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('manualTicketId');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                verifyManualTicket();
            }
        });
    }
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎫 EKINTABULE Ticket Verification Page');
    console.log('Firebase initialized:', firebase.apps.length > 0);
    
    // Get ticket ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('ticket');
    
    if (ticketId) {
        console.log('Ticket ID from URL:', ticketId);
        verifyTicket(ticketId);
    } else {
        console.log('No ticket ID provided');
        showState('noTicketState');
    }
});
