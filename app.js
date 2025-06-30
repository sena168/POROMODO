// POROMODO - Pomodoro Timer PWA
// Main application logic

class PomodoroTimer {
    constructor() {
        this.state = {
            isRunning: false,
            isPaused: false,
            timeLeft: 25 * 60, // 25 minutes in seconds
            totalTime: 25 * 60,
            sessionType: 'focus', // 'focus', 'shortBreak', 'longBreak'
            sessionCount: 0,
            currentSessionNumber: 1,
            settings: {
                focusTime: 25,
                shortBreak: 5,
                longBreak: 15,
                soundEnabled: true,
                notificationsEnabled: true
            }
        };

        this.timer = null;
        this.audio = null;
        this.deferredPrompt = null;

        this.init();
    }

    init() {
        this.loadSettings();
        this.setupElements();
        this.setupEventListeners();
        this.setupPWA();
        this.setupNotifications();
        this.updateDisplay();
        this.updateProgressRing();
        this.createAudioContext();
    }

    // Element Setup
    setupElements() {
        this.elements = {
            timeDisplay: document.getElementById('timeDisplay'),
            sessionType: document.getElementById('sessionType'),
            sessionCount: document.getElementById('sessionCount'),
            currentSession: document.getElementById('currentSession'),
            startBtn: document.getElementById('startBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            resetBtn: document.getElementById('resetBtn'),
            progressRing: document.querySelector('.progress-ring-progress'),
            focusTime: document.getElementById('focusTime'),
            shortBreak: document.getElementById('shortBreak'),
            longBreak: document.getElementById('longBreak'),
            soundEnabled: document.getElementById('soundEnabled'),
            notificationsEnabled: document.getElementById('notificationsEnabled'),
            installPrompt: document.getElementById('installPrompt'),
            installBtn: document.getElementById('installBtn'),
            dismissBtn: document.getElementById('dismissBtn'),
            app: document.getElementById('app')
        };
    }

    // Event Listeners
    setupEventListeners() {
        // Timer controls
        this.elements.startBtn.addEventListener('click', () => this.startTimer());
        this.elements.pauseBtn.addEventListener('click', () => this.pauseTimer());
        this.elements.resetBtn.addEventListener('click', () => this.resetTimer());

        // Settings
        this.elements.focusTime.addEventListener('change', () => this.updateSettings());
        this.elements.shortBreak.addEventListener('change', () => this.updateSettings());
        this.elements.longBreak.addEventListener('change', () => this.updateSettings());
        this.elements.soundEnabled.addEventListener('change', () => this.updateSettings());
        this.elements.notificationsEnabled.addEventListener('change', () => this.updateSettings());

        // PWA Install
        this.elements.installBtn.addEventListener('click', () => this.installPWA());
        this.elements.dismissBtn.addEventListener('click', () => this.dismissInstallPrompt());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Visibility change (when tab becomes active/inactive)
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }

    // PWA Setup
    setupPWA() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => console.log('SW registered:', registration))
                .catch(error => console.log('SW registration failed:', error));
        }

        // Install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallPrompt();
        });

        // PWA installed
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed');
            this.hideInstallPrompt();
        });
    }

    // Notifications Setup
    async setupNotifications() {
        if ('Notification' in window && this.state.settings.notificationsEnabled) {
            if (Notification.permission === 'default') {
                await Notification.requestPermission();
            }
        }
    }

    // Audio Context for notification sounds
    createAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    // Timer Functions
    startTimer() {
        if (this.state.isPaused) {
            this.resumeTimer();
            return;
        }

        this.state.isRunning = true;
        this.state.isPaused = false;
        this.updateButtonStates();

        this.timer = setInterval(() => {
            this.state.timeLeft--;
            this.updateDisplay();
            this.updateProgressRing();

            if (this.state.timeLeft <= 0) {
                this.completeSession();
            }
        }, 1000);

        // Add pulse animation to timer
        this.elements.app.classList.add('pulse');
        setTimeout(() => this.elements.app.classList.remove('pulse'), 2000);
    }

    pauseTimer() {
        this.state.isPaused = true;
        this.state.isRunning = false;
        clearInterval(this.timer);
        this.updateButtonStates();
    }

    resumeTimer() {
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.updateButtonStates();
        this.startTimer();
    }

    resetTimer() {
        clearInterval(this.timer);
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.setTimerDuration();
        this.updateDisplay();
        this.updateProgressRing();
        this.updateButtonStates();
        this.removeThemeClass();
    }

    completeSession() {
        clearInterval(this.timer);
        this.state.isRunning = false;
        this.state.isPaused = false;

        this.playNotificationSound();
        this.showNotification();
        this.updateSessionCount();
        this.nextSession();
        this.updateButtonStates();

        // Add shake animation
        this.elements.app.classList.add('shake');
        setTimeout(() => this.elements.app.classList.remove('shake'), 500);
    }

    // Session Management
    nextSession() {
        if (this.state.sessionType === 'focus') {
            this.state.sessionCount++;
            this.saveSessionData();
            
            // Every 4 focus sessions, take a long break
            if (this.state.sessionCount % 4 === 0) {
                this.state.sessionType = 'longBreak';
            } else {
                this.state.sessionType = 'shortBreak';
            }
        } else {
            this.state.sessionType = 'focus';
            this.state.currentSessionNumber++;
        }

        this.setTimerDuration();
        this.updateDisplay();
        this.updateProgressRing();
        this.updateTheme();
    }

    setTimerDuration() {
        const duration = this.getDurationForSession();
        this.state.timeLeft = duration * 60;
        this.state.totalTime = duration * 60;
    }

    getDurationForSession() {
        switch (this.state.sessionType) {
            case 'focus':
                return this.state.settings.focusTime;
            case 'shortBreak':
                return this.state.settings.shortBreak;
            case 'longBreak':
                return this.state.settings.longBreak;
            default:
                return this.state.settings.focusTime;
        }
    }

    // Display Updates
    updateDisplay() {
        const minutes = Math.floor(this.state.timeLeft / 60);
        const seconds = this.state.timeLeft % 60;
        
        this.elements.timeDisplay.textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        this.elements.sessionType.textContent = this.getSessionTypeText();
        this.elements.sessionCount.textContent = this.state.sessionCount;
        this.elements.currentSession.textContent = `Session ${this.state.currentSessionNumber}`;

        // Update page title for tab
        document.title = `${this.elements.timeDisplay.textContent} - ${this.getSessionTypeText()} | POROMODO`;
    }

    updateProgressRing() {
        const progress = 1 - (this.state.timeLeft / this.state.totalTime);
        const circumference = 2 * Math.PI * 110; // 110 is the radius
        const strokeDashoffset = circumference * (1 - progress);
        
        this.elements.progressRing.style.strokeDashoffset = strokeDashoffset;
    }

    updateButtonStates() {
        this.elements.startBtn.disabled = this.state.isRunning;
        this.elements.pauseBtn.disabled = !this.state.isRunning;
        
        // Update button text
        if (this.state.isPaused) {
            this.elements.startBtn.innerHTML = '<span class="btn-icon">▶️</span>Resume';
        } else {
            this.elements.startBtn.innerHTML = '<span class="btn-icon">▶️</span>Start';
        }
    }

    updateTheme() {
        this.removeThemeClass();
        if (this.state.sessionType !== 'focus') {
            this.elements.app.classList.add('break-mode');
        }
    }

    removeThemeClass() {
        this.elements.app.classList.remove('break-mode');
    }

    getSessionTypeText() {
        switch (this.state.sessionType) {
            case 'focus':
                return 'Focus Time';
            case 'shortBreak':
                return 'Short Break';
            case 'longBreak':
                return 'Long Break';
            default:
                return 'Focus Time';
        }
    }

    // Settings Management
    updateSettings() {
        this.state.settings = {
            focusTime: parseInt(this.elements.focusTime.value),
            shortBreak: parseInt(this.elements.shortBreak.value),
            longBreak: parseInt(this.elements.longBreak.value),
            soundEnabled: this.elements.soundEnabled.checked,
            notificationsEnabled: this.elements.notificationsEnabled.checked
        };

        this.saveSettings();
        
        // Update current timer if not running
        if (!this.state.isRunning) {
            this.setTimerDuration();
            this.updateDisplay();
            this.updateProgressRing();
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('poromodo_settings');
        if (saved) {
            this.state.settings = { ...this.state.settings, ...JSON.parse(saved) };
        }

        // Load session data
        const sessionData = localStorage.getItem('poromodo_session_data');
        if (sessionData) {
            const data = JSON.parse(sessionData);
            const today = new Date().toDateString();
            if (data.date === today) {
                this.state.sessionCount = data.count;
            }
        }

        // Update UI with loaded settings
        this.elements.focusTime.value = this.state.settings.focusTime;
        this.elements.shortBreak.value = this.state.settings.shortBreak;
        this.elements.longBreak.value = this.state.settings.longBreak;
        this.elements.soundEnabled.checked = this.state.settings.soundEnabled;
        this.elements.notificationsEnabled.checked = this.state.settings.notificationsEnabled;

        this.setTimerDuration();
    }

    saveSettings() {
        localStorage.setItem('poromodo_settings', JSON.stringify(this.state.settings));
    }

    saveSessionData() {
        const sessionData = {
            date: new Date().toDateString(),
            count: this.state.sessionCount
        };
        localStorage.setItem('poromodo_session_data', JSON.stringify(sessionData));
    }

    // Notifications
    playNotificationSound() {
        if (!this.state.settings.soundEnabled) return;

        try {
            if (this.audioContext) {
                // Create a simple beep sound
                const oscillator = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                
                oscillator.connect(gain);
                gain.connect(this.audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.5);
            }
        } catch (e) {
            console.log('Audio notification failed:', e);
        }
    }

    showNotification() {
        if (!this.state.settings.notificationsEnabled) return;
        if (Notification.permission !== 'granted') return;

        const title = this.state.sessionType === 'focus' ? 
            '🍅 Focus Session Complete!' : 
            '☕ Break Time Over!';
        
        const body = this.state.sessionType === 'focus' ? 
            'Great job! Time for a break.' : 
            'Break\'s over. Ready to focus?';

        new Notification(title, {
            body: body,
            icon: 'icons/icon-192x192.svg',
            badge: 'icons/icon-192x192.svg',
            tag: 'poromodo-timer'
        });
    }

    // Keyboard Shortcuts
    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT') return;

        switch (e.key) {
            case ' ':
            case 'Enter':
                e.preventDefault();
                if (this.state.isRunning) {
                    this.pauseTimer();
                } else {
                    this.startTimer();
                }
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                this.resetTimer();
                break;
        }
    }

    // Visibility Change Handler
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden - save state
            this.saveCurrentState();
        } else {
            // Page is visible - restore state if needed
            this.restoreCurrentState();
        }
    }

    saveCurrentState() {
        const state = {
            isRunning: this.state.isRunning,
            timeLeft: this.state.timeLeft,
            sessionType: this.state.sessionType,
            timestamp: Date.now()
        };
        localStorage.setItem('poromodo_current_state', JSON.stringify(state));
    }

    restoreCurrentState() {
        const saved = localStorage.getItem('poromodo_current_state');
        if (!saved) return;

        const state = JSON.parse(saved);
        const now = Date.now();
        const elapsed = Math.floor((now - state.timestamp) / 1000);

        if (state.isRunning && elapsed > 0) {
            this.state.timeLeft = Math.max(0, state.timeLeft - elapsed);
            this.state.sessionType = state.sessionType;
            
            if (this.state.timeLeft <= 0) {
                this.completeSession();
            } else {
                this.updateDisplay();
                this.updateProgressRing();
                this.startTimer();
            }
        }
    }

    // PWA Install Functions
    showInstallPrompt() {
        this.elements.installPrompt.classList.remove('hidden');
    }

    hideInstallPrompt() {
        this.elements.installPrompt.classList.add('hidden');
    }

    async installPWA() {
        if (!this.deferredPrompt) return;

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('PWA installed');
        }
        
        this.deferredPrompt = null;
        this.hideInstallPrompt();
    }

    dismissInstallPrompt() {
        this.hideInstallPrompt();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroTimer();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    // Save current state
    if (window.pomodoroTimer) {
        window.pomodoroTimer.saveCurrentState();
    }
}); 