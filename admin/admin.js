let generatedTickets = [];
let currentPage = 1;
const ticketsPerPage = 20;

// Constants
const DEVICE_STRING_MAX_LENGTH = 50;

// Base URL for verification page - automatically detected from current location or fallback to GitHub Pages
function getBaseUrl() {
    // If running on GitHub Pages or production, use the current origin
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return window.location.origin + '/ekintabule-tickets/verify/';
    }
    // Fallback to GitHub Pages URL
    return 'https://ad252490.github.io/ekintabule-tickets/verify/';
}

const VERIFICATION_BASE_URL = getBaseUrl();

// Generate QR code URL for a ticket
function getVerificationUrl(ticketId) {
    return VERIFICATION_BASE_URL + '?ticket=' + encodeURIComponent(ticketId);
}

function refreshDashboard() {
    const stats = getStats();
    const tickets = getAllTickets();
    
    document.getElementById('statGenerated').textContent = stats.generated;
    document.getElementById('statDownloaded').textContent = stats.downloaded;
    document.getElementById('statSold').textContent = stats.sold;
    document.getElementById('statUsed').textContent = stats.used;
    document.getElementById('statRevenue').textContent = formatNumber(stats.sold * 10000);
    document.getElementById('statFraud').textContent = stats.fraudAttempts;
    
    document.getElementById('soldRevenue').textContent = stats.sold + ' x 10,000 UGX = ' + formatNumber(stats.sold * 10000) + ' UGX';
    
    const attendancePercent = stats.sold > 0 ? Math.round((stats.used / stats.sold) * 100) : 0;
    document.getElementById('attendanceRate').textContent = stats.used + ' / ' + stats.sold + ' (' + attendancePercent + '%)';
    
    document.getElementById('expectedCollection').textContent = formatNumber(stats.sold * 10000) + ' UGX';
    
    document.getElementById('generateBtn').disabled = stats.generated >= 400;
    document.getElementById('downloadZipBtn').disabled = stats.generated === 0;
    document.getElementById('downloadPdfBtn').disabled = stats.generated === 0;
    
    if (stats.generated >= 400) {
        document.getElementById('generateBtn').textContent = '✅ All 400 Tickets Generated';
    }
    
    renderTicketTable(tickets);
    renderSecurityLog();
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function generateAllTickets() {
    const existingTickets = getAllTickets();
    if (existingTickets.length >= 400) {
        alert('All 400 tickets have already been generated!');
        return;
    }
    
    const startFrom = existingTickets.length + 1;
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const generateBtn = document.getElementById('generateBtn');
    
    progressContainer.style.display = 'block';
    progressText.style.display = 'block';
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating...';
    
    const tickets = [...existingTickets];
    
    for (let i = startFrom; i <= 400; i++) {
        const ticketData = await createSecureTicket(i);
        
        const ticket = {
            id: ticketData.id,
            secret: ticketData.secret,
            qrData: getVerificationUrl(ticketData.id),
            price: 10000,
            status: 'GENERATED',
            generatedAt: new Date().toISOString(),
            downloadedAt: null,
            soldAt: null,
            scannedAt: null
        };
        
        tickets.push(ticket);
        
        const progress = Math.round(((i - startFrom + 1) / (400 - startFrom + 1)) * 100);
        progressFill.style.width = progress + '%';
        progressText.textContent = 'Generating ticket ' + i + ' of 400... (' + progress + '%)';
        
        if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    saveAllTickets(tickets);
    
    progressText.textContent = '✅ All 400 tickets generated successfully!';
    generateBtn.textContent = '✅ All 400 Tickets Generated';
    
    setTimeout(() => {
        progressContainer.style.display = 'none';
        progressText.style.display = 'none';
        refreshDashboard();
    }, 2000);
}

async function downloadAsZip() {
    const tickets = getAllTickets();
    if (tickets.length === 0) {
        alert('No tickets to download. Generate tickets first.');
        return;
    }
    
    const zip = new JSZip();
    const progressText = document.getElementById('progressText');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    
    progressContainer.style.display = 'block';
    progressText.style.display = 'block';
    progressText.textContent = 'Preparing ZIP file...';
    progressFill.style.width = '0%';
    
    const ticketCanvas = document.getElementById('ticketCanvas');
    
    for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        
        const ticketElement = createTicketElement(ticket);
        ticketCanvas.innerHTML = '';
        ticketCanvas.appendChild(ticketElement);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const canvas = await html2canvas(ticketElement, {
            scale: 3,
            backgroundColor: null
        });
        
        const imgData = canvas.toDataURL('image/png').split(',')[1];
        zip.file('ticket_' + ticket.id + '.png', imgData, {base64: true});
        
        const progress = Math.round(((i + 1) / tickets.length) * 100);
        progressFill.style.width = progress + '%';
        progressText.textContent = 'Creating ticket ' + (i + 1) + ' of ' + tickets.length + '... (' + progress + '%)';
    }
    
    progressText.textContent = 'Creating ZIP file...';
    
    const content = await zip.generateAsync({type: 'blob'});
    saveAs(content, 'ekintabule_tickets.zip');
    
    markTicketsAsDownloaded();
    
    progressText.textContent = '✅ Download complete!';
    setTimeout(() => {
        progressContainer.style.display = 'none';
        progressText.style.display = 'none';
        refreshDashboard();
    }, 2000);
}

async function downloadAsPdf() {
    const tickets = getAllTickets();
    if (tickets.length === 0) {
        alert('No tickets to download. Generate tickets first.');
        return;
    }
    
    const progressText = document.getElementById('progressText');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    
    progressContainer.style.display = 'block';
    progressText.style.display = 'block';
    progressText.textContent = 'Preparing PDF...';
    progressFill.style.width = '0%';
    
    let printContent = '<!DOCTYPE html><html><head><title>EKINTABULE Tickets</title>';
    printContent += '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>';
    printContent += '<style>';
    printContent += '* { margin: 0; padding: 0; box-sizing: border-box; }';
    printContent += 'body { font-family: Arial, sans-serif; }';
    printContent += '.page { width: 210mm; min-height: 297mm; padding: 10mm; page-break-after: always; }';
    printContent += '.tickets-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }';
    printContent += '.ticket { width: 55mm; height: 20mm; background: linear-gradient(135deg, #3d1a1a 0%, #8B4513 50%, #3d1a1a 100%); border: 1px solid #FFD700; border-radius: 3mm; padding: 2mm; display: flex; align-items: center; position: relative; overflow: hidden; }';
    printContent += '.ticket-info { flex: 1; padding-left: 2mm; }';
    printContent += '.event-name { color: #FFD700; font-size: 7pt; font-weight: bold; }';
    printContent += '.event-details { color: #fff; font-size: 5pt; line-height: 1.3; }';
    printContent += '.ticket-qr { width: 15mm; height: 15mm; background: #fff; padding: 1mm; border-radius: 1mm; display: flex; align-items: center; justify-content: center; }';
    printContent += '.ticket-qr img { width: 100%; height: 100%; }';
    printContent += '.ticket-number { position: absolute; top: 1mm; right: 17mm; color: #FFD700; font-size: 5pt; font-weight: bold; }';
    printContent += '.ticket-security { position: absolute; bottom: 1mm; right: 2mm; color: rgba(255,215,0,0.7); font-size: 4pt; }';
    printContent += '@media print { .page { page-break-after: always; } }';
    printContent += '</style></head><body>';
    
    const ticketsPerPage = 30;
    let pageCount = Math.ceil(tickets.length / ticketsPerPage);
    
    for (let page = 0; page < pageCount; page++) {
        printContent += '<div class="page"><div class="tickets-grid">';
        
        const startIdx = page * ticketsPerPage;
        const endIdx = Math.min(startIdx + ticketsPerPage, tickets.length);
        
        for (let i = startIdx; i < endIdx; i++) {
            const ticket = tickets[i];
            printContent += '<div class="ticket">';
            printContent += '<div class="ticket-number">' + ticket.id + '</div>';
            printContent += '<div class="ticket-info">';
            printContent += '<div class="event-name">🎄 EKINTABULE Kya Christmas</div>';
            printContent += '<div class="event-details">📅 25th Dec 2025<br>📍 Club Missouka, Kijabijo<br>💰 10,000 UGX</div>';
            printContent += '</div>';
            printContent += '<div class="ticket-qr" id="qr_' + i + '"></div>';
            printContent += '<div class="ticket-security">' + ticket.secret.substring(0, 8) + '...</div>';
            printContent += '</div>';
        }
        
        printContent += '</div></div>';
        
        const progress = Math.round(((page + 1) / pageCount) * 100);
        progressFill.style.width = progress + '%';
        progressText.textContent = 'Creating page ' + (page + 1) + ' of ' + pageCount + '...';
    }
    
    printContent += '<script>';
    printContent += 'document.addEventListener("DOMContentLoaded", function() {';
    printContent += 'const tickets = ' + JSON.stringify(tickets) + ';';
    printContent += 'tickets.forEach((ticket, i) => {';
    printContent += 'const container = document.getElementById("qr_" + i);';
    printContent += 'if (container) {';
    printContent += 'new QRCode(container, { text: ticket.qrData, width: 60, height: 60, correctLevel: QRCode.CorrectLevel.H });';
    printContent += '};';
    printContent += '});';
    printContent += 'setTimeout(() => window.print(), 1000);';
    printContent += '});';
    printContent += '<\/script></body></html>';  
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    markTicketsAsDownloaded();
    
    progressText.textContent = '✅ PDF ready for printing!';
    setTimeout(() => {
        progressContainer.style.display = 'none';
        progressText.style.display = 'none';
        refreshDashboard();
    }, 2000);
}

function createTicketElement(ticket) {
    const div = document.createElement('div');
    div.className = 'ticket-template';
    div.innerHTML = '<div class="ticket-number">' + ticket.id + '</div>' +
        '<div class="ticket-info">' +
        '<div class="event-name">🎄 EKINTABULE Kya Christmas</div>' +
        '<div class="event-details">📅 25th Dec 2025<br>📍 Club Missouka, Kijabijo<br>💰 10,000 UGX</div>' +
        '</div>' +
        '<div class="ticket-qr" id="qr_' + ticket.id + '"></div>' +
        '<div class="ticket-security">' + ticket.secret.substring(0, 8) + '...</div>';
    
    setTimeout(() => {
        const qrContainer = div.querySelector('.ticket-qr');
        new QRCode(qrContainer, {
            text: ticket.qrData,
            width: 50,
            height: 50,
            correctLevel: QRCode.CorrectLevel.H
        });
    }, 10);
    
    return div;
}

function renderTicketTable(tickets) {
    const tbody = document.getElementById('ticketTableBody');
    const searchTerm = document.getElementById('searchTicket').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    
    let filteredTickets = tickets.filter(t => {
        const matchesSearch = t.id.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    
    if (filteredTickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">' +
            (tickets.length === 0 ? 'No tickets generated yet.' : 'No tickets match your search.') + '</td></tr>';
        return;
    }
    
    const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);
    const startIdx = (currentPage - 1) * ticketsPerPage;
    const paginatedTickets = filteredTickets.slice(startIdx, startIdx + ticketsPerPage);
    
    let html = '';
    paginatedTickets.forEach(ticket => {
        html += '<tr>';
        html += '<td><strong>' + ticket.id + '</strong></td>';
        html += '<td><span class="status-badge status-' + ticket.status.toLowerCase() + '">' + ticket.status + '</span></td>';
        html += '<td>' + formatDate(ticket.generatedAt) + '</td>';
        html += '<td>' + (ticket.scannedAt ? formatDate(ticket.scannedAt) : '-') + '</td>';
        html += '<td>';
        if (ticket.status === 'DOWNLOADED') {
            html += '<button class="btn btn-primary" style="padding: 5px 10px; font-size: 12px;" onclick="markAsSold(\'' + ticket.id + '\')">💰 Mark Sold</button>';
        } else {
            html += '-';
        }
        html += '</td></tr>';
    });
    
    if (totalPages > 1) {
        html += '<tr><td colspan="5"><div class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            html += '<button class="' + (i === currentPage ? 'active' : '') + '" onclick="goToPage(' + i + ')">' + i + '</button>';
        }
        html += '</div></td></tr>';
    }
    
    tbody.innerHTML = html;
}

function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function goToPage(page) {
    currentPage = page;
    refreshDashboard();
}

function filterTickets() {
    currentPage = 1;
    refreshDashboard();
}

function markAsSold(ticketId) {
    if (confirm('Mark ticket ' + ticketId + ' as SOLD?')) {
        markTicketAsSold(ticketId);
        refreshDashboard();
    }
}

function exportReport() {
    const csv = exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, 'ekintabule_tickets_report.csv');
}

