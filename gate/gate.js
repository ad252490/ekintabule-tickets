// ============================================
// FIREBASE CONFIGURATION
// ============================================
// Replace these with your actual Firebase config from:
// Firebase Console → Project Settings → Your apps → Web app
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID. appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (!firebase. apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ============================================
// QR SCANNER VARIABLES
// ============================================
let html5QrCode = null;
let isScanning = false;

// ============================================
// CAMERA SCANNER FUNCTIONS
// ============================================

// Start QR Scanner - Called when "Start Camera" button is clicked
async function startScanner() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const readerElement = document.getElementById('reader');
    
    // Check if reader element exists
    if (! readerElement) {
        alert('Scanner element not found.  Please refresh the page.');
        return;
    }
    
    // Check for camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera not supported on this browser.  Please use Chrome, Firefox, or Safari.');
        return;
    }
    
    try {
        // First, request camera permission explicitly
        console.log('Requesting camera permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        // Stop the test stream
        stream.getTracks().forEach(track => track. stop());
        console.log('Camera permission granted');
        
        // Create scanner instance
        html5QrCode = new Html5Qrcode("reader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1. 0,
            showTorchButtonIfSupported: true
        };
        
        console.log('Starting scanner with back camera...');
        
        // Start with back camera
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        );
        
        isScanning = true;
        if (startBtn) startBtn. style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'inline-block';
        
        console.log('✅ Scanner started successfully! ');
        showNotification('📷 Camera started. Point at a QR code to scan. ', 'success');
        
    } catch (err) {
        console.error('Camera error:', err);
        
        // Try front camera as fallback
        if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
            try {
                console. log('Trying front camera...');
                await html5QrCode.start(
                    { facingMode: "user" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    onScanSuccess,
                    onScanError
                );
                
                isScanning = true;
                if (startBtn) startBtn.style.display = 'none';
                if (stopBtn) stopBtn. style.display = 'inline-block';
                
                console.log('✅ Scanner started with front camera!');
                showNotification('📷 Camera started (front camera). ', 'success');
                return;
            } catch (frontErr) {
                console.error('Front camera also failed:', frontErr);
            }
        }
        
        // Show helpful error message
        let errorMsg = '❌ Could not start camera.\n\n';
        
        if (err. name === 'NotAllowedError') {
            errorMsg += 'Camera permission was denied.\n\n';
            errorMsg += 'To fix this:\n';
            errorMsg += '1.  Tap the lock icon 🔒 in the address bar\n';
            errorMsg += '2. Find "Camera" and set it to "Allow"\n';
            errorMsg += '3.  Refresh the page\n';
        } else if (err.name === 'NotFoundError') {
            errorMsg += 'No camera found on this device. ';
        } else if (err.name === 'NotReadableError') {
            errorMsg += 'Camera is being used by another app.\n';
            errorMsg += 'Close other apps using the camera and try again.';
        } else if (err.name === 'SecurityError') {
            errorMsg += 'Camera requires HTTPS.\n';
            errorMsg += 'Make sure you are using https:// not http://';
        } else {
            errorMsg += 'Error: ' + (err.message || err. name || 'Unknown error');
        }
        
        alert(errorMsg);
        showResultCard('error', '❌ Camera Error', errorMsg. split('\n')[0]);
    }
}

// Stop QR Scanner
async function stopScanner() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
            await html5QrCode. clear();
            isScanning = false;
            
            if (startBtn) startBtn.style.display = 'inline-block';
            if (stopBtn) stopBtn.style.display = 'none';
            
            console. log('Scanner stopped');
            showNotification('Camera stopped', 'info');
        } catch (err) {
            console.error('Error stopping scanner:', err);
        }
    }
}

// Handle successful QR scan
async function onScanSuccess(decodedText, decodedResult) {
    console.log('✅ QR Code scanned:', decodedText);
    
    // Play beep sound
    playBeep();
    
    // Pause scanning while processing
    if (html5QrCode && isScanning) {
        try {
            html5QrCode. pause(true);
        } catch (e) {
            console.log('Could not pause scanner');
        }
    }
    
    // Validate the ticket
    await validateTicket(decodedText);
    
    // Resume scanning after 3 seconds
    setTimeout(() => {
        if (html5QrCode && isScanning) {
            try {
                html5QrCode. resume();
            } catch (e) {
                console.log('Could not resume scanner');
            }
        }
    }, 3000);
}

