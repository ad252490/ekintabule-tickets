// QR Scanner variables
let html5QrCode = null;
let isScanning = false;

// DOM Elements - These match your index.html
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resultCard = document.getElementById('resultCard');
const resultContent = document.getElementById('resultContent');
const scannedCountEl = document.getElementById('scannedCount');
const totalTicketsEl = document. getElementById('totalTickets');
const recentScans = document.getElementById('recentScans');

// Start QR Scanner
async function startScanner() {
    try {
        // Create scanner instance
        html5QrCode = new Html5Qrcode("reader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1. 0
        };
        
        // Try back camera first (environment)
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        );
        
        isScanning = true;
        startBtn. style.display = 'none';
        stopBtn.style.display = 'inline-block';
        console.log('Scanner started successfully');
        
    } catch (err) {
        console.error('Error starting scanner with back camera:', err);
        
        // Try front camera if back camera fails
        try {
            await html5QrCode. start(
                { facingMode: "user" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                onScanSuccess,
                onScanError
            );
            
            isScanning = true;
            startBtn.style. display = 'none';
            stopBtn.style.display = 'inline-block';
            console. log('Scanner started with front camera');
            return;
            
        } catch (frontErr) {
            console.error('Error starting scanner with front camera:', frontErr);
        }
        
        // Show user-friendly error message
        let errorMessage = 'Could not start camera.  ';
        
        if (err.name === 'NotAllowedError' || err.message.includes('Permission')) {
            errorMessage = '📷 Camera permission denied. Please allow camera access:\n\n';
            errorMessage += '1. Click the lock/camera icon in your browser address bar\n';
            errorMessage += '2. Set Camera to "Allow"\n';
            errorMessage += '3.  Refresh the page and try again';
        } else if (err.name === 'NotFoundError') {
            errorMessage = '📷 No camera found on this device. ';
        } else if (err.name === 'NotReadableError') {
            errorMessage = '📷 Camera is being used by another app.  Close other apps using the camera and try again.';
        } else if (err.name === 'OverconstrainedError') {
            errorMessage = '📷 Camera not available. Please try a different device.';
        } else {
            errorMessage += err.message || 'Please check camera permissions and try again. ';
        }
        
        showResultMessage('error', '❌ Camera Error', errorMessage);
    }
}

// Stop QR Scanner
async function stopScanner() {
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
            html5QrCode. clear();
            isScanning = false;
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            console.log('Scanner stopped');
        } catch (err) {
            console.error('Error stopping scanner:', err);
        }
    }
}

// Handle successful QR scan
async function onScanSuccess(decodedText, decodedResult) {
    console.log('QR Code scanned:', decodedText);
    
    // Play success beep
    playBeep();
    
    // Pause scanning while processing
    if (html5QrCode && isScanning) {
        html5QrCode. pause(true);
    }
    
    // Validate the ticket using your LocalStorage database
    validateTicket(decodedText);
    
    // Resume scanning after 3 seconds
    setTimeout(() => {
        if (html5QrCode && isScanning) {
            try {
                html5QrCode.resume();
            } catch (e) {
                console.log('Could not resume scanner:', e);
            }
        }
    }, 3000);
}

// Handle scan errors (fires continuously when no QR in view - normal behavior)
function onScanError(error) {
    // Silently ignore - this fires continuously when no QR code is visible
}

// Validate ticket against LocalStorage database
function validateTicket(ticketId) {
    showResultMessage('loading', '⏳ Checking... ', 'Validating ticket...');
    
    try {
        // Use your existing database functions from shared/database.js
        const ticket = findTicketById(ticketId) || findTicketBySecret(ticketId);
        
        if (!ticket) {
            playErrorSound();
            showResultMessage('error', '❌ INVALID TICKET', 'This ticket does not exist in the system.');
            addScanLog(ticketId, 'INVALID');
            return;
        }
        
        // Check if already used
        if (ticket.status === 'USED') {
            playErrorSound();
            const scannedTime = ticket.scannedAt ?  new Date(ticket. scannedAt). toLocaleString() : 'Unknown time';
            showResultMessage('warning', '⚠️ ALREADY SCANNED', 
                `This ticket was already used on ${scannedTime}`,
                ticket
            );
            addScanLog(ticketId, 'DUPLICATE');
            addFraudAttempt('Duplicate scan attempt', { ticketId: ticketId, originalScan: ticket.scannedAt });
            return;
        }
        
        // Mark ticket as used
        const success = markTicketAsUsed(ticket.id);
        
        if (success) {
            playBeep();
            showResultMessage('success', '✅ VALID TICKET', 'Entry Approved!', ticket);
            addRecentScan(ticket);
            refreshGateStats();
        } else {
            playErrorSound();
            showResultMessage('error', '❌ ERROR', 'Could not validate ticket.  Please try again.');
        }
        
    } catch (error) {
        console.error('Error validating ticket:', error);
        playErrorSound();
        showResultMessage('error', '❌ ERROR', 'Could not validate ticket. Please try again.');
    }
}

