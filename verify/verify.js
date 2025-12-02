// ============================================
// TICKET VERIFICATION PAGE
// ============================================
// This page validates tickets scanned by third-party QR apps
// URL format: https://site.com/verify/?ticket=EKC-2025-0001

// Firestore instance (initialized on DOMContentLoaded)
let db = null;

// ============================================
// MAIN VERIFICATION LOGIC
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firestore
    db = getFirestore();
    
    // Parse ticket ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    let ticketId = urlParams.get('ticket');
    
    // Also check for 'id' parameter as fallback
    if (!ticketId) {
        ticketId = urlParams.get('id');
    }
    
    // If URL path contains the ticket (some QR apps may format differently)
    if (!ticketId) {
        const pathMatch = window.location.pathname.match(/EKC-\d{4}-\d{4}/i);
        if (pathMatch) {
            ticketId = pathMatch[0];
        }
    }
    
    if (!ticketId) {
        showResult('invalid', '❌', 'NO TICKET ID', 'No ticket ID found in the URL. Please scan a valid ticket QR code.');
        return;
    }
    
    // Clean up the ticket ID (remove any extra characters)
    ticketId = ticketId.trim().toUpperCase();
    
    // Validate ticket format
    if (!isValidTicketFormat(ticketId)) {
        showResult('invalid', '❌', 'INVALID FORMAT', 'The ticket ID format is not recognized. Expected format: EKC-2025-0001');
        logScan(ticketId, 'INVALID');
        return;
    }
    
    // Verify the ticket
    verifyTicket(ticketId);
});

// ============================================
// TICKET VALIDATION
// ============================================

function isValidTicketFormat(ticketId) {
    // Accept ticket ID format: EKC-YYYY-NNNN (e.g., EKC-2025-0001)
    const regex = /^EKC-\d{4}-\d{4}$/i;
    return regex.test(ticketId);
}

async function verifyTicket(ticketId) {
    showResult('loading', '⏳', 'Checking Ticket...', 'Please wait while we verify your ticket.');
    
    // Check if Firebase is available
    if (!db) {
        showResult('invalid', '❌', 'ERROR', 'Database connection not available. Please check your internet connection and try again.');
        return;
    }
    
    try {
        // Look up ticket in Firebase
        const ticketRef = db.collection('tickets').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc.exists) {
            // Ticket not found in database
            playErrorSound();
            showResult('invalid', '❌', 'INVALID TICKET', 'This ticket does not exist in the system.');
            logScan(ticketId, 'INVALID');
            return;
        }
        
        const ticket = ticketDoc.data();
        
        // Check if already used
        if (ticket.status === 'USED' || ticket.scanned === true || ticket.used === true) {
            playErrorSound();
            const scannedTime = formatScannedTime(ticket.scannedAt);
            showResult('duplicate', '⚠️', 'ALREADY USED', 
                'This ticket was already scanned' + (scannedTime ? ' on ' + scannedTime : '') + '.',
                ticket, ticketId);
            logScan(ticketId, 'DUPLICATE');
            return;
        }
        
        // Mark ticket as used
        await ticketRef.update({
            status: 'USED',
            scanned: true,
            used: true,
            scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
            scannedBy: 'verify-page',
            scannedDevice: navigator.userAgent.substring(0, 100)
        });
        
        // Success!
        playSuccessSound();
        showResult('valid', '✅', 'VALID TICKET', 'Welcome to EKINTABULE Kya Christmas!', ticket, ticketId);
        logScan(ticketId, 'VALID');
        
    } catch (error) {
        console.error('Error verifying ticket:', error);
        showResult('invalid', '❌', 'ERROR', 'Could not verify ticket. Please check your internet connection and try again.');
    }
}

// ============================================
// UI FUNCTIONS
// ============================================

function showResult(type, icon, title, message, ticketData = null, ticketId = null) {
    const resultCard = document.getElementById('resultCard');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const ticketInfo = document.getElementById('ticketInfo');
    
    // Update classes
    resultCard.className = 'result-card ' + type;
    
    // Update content
    resultIcon.textContent = icon;
    resultTitle.textContent = title;
    resultMessage.textContent = message;
    
    // Show ticket info if available
    if (ticketData && ticketId) {
        ticketInfo.style.display = 'block';
        ticketInfo.innerHTML = `
            <p><span class="label">🎫 Ticket ID:</span> <span class="value">${ticketId}</span></p>
            <p><span class="label">💰 Price:</span> <span class="value">UGX ${(ticketData.price || 10000).toLocaleString()}</span></p>
            <p><span class="label">📅 Event:</span> <span class="value">25th Dec 2025</span></p>
            <p><span class="label">📍 Venue:</span> <span class="value">Club Missouka</span></p>
        `;
    } else {
        ticketInfo.style.display = 'none';
    }
}

function formatScannedTime(scannedAt) {
    if (!scannedAt) return null;
    
    try {
        // Handle Firestore timestamp
        const date = scannedAt.toDate ? scannedAt.toDate() : new Date(scannedAt);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return null;
    }
}

// ============================================
// LOGGING
// ============================================

async function logScan(ticketId, result) {
    if (!db) return;
    
    try {
        await db.collection('scanLogs').add({
            ticketId: ticketId,
            result: result,
            scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
            device: navigator.userAgent.substring(0, 100),
            source: 'verify-page'
        });
    } catch (e) {
        console.error('Could not log scan:', e);
    }
}

// ============================================
// SOUND FUNCTIONS
// ============================================

function playSuccessSound() {
    try {
        const sound = document.getElementById('successSound');
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => {});
            return;
        }
        
        // Fallback beep using Web Audio API
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
        console.log('Could not play success sound');
    }
}

function playErrorSound() {
    try {
        const sound = document.getElementById('errorSound');
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => {});
            return;
        }
        
        // Fallback error beep
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 300;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        console.log('Could not play error sound');
    }
}
