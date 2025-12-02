// Authentication credentials
const CREDENTIALS = {
    admin: 'admin@ekintabule2025',
    gate: 'sales@ekintabule2025'
};

function authenticate(password) {
    if (password === CREDENTIALS.admin) {
        sessionStorage.setItem('userRole', 'admin');
        sessionStorage.setItem('isLoggedIn', 'true');
        return 'admin';
    } else if (password === CREDENTIALS.gate) {
        sessionStorage.setItem('userRole', 'gate');
        sessionStorage.setItem('isLoggedIn', 'true');
        return 'gate';
    }
    return null;
}

function checkAuth(requiredRole) {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const userRole = sessionStorage.getItem('userRole');
    
    if (!isLoggedIn || userRole !== requiredRole) {
        window.location.href = '../index.html';
        return false;
    }
    return true;
}

function logout() {
    sessionStorage.clear();
    window.location.href = '../index.html';
}