function renderSecurityLog() {
    const fraudLog = getFraudLog();
    const container = document.getElementById('securityLog');
    
    if (fraudLog.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center;">No security events recorded.</p>';
        return;
    }
    
    let html = '';
    fraudLog.slice(0, 10).forEach(entry => {
        html += '<div class="security-entry">';
        html += '<strong>🚨 ' + entry.reason + '</strong>';
        html += '<br><small>' + formatDate(entry.timestamp) + '</small>';
        html += '</div>';
    });
    container.innerHTML = html;
}

document.getElementById('searchTicket').addEventListener('input', function() {
    currentPage = 1;
    refreshDashboard();
});

// ============================================
// SCAN LOGS FUNCTIONALITY
// ============================================

// Load scan logs from Firebase
async function loadScanLogs() {
    const container = document.getElementById('scanLogsContainer');
    if (!container) return;
    
    try {
        // Check if Firebase is available
        if (typeof db === 'undefined' || !db) {
            container.innerHTML = '<p style="color: #888; text-align: center;">Firebase not initialized. Scan logs unavailable.</p>';
            return;
        }
        
        const snapshot = await db.collection('scanLogs')
            .orderBy('scannedAt', 'desc')
            .limit(50)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="color: #888; text-align: center;">No scans recorded yet.</p>';
            updateScanStats(0, 0, 0);
            return;
        }
        
        let html = '';
        let validCount = 0;
        let invalidCount = 0;
        let duplicateCount = 0;
        
        snapshot.forEach(function(doc) {
            const log = doc.data();
            const scannedAt = log.scannedAt && log.scannedAt.toDate ? log.scannedAt.toDate() : null;
            const timeStr = scannedAt ? scannedAt.toLocaleString() : 'Unknown time';
            
            let statusClass = '';
            let statusIcon = '';
            
            switch(log.result) {
                case 'VALID':
                    statusClass = 'scan-valid';
                    statusIcon = '✅';
                    validCount++;
                    break;
                case 'INVALID':
                    statusClass = 'scan-invalid';
                    statusIcon = '❌';
                    invalidCount++;
                    break;
                case 'DUPLICATE':
                    statusClass = 'scan-duplicate';
                    statusIcon = '⚠️';
                    duplicateCount++;
                    break;
                default:
                    statusClass = '';
                    statusIcon = '❓';
            }
            
            html += '<div class="scan-log-entry ' + statusClass + '">';
            html += '<div class="scan-log-header">';
            html += '<span class="scan-result">' + statusIcon + ' ' + (log.result || 'UNKNOWN') + '</span>';
            html += '<span class="scan-time">' + timeStr + '</span>';
            html += '</div>';
            html += '<div class="scan-log-details">';
            html += '<strong>🎫 ' + (log.ticketId || 'Unknown Ticket') + '</strong>';
            if (log.device) {
                const shortDevice = log.device.length > DEVICE_STRING_MAX_LENGTH ? log.device.substring(0, DEVICE_STRING_MAX_LENGTH) + '...' : log.device;
                html += '<br><small style="color: #888;">📱 ' + shortDevice + '</small>';
            }
            html += '</div>';
            html += '</div>';
        });
        
        container.innerHTML = html;
        updateScanStats(validCount, invalidCount, duplicateCount);
        
    } catch (error) {
        console.error('Error loading scan logs:', error);
        container.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Error loading scan logs: ' + error.message + '</p>';
    }
}