// Show result message
function showResultMessage(type, title, message, ticketData = null) {
    if (! resultCard || !resultContent) return;
    
    resultCard. style.display = 'block';
    
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
            <p style="margin-bottom: 15px; white-space: pre-line;">${message}</p>
    `;
    
    if (ticketData) {
        html += `
            <div style="background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px; text-align: left; margin-top: 10px;">
                <p><strong>🎫 Ticket ID:</strong> ${ticketData. id || 'N/A'}</p>
                <p><strong>💰 Price:</strong> UGX ${(ticketData.price || 0).toLocaleString()}</p>
                <p><strong>📅 Status:</strong> ${ticketData.status || 'N/A'}</p>
            </div>
        `;
    }
    
    html += '</div>';
    resultContent.innerHTML = html;
    
    // Auto-hide after 5 seconds for success
    if (type === 'success') {
        setTimeout(() => {
            if (resultCard) resultCard.style.display = 'none';
        }, 5000);
    }
}

// Add to recent scans list
function addRecentScan(ticketData) {
    if (!recentScans) return;
    
    const scanItem = document.createElement('div');
    scanItem. className = 'scan-item';
    scanItem.style.cssText = 'padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;';
    
    scanItem.innerHTML = `
        <div>
            <strong>Ticket: ${ticketData.id. substring(0, 8)}...</strong>
            <br>
            <small style="color: #888;">UGX ${(ticketData.price || 0).toLocaleString()} - ${new Date(). toLocaleTimeString()}</small>
        </div>
        <span style="color: #28a745; font-size: 1.5rem;">✅</span>
    `;
    
    // Remove "no scans" message if present
    const noScansMsg = recentScans.querySelector('p');
    if (noScansMsg && noScansMsg. textContent. includes('No scans yet')) {
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
function refreshGateStats() {
    try {
        // Use your existing getStats function from shared/database.js
        const stats = getStats();
        
        if (scannedCountEl) scannedCountEl. textContent = stats. used || 0;
        if (totalTicketsEl) totalTicketsEl.textContent = stats.sold || stats.generated || 0;
        
    } catch (error) {
        console. error('Error refreshing stats:', error);
    }
}

// Play success beep sound
function playBeep() {
    try {
        const successSound = document.getElementById('successSound');
        if (successSound) {
            successSound. currentTime = 0;
            successSound. play(). catch(e => console.log('Sound play failed:', e));
            return;
        }
        
        // Fallback: generate beep using Web Audio API
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
    } catch (e) {
        console.log('Could not play beep:', e);
    }
}

// Play error sound
function playErrorSound() {
    try {
        const errorSound = document.getElementById('errorSound');
        if (errorSound) {
            errorSound.currentTime = 0;
            errorSound. play().catch(e => console.log('Sound play failed:', e));
            return;
        }
        
        // Fallback: generate error beep
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency. value = 300;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        oscillator. stop(audioContext. currentTime + 0.3);
    } catch (e) {
        console.log('Could not play error sound:', e);
    }
}

// Initialize on page load
document. addEventListener('DOMContentLoaded', function() {
    console.log('Gate scanner page loaded');
    refreshGateStats();
});

// Cleanup on page unload
window. addEventListener('beforeunload', function() {
    if (html5QrCode && isScanning) {
        html5QrCode. stop(). catch(e => console.log('Cleanup error:', e));
    }
});