// Handle scan errors (normal when no QR code in view)
function onScanError(error) {
    // Silently ignore - this fires continuously when no QR code is visible
}

// ============================================
// TICKET VALIDATION (FIREBASE)
// ============================================

async function validateTicket(scannedData) {
    showResultCard('loading', '⏳ Checking... ', 'Validating ticket...');
    
    try {
        // Parse the scanned QR data
        let ticketId = scannedData;
        let ticketData = null;
        
        // Try to parse as JSON (if QR contains JSON data)
        try {
            const parsed = JSON.parse(scannedData);
            ticketId = parsed.id || parsed. ticketId || scannedData;
            ticketData = parsed;
        } catch (e) {
            // Not JSON, use as-is (probably just ticket ID)
            ticketId = scannedData;
        }
        
        console.log('Looking up ticket:', ticketId);
        
        // Look up ticket in Firebase
        const ticketRef = db.collection('tickets').doc(ticketId);
        const ticketDoc = await ticketRef. get();
        
        // Also try searching by secret if direct lookup fails
        if (!ticketDoc. exists) {
            const querySnapshot = await db. collection('tickets')
                .where('secret', '==', scannedData)
                .limit(1)
                .get();
            
            if (! querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return await processTicket(doc. ref, doc.data(), doc.id);
            }
            
            // Ticket not found
            playErrorBeep();
            showResultCard('error', '❌ INVALID TICKET', 
                'This ticket does not exist in the system.\n\nScanned: ' + ticketId. substring(0, 20) + '...');
            logScan(ticketId, 'INVALID', null);
            return;
        }
        
        await processTicket(ticketRef, ticketDoc.data(), ticketId);
        
    } catch (error) {
        console.error('Error validating ticket:', error);
        playErrorBeep();
        showResultCard('error', '❌ ERROR', 
            'Could not validate ticket.\n\n' + (error.message || 'Please check your internet connection. '));
    }
}

async function processTicket(ticketRef, ticket, ticketId) {
    // Check if already scanned/used
    if (ticket.status === 'USED' || ticket. scanned === true || ticket.used === true) {
        playErrorBeep();
        const scannedTime = ticket.scannedAt?. toDate?. () || 
                           (ticket.scannedAt ? new Date(ticket.scannedAt) : null);
        const timeStr = scannedTime ? scannedTime.toLocaleString() : 'Unknown time';
        
        showResultCard('warning', '⚠️ ALREADY SCANNED', 
            `This ticket was already used on:\n${timeStr}`, ticket);
        logScan(ticketId, 'DUPLICATE', ticket);
        return;
    }
    
    // Mark ticket as used in Firebase
    await ticketRef.update({
        status: 'USED',
        scanned: true,
        used: true,
        scannedAt: firebase.firestore. FieldValue.serverTimestamp(),
        scannedBy: sessionStorage.getItem('userRole') || 'gate',
        scannedDevice: navigator.userAgent. substring(0, 50)
    });
    
    // Success! 
    playBeep();
    showResultCard('success', '✅ VALID TICKET', 'Entry Approved!', ticket);
    addRecentScan(ticket, ticketId);
    logScan(ticketId, 'VALID', ticket);
    refreshGateStats();
}

// Log scan to Firebase for admin tracking
async function logScan(ticketId, result, ticketData) {
    try {
        await db.collection('scanLogs').add({
            ticketId: ticketId,
            result: result,
            ticketData: ticketData,
            scannedAt: firebase.firestore. FieldValue.serverTimestamp(),
            scannedBy: sessionStorage.getItem('userRole') || 'gate',
            device: navigator.userAgent.substring(0, 100)
        });
    } catch (e) {
        console.error('Could not log scan:', e);
    }
}

// ============================================
// UI FUNCTIONS
// ============================================

