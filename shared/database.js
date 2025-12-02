// Database module using LocalStorage
const DB_KEYS = {
    tickets: 'ekintabule_tickets',
    scanLog: 'ekintabule_scan_log',
    fraudLog: 'ekintabule_fraud_log',
    stats: 'ekintabule_stats'
};

function initDatabase() {
    if (!localStorage.getItem(DB_KEYS.tickets)) {
        localStorage.setItem(DB_KEYS.tickets, JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_KEYS.scanLog)) {
        localStorage.setItem(DB_KEYS.scanLog, JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_KEYS.fraudLog)) {
        localStorage.setItem(DB_KEYS.fraudLog, JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_KEYS.stats)) {
        localStorage.setItem(DB_KEYS.stats, JSON.stringify({
            generated: 0,
            downloaded: 0,
            sold: 0,
            used: 0,
            fraudAttempts: 0
        }));
    }
}

function getAllTickets() {
    return JSON.parse(localStorage.getItem(DB_KEYS.tickets)) || [];
}

function saveTicket(ticket) {
    const tickets = getAllTickets();
    tickets.push(ticket);
    localStorage.setItem(DB_KEYS.tickets, JSON.stringify(tickets));
    updateStats('generated', 1);
}

function saveAllTickets(ticketsArray) {
    localStorage.setItem(DB_KEYS.tickets, JSON.stringify(ticketsArray));
}

function findTicketById(ticketId) {
    const tickets = getAllTickets();
    return tickets.find(t => t.id === ticketId);
}

function findTicketBySecret(secret) {
    const tickets = getAllTickets();
    return tickets.find(t => t.secret === secret);
}

function updateTicket(ticketId, updates) {
    const tickets = getAllTickets();
    const index = tickets.findIndex(t => t.id === ticketId);
    if (index !== -1) {
        tickets[index] = { ...tickets[index], ...updates };
        localStorage.setItem(DB_KEYS.tickets, JSON.stringify(tickets));
        return true;
    }
    return false;
}

function markTicketAsUsed(ticketId) {
    const success = updateTicket(ticketId, {
        status: 'USED',
        scannedAt: new Date().toISOString()
    });
    if (success) {
        updateStats('used', 1);
        addScanLog(ticketId, 'VALID');
    }
    return success;
}

function markTicketsAsDownloaded() {
    const tickets = getAllTickets();
    const count = tickets.filter(t => t.status === 'GENERATED').length;
    tickets.forEach(t => {
        if (t.status === 'GENERATED') {
            t.status = 'DOWNLOADED';
            t.downloadedAt = new Date().toISOString();
        }
    });
    localStorage.setItem(DB_KEYS.tickets, JSON.stringify(tickets));
    updateStats('downloaded', count);
}

function markTicketAsSold(ticketId) {
    const success = updateTicket(ticketId, {
        status: 'SOLD',
        soldAt: new Date().toISOString()
    });
    if (success) {
        updateStats('sold', 1);
    }
    return success;
}

function getStats() {
    const tickets = getAllTickets();
    return {
        total: 400,
        generated: tickets.length,
        downloaded: tickets.filter(t => ['DOWNLOADED', 'SOLD', 'USED'].includes(t.status)).length,
        sold: tickets.filter(t => ['SOLD', 'USED'].includes(t.status)).length,
        used: tickets.filter(t => t.status === 'USED').length,
        fraudAttempts: getFraudLog().length
    };
}

function updateStats(key, increment) {
    const stats = JSON.parse(localStorage.getItem(DB_KEYS.stats));
    stats[key] = (stats[key] || 0) + increment;
    localStorage.setItem(DB_KEYS.stats, JSON.stringify(stats));
}

function addScanLog(ticketId, result) {
    const log = JSON.parse(localStorage.getItem(DB_KEYS.scanLog)) || [];
    log.unshift({
        ticketId: ticketId,
        result: result,
        timestamp: new Date().toISOString()
    });
    if (log.length > 100) log.pop();
    localStorage.setItem(DB_KEYS.scanLog, JSON.stringify(log));
}

function getScanLog() {
    return JSON.parse(localStorage.getItem(DB_KEYS.scanLog)) || [];
}

function addFraudAttempt(reason, data) {
    const log = JSON.parse(localStorage.getItem(DB_KEYS.fraudLog)) || [];
    log.unshift({
        reason: reason,
        data: data,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem(DB_KEYS.fraudLog, JSON.stringify(log));
}

function getFraudLog() {
    return JSON.parse(localStorage.getItem(DB_KEYS.fraudLog)) || [];
}

function exportToCSV() {
    const tickets = getAllTickets();
    const headers = ['Ticket ID', 'Status', 'Price', 'Generated At', 'Downloaded At', 'Sold At', 'Scanned At'];
    const rows = tickets.map(t => [
        t.id,
        t.status,
        t.price,
        t.generatedAt || '',
        t.downloadedAt || '',
        t.soldAt || '',
        t.scannedAt || ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    return csvContent;
}

initDatabase();