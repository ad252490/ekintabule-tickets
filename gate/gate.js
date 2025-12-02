// Firebase configuration - Replace with your actual config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID. appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase. initializeApp(firebaseConfig);
const db = firebase.firestore();

// DOM Elements
const resultSection = document.getElementById('resultSection');
const resultIcon = document.getElementById('resultIcon');
const resultMessage = document.getElementById('resultMessage');
const ticketDetails = document.getElementById('ticketDetails');
const loadingSection = document.getElementById('loading');
const manualInput = document.getElementById('manualInput');
const totalTickets = document. getElementById('totalTickets');
const usedTickets = document.getElementById('usedTickets');
const remainingTickets = document.getElementById('remainingTickets');

let html5QrcodeScanner = null;

// Initialize QR Scanner
function initScanner() {
    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1. 0
        },
        false
    );
    
    html5QrcodeScanner. render(onScanSuccess, onScanFailure);
}

// Handle successful scan
function onScanSuccess(decodedText, decodedResult) {
    // Play a beep sound
    playBeep();
    
    // Pause scanner while processing
    html5QrcodeScanner.pause();
    
    // Validate the ticket
    validateTicket(decodedText);
}

// Handle scan failure (usually just means no QR code detected yet)
function onScanFailure(error) {
    // Silently ignore - this fires continuously when no QR code is in view
}

// Manual ticket entry
function checkManualTicket() {
    const ticketId = manualInput.value.trim();
    if (ticketId) {
        validateTicket(ticketId);
        manualInput.value = '';
    }
}

// Allow Enter key for manual input
document.addEventListener('DOMContentLoaded', function() {
    initScanner();
    updateStats();
    
    manualInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkManualTicket();
        }
    });
});

// Validate ticket against Firebase
async function validateTicket(ticketId) {
    showLoading(true);
    hideResult();
    
    try {
        const ticketRef = db.collection('tickets').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc. exists) {
            showResult('error', 'Invalid Ticket', 'This ticket does not exist in the system.');
            return;
        }
        
        const ticketData = ticketDoc.data();
        
        if (ticketData.used) {
            showResult('already-used', 'Ticket Already Used', 
                `This ticket was used on ${formatDate(ticketData.usedAt?. toDate())}`, ticketData);
            return;
        }
        
        // Mark ticket as used
        await ticketRef.update({
            used: true,
            usedAt: firebase.firestore. FieldValue.serverTimestamp(),
            usedBy: 'gate-scanner'
        });
        
        showResult('success', 'Valid Ticket ✓', 'Entry Approved!', ticketData);
        updateStats();
        
    } catch (error) {
        console.error('Error validating ticket:', error);
        showResult('error', 'Error', 'Could not validate ticket. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Show result with appropriate styling
function showResult(type, title, message, ticketData = null) {
    resultSection.className = `result-section ${type}`;
    resultSection.style.display = 'block';
    
    const icons = {
        'success': '✅',
        'error': '❌',
        'already-used': '⚠️'
    };
    
    resultIcon.textContent = icons[type] || '❓';
    resultMessage.textContent = title;
    
    let detailsHtml = `<p>${message}</p>`;
    
    if (ticketData) {
        detailsHtml += `
            <div class="ticket-details">
                <p><strong>Name:</strong> ${ticketData.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${ticketData.email || 'N/A'}</p>
                <p><strong>Ticket Type:</strong> ${ticketData.ticketType || 'Standard'}</p>
                <p><strong>Purchase Date:</strong> ${formatDate(ticketData.purchaseDate?. toDate())}</p>
            </div>
        `;
    }
    
    ticketDetails.innerHTML = detailsHtml;
}

// Hide result section
function hideResult() {
    resultSection.style.display = 'none';
    resultSection.className = 'result-section';
}

// Show/hide loading spinner
function showLoading(show) {
    loadingSection.className = show ? 'loading show' : 'loading';
}

// Reset scanner for next scan
function scanAgain() {
    hideResult();
    if (html5QrcodeScanner) {
        html5QrcodeScanner. resume();
    }
}

// Update statistics
async function updateStats() {
    try {
        const ticketsSnapshot = await db.collection('tickets').get();
        const total = ticketsSnapshot. size;
        let used = 0;
        
        ticketsSnapshot. forEach(doc => {
            if (doc.data().used) {
                used++;
            }
        });
        
        totalTickets.textContent = total;
        usedTickets.textContent = used;
        remainingTickets.textContent = total - used;
        
    } catch (error) {
        console. error('Error updating stats:', error);
    }
}

// Format date helper
function formatDate(date) {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

// Play beep sound on scan
function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency. value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    oscillator. stop(audioContext. currentTime + 0.15);
}