function showResultCard(type, title, message, ticketData = null) {
    const resultCard = document.getElementById('resultCard');
    const resultContent = document.getElementById('resultContent');
    
    if (! resultCard || !resultContent) return;
    
    resultCard.style.display = 'block';
    
    let bgColor, textColor, borderColor;
    switch(type) {
        case 'success':
            bgColor = '#d4edda';
            textColor = '#155724';
            borderColor = '#28a745';
            break;
        case 'error':
            bgColor = '#f8d7da';
            textColor = '#721c24';
            borderColor = '#dc3545';
            break;
        case 'warning':
            bgColor = '#fff3cd';
            textColor = '#856404';
            borderColor = '#ffc107';
            break;
        default:
            bgColor = '#e2e3e5';
            textColor = '#383d41';
            borderColor = '#6c757d';
    }
    
    let html = `
        <div style="background: ${bgColor}; color: ${textColor}; padding: 20px; border-radius: 10px; 
                    text-align: center; border: 3px solid ${borderColor};">
            <h2 style="margin-bottom: 10px; font-size: 1.8rem;">${title}</h2>
            <p style="margin-bottom: 15px; white-space: pre-line; font-size: 1.1rem;">${message}</p>
    `;
    
    if (ticketData && type !== 'loading') {
        html += `
            <div style="background: rgba(255,255,255,0.8); padding: 15px; border-radius: 8px; 
                        text-align: left; margin-top: 10px;">
                <p><strong>🎫 Ticket:</strong> ${ticketData.id || 'N/A'}</p>
                <p><strong>💰 Price:</strong> UGX ${(ticketData.price || 10000).toLocaleString()}</p>
                <p><strong>📅 Created:</strong> ${ticketData.created ?  new Date(ticketData.created).toLocaleDateString() : 'N/A'}</p>
            </div>
        `;
    }
    
    html += '</div>';
    resultContent.innerHTML = html;
    
    // Auto-hide success after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            resultCard.style.display = 'none';
        }, 5000);
    }
}

function showNotification(message, type = 'info') {
    console.log(`[${type. toUpperCase()}] ${message}`);
}

function addRecentScan(ticketData, ticketId) {
    const recentScans = document.getElementById('recentScans');
    if (!recentScans) return;
    
    const scanItem = document.createElement('div');
    scanItem. style.cssText = 'padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; animation: fadeIn 0.3s ease;';
    
    const displayId = ticketId. length > 15 ? ticketId.substring(0, 15) + '...' : ticketId;
    
    scanItem.innerHTML = `
        <div>
            <strong style="color: #155724;">✅ ${displayId}</strong><br>
            <small style="color: #888;">UGX ${(ticketData?. price || 10000).toLocaleString()} • ${new Date(). toLocaleTimeString()}</small>
        </div>
        <span style="color: #28a745; font-size: 1.5rem;">✓</span>
    `;
    
    // Remove "no scans" message
    const noScansMsg = recentScans.querySelector('p');
    if (noScansMsg && noScansMsg. textContent. includes('No scans')) {
        recentScans.innerHTML = '';
    }
    
    recentScans.insertBefore(scanItem, recentScans.firstChild);
    
    // Keep only last 10
    while (recentScans.children.length > 10) {
        recentScans.removeChild(recentScans.lastChild);
    }
}

// ============================================
// STATISTICS (FIREBASE)
// ============================================

async function refreshGateStats() {
    const scannedCountEl = document.getElementById('scannedCount');
    const totalTicketsEl = document. getElementById('totalTickets');
    
    try {
        const ticketsSnapshot = await db. collection('tickets').get();
        let total = 0;
        let scanned = 0;
        
        ticketsSnapshot.forEach(doc => {
            const data = doc.data();
            total++;
            if (data.status === 'USED' || data.scanned || data.used) {
                scanned++;
            }
        });
        
        if (scannedCountEl) scannedCountEl. textContent = scanned;
        if (totalTicketsEl) totalTicketsEl.textContent = total;
        
    } catch (error) {
        console.error('Error refreshing stats:', error);
    }
}

// ============================================
// SOUND FUNCTIONS
// ============================================

function playBeep() {
    try {
        const sound = document.getElementById('successSound');
        if (sound) {
            sound.currentTime = 0;
            sound.play(). catch(e => {});
            return;
        }
        
        // Fallback beep
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain. connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc. start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
}

function playErrorBeep() {
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
        const gain = ctx. createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency. value = 300;
        gain. gain.value = 0.3;
        osc.start();
        osc.stop(ctx. currentTime + 0.3);
    } catch (e) {}
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚪 Gate Scanner Loaded');
    console.log('Firebase initialized:', !!firebase. apps.length);
    
    // Refresh stats on load
    refreshGateStats();
    
    // Auto-refresh stats every 30 seconds
    setInterval(refreshGateStats, 30000);
});

// Cleanup on page close
window.addEventListener('beforeunload', function() {
    if (html5QrCode && isScanning) {
        html5QrCode. stop(). catch(e => {});
    }
});