// Update scan stats display
function updateScanStats(valid, invalid, duplicate) {
    const totalScansEl = document.getElementById('totalScans');
    const validScansEl = document.getElementById('validScans');
    const invalidScansEl = document.getElementById('invalidScans');
    const duplicateScansEl = document.getElementById('duplicateScans');
    
    if (totalScansEl) totalScansEl.textContent = valid + invalid + duplicate;
    if (validScansEl) validScansEl.textContent = valid;
    if (invalidScansEl) invalidScansEl.textContent = invalid;
    if (duplicateScansEl) duplicateScansEl.textContent = duplicate;
}

// Real-time scan logs listener
function startScanLogsListener() {
    if (typeof db === 'undefined' || !db) return;
    
    try {
        db.collection('scanLogs')
            .orderBy('scannedAt', 'desc')
            .limit(50)
            .onSnapshot(function(snapshot) {
                loadScanLogs();
            }, function(error) {
                console.error('Scan logs listener error:', error);
            });
    } catch (error) {
        console.error('Could not start scan logs listener:', error);
    }
}

// Check if Firebase is ready and initialize scan logs
function initScanLogs() {
    // Check if Firebase db is available
    if (typeof db !== 'undefined' && db) {
        loadScanLogs();
        startScanLogsListener();
    } else {
        // Retry after a short delay if Firebase isn't ready yet
        setTimeout(initScanLogs, 500);
    }
}

// Initialize scan logs on page load
document.addEventListener('DOMContentLoaded', function() {
    initScanLogs();
});