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
// QR Scanner variables
let html5QrCode = null;
let isScanning = false;

// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resultCard = document.getElementById('resultCard');
const resultContent = document.getElementById('resultContent');
const scannedCount = document.getElementById('scannedCount');
const totalTicketsEl = document.getElementById('totalTickets');
const recentScans = document.getElementById('recentScans');

// Start QR Scanner
async function startScanner() {
    try {
        html5QrCode = new Html5Qrcode("reader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1. 0
        };
        
        await html5QrCode.start(
            { facingMode: "environment" }, // Use back camera
            config,
            onScanSuccess,
            onScanError
        );
        
        isScanning = true;
        startBtn. style.display = 'none';
        stopBtn.style. display = 'inline-block';
        
    } catch (err) {
        console.error('Error starting scanner:', err);
        
        // Show user-friendly error message
        let errorMessage = 'Could not start camera.  ';
        
        if (err. name === 'NotAllowedError') {
            errorMessage += 'Please allow camera access in your browser settings.';
        } else if (err. name === 'NotFoundError') {
            errorMessage += 'No camera found on this device.';
        } else if (err. name === 'NotReadableError') {
            errorMessage += 'Camera is being used by another application.';
        } else if (err.name === 'OverconstrainedError') {
            // Try front camera if back camera fails
            try {
                await html5QrCode. start(
                    { facingMode: "user" },
                    config,
                    onScanSuccess,
                    onScanError
                );
                isScanning = true;
                startBtn. style.display = 'none';
                stopBtn.style. display = 'inline-block';
                return;
            } catch (e) {
                errorMessage += 'Camera not available. ';
            }
        } else {
            errorMessage += err.message || 'Unknown error occurred.';
        }
        
        showResult('error', '❌ Camera Error', errorMessage);
    }
}

// Stop QR Scanner
async function stopScanner() {
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode. stop();
            isScanning = false;
            startBtn. style.display = 'inline-block';
            stopBtn. style.display = 'none';
        } catch (err) {
            console. error('Error stopping scanner:', err);
        }
    }
}

// Handle successful QR scan
async function onScanSuccess(decodedText, decodedResult) {
    // Pause scanning while processing
    if (html5QrCode && isScanning) {
        await html5QrCode. pause();
    }
    
    // Play beep sound
    playSound('success');
    
    // Validate the ticket
    await validateTicket(decodedText);
    
    // Resume scanning after 3 seconds
    setTimeout(async () => {
        if (html5QrCode && isScanning) {
            try {
                await html5QrCode. resume();
            } catch (e) {
                console.log('Scanner already running');
            }
        }
    }, 3000);
}

// Handle scan errors (fires continuously when no QR in view - ignore)
function onScanError(error) {
    // Silently ignore - this is normal when no QR code is visible
}

// Validate ticket against Firebase
async function validateTicket(ticketId) {
    showResult('loading', '⏳ Checking... ', 'Validating ticket...');
    
    try {
        // Check if ticket exists
        const ticketRef = db.collection('tickets').doc(ticketId);
        const ticketDoc = await ticketRef. get();
        
        if (!ticketDoc.exists) {
            playSound('error');
            showResult('error', '❌ INVALID TICKET', 'This ticket does not exist in the system.');
            return;
        }
        
        const ticketData = ticketDoc.data();
        
        // Check if already scanned
        if (ticketData. scanned || ticketData.used) {
            playSound('error');
            const scannedTime = ticketData.scannedAt?. toDate() || ticketData.usedAt?.toDate();
            showResult('warning', '⚠️ ALREADY SCANNED', 
                `This ticket was already scanned${scannedTime ?  ' on ' + formatDateTime(scannedTime) : ''}. `,
                ticketData
            );
            return;
        }
        
        // Mark ticket as scanned/used
        await ticketRef.update({
            scanned: true,
            used: true,
            scannedAt: firebase.firestore. FieldValue.serverTimestamp(),
            usedAt: firebase. firestore.FieldValue.serverTimestamp(),
            scannedBy: getCurrentUser()?. email || 'gate-scanner'
        });
        
        playSound('success');
        showResult('success', '✅ VALID TICKET', 'Entry Approved!', ticketData);
        
        // Add to recent scans
        addRecentScan(ticketData, ticketId);
        
        // Refresh stats
        refreshGateStats();
        
    } catch (error) {
        console.error('Error validating ticket:', error);
        playSound('error');
        showResult('error', '❌ ERROR', 'Could not validate ticket. Please try again.');
    }
}

