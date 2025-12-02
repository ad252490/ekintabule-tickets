// Security module for ticket encryption and validation
const SECRET_KEY = 'EKINTABULE-XMAS-2025-SECRET-KEY-SECURE';

async function generateHash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSecretCode(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
    }
    return result;
}

async function generateSignature(data) {
    const combined = data + SECRET_KEY;
    return await generateHash(combined);
}

async function createSecureTicket(ticketNumber) {
    const ticketId = 'EKC-2025-' + ticketNumber.toString().padStart(4, '0');
    const secret = generateSecretCode(32);
    const created = new Date().toISOString();
    const price = 10000;
    
    const dataToSign = ticketId + '|' + secret + '|' + price + '|' + created;
    const hash = await generateHash(dataToSign);
    const signature = await generateSignature(dataToSign);
    
    return {
        id: ticketId,
        secret: secret,
        price: price,
        created: created,
        hash: hash.substring(0, 16),
        signature: signature.substring(0, 16)
    };
}

async function validateTicket(ticketData) {
    try {
        const data = JSON.parse(ticketData);
        
        if (!data.id || !data.secret || !data.price || !data.created || !data.hash || !data.signature) {
            return { valid: false, reason: 'Invalid ticket structure' };
        }
        
        const dataToSign = data.id + '|' + data.secret + '|' + data.price + '|' + data.created;
        const expectedHash = await generateHash(dataToSign);
        const expectedSignature = await generateSignature(dataToSign);
        
        if (data.hash !== expectedHash.substring(0, 16)) {
            return { valid: false, reason: 'Ticket has been tampered with' };
        }
        
        if (data.signature !== expectedSignature.substring(0, 16)) {
            return { valid: false, reason: 'Invalid signature' };
        }
        
        return { valid: true, data: data };
    } catch (e) {
        return { valid: false, reason: 'Invalid QR code format' };
    }
}