// Show result card
function showResult(type, title, message, ticketData = null) {
    resultCard.style.display = 'block';
    
    let bgColor, textColor;
    switch(type) {
        case 'success':
            bgColor = '#d4edda';
            textColor = '#155724';
            break;
        case 'error':
            bgColor = '#f8d7da';
            textColor = '#721c24';
            break;
        case 'warning':
            bgColor = '#fff3cd';
            textColor = '#856404';
            break;
        default:
            bgColor = '#e2e3e5';
            textColor = '#383d41';
    }
    
    let html = `
        <div style="background: ${bgColor}; color: ${textColor}; padding: 20px; border-radius: 10px; text-align: center;">
            <h2 style="margin-bottom: 10px; font-size: 1.5rem;">${title}</h2>
            <p style="margin-bottom: 15px;">${message}</p>
    `;
    
    if (ticketData) {
        html += `
            <div style="background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px; text-align: left; margin-top: 10px;">
                <p><strong>👤 Name:</strong> ${ticketData.name || ticketData.customerName || 'N/A'}</p>
                <p><strong>📧 Email:</strong> ${ticketData. email || ticketData.customerEmail || 'N/A'}</p>
                <p><strong>📞 Phone:</strong> ${ticketData. phone || ticketData.customerPhone || 'N/A'}</p>
                <p><strong>🎫 Ticket Type:</strong> ${ticketData.ticketType || ticketData.type || 'Standard'}</p>
                <p><strong>💰 Amount:</strong> UGX ${(ticketData.amount || ticketData. price || 0).toLocaleString()}</p>
            </div>
        `;
    }
    
    html += '</div>';
    resultContent.innerHTML = html;
    
    // Auto-hide after 5 seconds for success
    if (type === 'success') {
        setTimeout(() => {
            resultCard.style.display = 'none';
        }, 5000);
    }
}

// Add to recent scans list
function addRecentScan(ticketData, ticketId) {
    const scanItem = document.createElement('div');
    scanItem. className = 'scan-item';
    scanItem.style.cssText = 'padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;';
    
    scanItem.innerHTML = `
        <div>
            <strong>${ticketData. name || ticketData.customerName || 'Guest'}</strong>
            <br>
            <small style="color: #888;">${ticketData.ticketType || 'Standard'} - ${new Date(). toLocaleTimeString()}</small>
        </div>
        <span style="color: #28a745; font-size: 1.5rem;">✅</span>
    `;
    
    // Remove "no scans" message if present
    const noScansMsg = recentScans.querySelector('p');
    if (noScansMsg) {
        recentScans.innerHTML = '';
    }
    
    // Add to top of list
    recentScans.insertBefore(scanItem, recentScans.firstChild);
    
    // Keep only last 10 scans
    while (recentScans.children.length > 10) {
        recentScans.removeChild(recentScans.lastChild);
    }
}

// Refresh gate statistics
async function refreshGateStats() {
    try {
        const ticketsSnapshot = await db.collection('tickets').get();
        let total = 0;
        let scanned = 0;
        
        ticketsSnapshot. forEach(doc => {
            const data = doc.data();
            if (data.status === 'sold' || data.paid) {
                total++;
            }
            if (data.scanned || data.used) {
                scanned++;
            }
        });
        
        scannedCount.textContent = scanned;
        totalTicketsEl.textContent = total;
        
    } catch (error) {
        console. error('Error refreshing stats:', error);
    }
}

// Play sound
function playSound(type) {
    try {
        const sound = document.getElementById(type + 'Sound');
        if (sound) {
            sound.currentTime = 0;
            sound.play(). catch(e => console.log('Sound play failed:', e));
        }
    } catch (e) {
        console.log('Sound error:', e);
    }
}

// Format date/time
function formatDateTime(date) {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

// Get current logged in user
function getCurrentUser() {
    // This should come from your auth. js
    if (typeof firebase !== 'undefined' && firebase.auth) {
        return firebase.auth().currentUser;
    }
    return null;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (html5QrCode && isScanning) {
        html5QrCode. stop();
    }
});

