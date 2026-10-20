let highestZIndex = 10;
let centerWindows = false;
const SETTINGS_STORAGE_KEY = 'arcticweb-settings';
const WALLPAPER_DATABASE = 'arcticweb-wallpapers';
const WALLPAPER_STORE = 'images';
let savedSettings = {};

try {
    savedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)) || {};
} catch {
    savedSettings = {};
}

function saveSettings(changes) {
    savedSettings = { ...savedSettings, ...changes };
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(savedSettings));
        return true;
    } catch (error) {
        console.warn('Could not save ArcticWEB settings:', error);
        return false;
    }
}

function openWallpaperDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(WALLPAPER_DATABASE, 1);
        request.addEventListener('upgradeneeded', () => {
            if (!request.result.objectStoreNames.contains(WALLPAPER_STORE)) {
                request.result.createObjectStore(WALLPAPER_STORE);
            }
        });
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
    });
}

async function saveWallpaperImage(dataUrl, key = 'custom') {
    const response = await fetch(dataUrl);
    const imageBlob = await response.blob();
    const database = await openWallpaperDatabase();
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(WALLPAPER_STORE, 'readwrite');
            transaction.objectStore(WALLPAPER_STORE).put(imageBlob, key);
            transaction.addEventListener('complete', resolve, { once: true });
            transaction.addEventListener('error', () => reject(transaction.error), { once: true });
            transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
        });
    } finally {
        database.close();
    }
    return key;
}

async function loadWallpaperImage(key = 'custom') {
    const database = await openWallpaperDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(WALLPAPER_STORE, 'readonly');
            const request = transaction.objectStore(WALLPAPER_STORE).get(key);
            request.addEventListener('success', () => resolve(request.result || null), { once: true });
            request.addEventListener('error', () => reject(request.error), { once: true });
        });
    } finally {
        database.close();
    }
}

async function deleteWallpaperImage(key) {
    const database = await openWallpaperDatabase();
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(WALLPAPER_STORE, 'readwrite');
            transaction.objectStore(WALLPAPER_STORE).delete(key);
            transaction.addEventListener('complete', resolve, { once: true });
            transaction.addEventListener('error', () => reject(transaction.error), { once: true });
            transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
        });
    } finally {
        database.close();
    }
}

const startupScreen = document.querySelector('#startup-screen');
startupScreen?.addEventListener('animationend', (event) => {
    if (event.animationName === 'startup-exit') startupScreen.remove();
});

function openWindow(id) {
    const windowElement = document.getElementById(id);
    if (!windowElement) return;
    windowElement.classList.add('is-running');
    windowElement.style.display = 'block';
    windowElement.style.zIndex = ++highestZIndex;
    if (centerWindows) {
        windowElement.style.left = `${Math.max(24, (window.innerWidth - windowElement.offsetWidth) / 2)}px`;
        windowElement.style.top = `${Math.max(24, (window.innerHeight - windowElement.offsetHeight) / 2)}px`;
    }
    if (id === 'paint-window') window.requestAnimationFrame(resizePaintCanvas);
    updateTaskbarState();
}

function closeWindow(id) {
    const windowElement = document.getElementById(id);
    if (!windowElement) return;
    windowElement.classList.remove('is-running');
    windowElement.style.removeProperty('display');
    updateTaskbarState();
}

function minimizeWindow(id) {
    const windowElement = document.getElementById(id);
    if (!windowElement) return;
    windowElement.style.removeProperty('display');
    updateTaskbarState();
}

function updateTaskbarState() {
    document.querySelectorAll('.taskbar-app[data-open-window]').forEach((button) => {
        const windowElement = document.getElementById(button.dataset.openWindow);
        button.classList.toggle('is-active', windowElement?.classList.contains('is-running'));
    });
}

function updateClock() {
    const clock = document.querySelector('#taskbar-clock');
    if (!clock) return;
    const now = new Date();
    clock.dateTime = now.toISOString();
    const date = now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    clock.innerHTML = `<span class="taskbar-time">${time}</span><span class="taskbar-date">${date}</span>`;
}

document.querySelectorAll('[data-open-window]').forEach((button) => {
    button.addEventListener('click', () => openWindow(button.dataset.openWindow));
});

const appMenu = document.querySelector('#app-menu');
const appMenuToggle = document.querySelector('#app-menu-toggle');
const activitiesToggle = document.querySelector('#activities-toggle');

function setAppMenuOpen(isOpen) {
    appMenu.classList.toggle('is-open', isOpen);
    appMenu.setAttribute('aria-hidden', String(!isOpen));
    appMenuToggle.setAttribute('aria-expanded', String(isOpen));
    activitiesToggle.setAttribute('aria-expanded', String(isOpen));
}

appMenuToggle.addEventListener('click', () => {
    setAppMenuOpen(appMenuToggle.getAttribute('aria-expanded') !== 'true');
});

activitiesToggle.addEventListener('click', () => {
    setAppMenuOpen(appMenuToggle.getAttribute('aria-expanded') !== 'true');
});

appMenu.addEventListener('click', (event) => {
    const installedApp = event.target.closest('[data-installed-app]');
    if (installedApp) openWindow(installedApp.dataset.openWindow);
    if (event.target.closest('[data-open-window]')) setAppMenuOpen(false);
});

document.addEventListener('click', (event) => {
    if (!appMenu.contains(event.target) && !appMenuToggle.contains(event.target) && !activitiesToggle.contains(event.target)) {
        setAppMenuOpen(false);
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && appMenuToggle.getAttribute('aria-expanded') === 'true') {
        setAppMenuOpen(false);
        appMenuToggle.focus();
    }
});

document.querySelectorAll('[data-close-window]').forEach((button) => {
    button.addEventListener('click', () => closeWindow(button.dataset.closeWindow));
});

document.querySelectorAll('[data-minimize-window]').forEach((button) => {
    button.addEventListener('click', () => minimizeWindow(button.dataset.minimizeWindow));
});

document.querySelectorAll('[data-settings-page]').forEach((button) => {
    button.addEventListener('click', () => {
        const page = button.dataset.settingsPage;
        document.querySelectorAll('[data-settings-page]').forEach((item) => {
            item.classList.toggle('active', item === button);
        });
        document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
            panel.hidden = panel.dataset.settingsPanel !== page;
        });
        document.querySelector('.settings-content').scrollTop = 0;
    });
});

document.querySelectorAll('.window').forEach((windowElement) => {
    windowElement.addEventListener('pointerdown', () => {
        windowElement.style.zIndex = ++highestZIndex;
    });

    const header = windowElement.querySelector('.window-header');
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    header.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        const bounds = windowElement.getBoundingClientRect();
        dragOffsetX = event.clientX - bounds.left;
        dragOffsetY = event.clientY - bounds.top;
        header.setPointerCapture(event.pointerId);
        windowElement.style.zIndex = ++highestZIndex;
    });

    header.addEventListener('pointermove', (event) => {
        if (!header.hasPointerCapture(event.pointerId)) return;
        const maxLeft = Math.max(0, window.innerWidth - windowElement.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - windowElement.offsetHeight);
        const left = Math.min(maxLeft, Math.max(0, event.clientX - dragOffsetX));
        const top = Math.min(maxTop, Math.max(0, event.clientY - dragOffsetY));
        windowElement.style.left = `${left}px`;
        windowElement.style.top = `${top}px`;
    });

    header.addEventListener('pointerup', (event) => {
        if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
    });
});

const themes = {
    arctic: {
        '--window-header': '#131c24',
        '--window-header-text': '#e3edf7',
        '--taskbar-background': 'rgba(8, 15, 21, 0.92)',
        '--taskbar-border': 'rgba(255, 255, 255, .22)',
        '--ui-accent': '#70d6ff'
    },
    night: {
        '--window-header': '#12132b',
        '--window-header-text': '#edf0ff',
        '--taskbar-background': 'rgba(10, 10, 29, 0.94)',
        '--taskbar-border': 'rgba(143, 150, 255, .30)',
        '--ui-accent': '#a5a6ff'
    },
    ice: {
        '--window-header': '#d8f2f7',
        '--window-header-text': '#173f50',
        '--taskbar-background': 'rgba(218, 244, 248, 0.92)',
        '--taskbar-border': 'rgba(30, 98, 120, .36)',
        '--ui-accent': '#167e9e'
    }
};

function applyTheme(theme) {
    const desktop = document.querySelector('#desktop');
    Object.entries(themes[theme]).forEach(([property, value]) => desktop.style.setProperty(property, value));
    document.querySelectorAll('[data-theme]').forEach((button) => {
        button.classList.toggle('active', button.dataset.theme === theme);
    });
}

document.querySelectorAll('[data-theme]').forEach((button) => {
    button.addEventListener('click', () => {
        applyTheme(button.dataset.theme);
        saveSettings({ theme: button.dataset.theme });
    });
});

const wallpapers = {
    mountains: 'url("wallpaper.jpg")',
    arctic: 'linear-gradient(135deg, #0b131a, #182836 52%, #2c4c5e)',
    aurora: 'radial-gradient(circle at 72% 24%, #6fd4b4 0 5%, transparent 29%), linear-gradient(135deg, #07192a, #17434c 52%, #18336e)',
    frost: 'radial-gradient(circle at 30% 20%, #e6fbff 0 3%, transparent 22%), linear-gradient(135deg, #426f86, #92c8d5 52%, #dceef2)'
};

const desktop = document.querySelector('#desktop');
const logo = document.querySelector('.logo');
const logoContrast = document.querySelector('#logo-contrast');
let customWallpaperSource = null;
let customWallpaperObjectUrl = null;
let logoContrastRenderId = 0;
let wallpaperChangeId = 0;

function clearCustomWallpaperObjectUrl() {
    if (customWallpaperObjectUrl) URL.revokeObjectURL(customWallpaperObjectUrl);
    customWallpaperObjectUrl = null;
}

function renderLogoContrast() {
    if (!customWallpaperSource || logo.style.display === 'none') {
        logoContrast.style.display = 'none';
        logo.classList.remove('has-contrast-wallpaper');
        return;
    }

    const renderId = ++logoContrastRenderId;
    const image = new Image();
    image.addEventListener('load', () => {
        if (renderId !== logoContrastRenderId || !customWallpaperSource || logo.style.display === 'none') return;
        const bounds = desktop.getBoundingClientRect();
        const logoBounds = logo.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(bounds.width * pixelRatio));
        const height = Math.max(1, Math.round(bounds.height * pixelRatio));

        logoContrast.width = width;
        logoContrast.height = height;
        const outputContext = logoContrast.getContext('2d');
        const wallpaperCanvas = document.createElement('canvas');
        wallpaperCanvas.width = width;
        wallpaperCanvas.height = height;
        const wallpaperContext = wallpaperCanvas.getContext('2d', { willReadFrequently: true });
        wallpaperContext.scale(pixelRatio, pixelRatio);
        const scale = Math.max(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
        const imageWidth = image.naturalWidth * scale;
        const imageHeight = image.naturalHeight * scale;
        wallpaperContext.drawImage(image, (bounds.width - imageWidth) / 2, (bounds.height - imageHeight) / 2, imageWidth, imageHeight);
        wallpaperContext.fillStyle = 'rgba(8, 21, 29, .15)';
        wallpaperContext.fillRect(0, 0, bounds.width, bounds.height);

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
        maskContext.scale(pixelRatio, pixelRatio);
        const style = getComputedStyle(logo);
        maskContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        maskContext.textAlign = 'center';
        maskContext.textBaseline = 'middle';
        if ('letterSpacing' in maskContext) maskContext.letterSpacing = style.letterSpacing;
        maskContext.fillStyle = '#fff';
        maskContext.fillText(
            logo.textContent.trim(),
            logoBounds.left - bounds.left + logoBounds.width / 2,
            logoBounds.top - bounds.top + logoBounds.height / 2
        );

        const mask = maskContext.getImageData(0, 0, width, height).data;
        const wallpaper = wallpaperContext.getImageData(0, 0, width, height).data;
        const result = outputContext.createImageData(width, height);
        for (let index = 0; index < mask.length; index += 4) {
            const alpha = mask[index + 3];
            if (!alpha) continue;
            const luminance = wallpaper[index] * 0.2126 + wallpaper[index + 1] * 0.7152 + wallpaper[index + 2] * 0.0722;
            const textColor = luminance >= 145 ? 0 : 255;
            result.data[index] = textColor;
            result.data[index + 1] = textColor;
            result.data[index + 2] = textColor;
            result.data[index + 3] = alpha;
        }
        outputContext.putImageData(result, 0, 0);
        logo.classList.add('has-contrast-wallpaper');
        logoContrast.style.display = 'block';
    });
    image.addEventListener('error', () => {
        if (renderId !== logoContrastRenderId) return;
        console.warn('Could not analyze the custom wallpaper for logo contrast.');
        customWallpaperSource = null;
        logoContrast.style.display = 'none';
        logo.classList.remove('has-contrast-wallpaper');
    });
    image.src = customWallpaperSource;
}

window.addEventListener('resize', renderLogoContrast);

function setWallpaper(background) {
    desktop.style.background = background;
    desktop.style.backgroundSize = 'cover';
    desktop.style.backgroundPosition = 'center';
}

const RECENT_WALLPAPERS_KEY = 'arcticweb-recent-wallpapers';
const MAX_RECENT_WALLPAPERS = 8;
const recentWallpaperList = document.querySelector('#wallpaper-recents');
let recentWallpapers = [];
let recentPreviewUrls = [];

try {
    const storedRecents = JSON.parse(localStorage.getItem(RECENT_WALLPAPERS_KEY));
    if (Array.isArray(storedRecents)) {
        recentWallpapers = storedRecents.filter((entry) =>
            entry && (entry.type === 'preset' && wallpapers[entry.value]
                || entry.type === 'custom' && typeof entry.value === 'string')
        ).slice(0, MAX_RECENT_WALLPAPERS);
    }
} catch (error) {
    console.warn('Could not load recent wallpapers:', error);
}

function saveRecentWallpapers() {
    try {
        localStorage.setItem(RECENT_WALLPAPERS_KEY, JSON.stringify(recentWallpapers));
    } catch (error) {
        console.warn('Could not save recent wallpapers:', error);
    }
}

function addRecentWallpaper(entry) {
    const id = `${entry.type}:${entry.value}`;
    const existing = recentWallpapers.find((recent) => `${recent.type}:${recent.value}` === id);
    const updatedEntry = entry.type === 'custom' && !entry.label && existing?.label
        ? { ...entry, label: existing.label }
        : entry;
    const updatedRecents = [updatedEntry, ...recentWallpapers.filter((recent) => `${recent.type}:${recent.value}` !== id)];
    const removedRecents = updatedRecents.slice(MAX_RECENT_WALLPAPERS);
    recentWallpapers = updatedRecents.slice(0, MAX_RECENT_WALLPAPERS);
    removedRecents.filter((recent) => recent.type === 'custom').forEach((recent) => {
        void deleteWallpaperImage(recent.value).catch((error) => console.warn('Could not remove an expired wallpaper image:', error));
    });
    saveRecentWallpapers();
    renderRecentWallpapers();
}

function renderRecentWallpapers() {
    if (!recentWallpaperList) return;
    recentPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    recentPreviewUrls = [];
    recentWallpaperList.replaceChildren();

    recentWallpapers.forEach((entry) => {
        const button = document.createElement('button');
        button.className = 'wallpaper-recent';
        button.type = 'button';
        button.setAttribute('aria-label', entry.type === 'preset'
            ? `${entry.value} wallpaper`
            : `Custom wallpaper, ${entry.label || 'uploaded image'}`);
        const preview = document.createElement('span');
        preview.className = 'wallpaper-recent-preview';
        const label = document.createElement('span');
        label.textContent = entry.type === 'preset' ? entry.value : (entry.label || 'Custom');
        if (entry.type === 'preset') {
            preview.style.background = wallpapers[entry.value];
        } else {
            void loadWallpaperImage(entry.value).then((imageBlob) => {
                if (!imageBlob || !button.isConnected) return;
                const previewUrl = URL.createObjectURL(imageBlob);
                recentPreviewUrls.push(previewUrl);
                preview.style.backgroundImage = `url("${previewUrl}")`;
            }).catch((error) => console.warn('Could not load a recent wallpaper preview:', error));
        }

        const activeWallpaper = savedSettings.wallpaper;
        const isCurrent = entry.type === 'preset'
            ? activeWallpaper?.type === 'preset' && activeWallpaper.value === entry.value
            : activeWallpaper?.type === 'custom'
                && (activeWallpaper.value === entry.value || activeWallpaper.value === 'indexeddb' && entry.value === 'custom');
        button.classList.toggle('is-current', isCurrent);
        button.append(preview, label);
        button.addEventListener('click', () => {
            if (entry.type === 'preset') {
                document.querySelector(`[data-wallpaper="${entry.value}"]`)?.click();
            } else {
                void selectRecentCustomWallpaper(entry);
            }
        });
        recentWallpaperList.append(button);
    });
}

async function selectRecentCustomWallpaper(entry) {
    try {
        const changeId = ++wallpaperChangeId;
        const imageBlob = await loadWallpaperImage(entry.value);
        if (!imageBlob) {
            console.warn('The selected recent wallpaper image is missing.');
            return;
        }
        if (changeId !== wallpaperChangeId) return;
        clearCustomWallpaperObjectUrl();
        customWallpaperObjectUrl = URL.createObjectURL(imageBlob);
        customWallpaperSource = customWallpaperObjectUrl;
        setWallpaper(`linear-gradient(rgba(8, 21, 29, .15), rgba(8, 21, 29, .15)), url("${customWallpaperSource}")`);
        renderLogoContrast();
        document.querySelectorAll('[data-wallpaper]').forEach((choice) => choice.classList.remove('active'));
        saveSettings({ wallpaper: { type: 'custom', value: entry.value } });
        addRecentWallpaper(entry);
    } catch (error) {
        console.warn('Could not apply the recent wallpaper:', error);
    }
}

document.querySelectorAll('[data-wallpaper]').forEach((button) => {
    button.addEventListener('click', () => {
        wallpaperChangeId += 1;
        clearCustomWallpaperObjectUrl();
        customWallpaperSource = null;
        logoContrastRenderId += 1;
        logoContrast.style.display = 'none';
        logo.classList.remove('has-contrast-wallpaper');
        setWallpaper(wallpapers[button.dataset.wallpaper]);
        document.querySelectorAll('[data-wallpaper]').forEach((choice) => {
            choice.classList.toggle('active', choice === button);
        });
        const entry = { type: 'preset', value: button.dataset.wallpaper };
        saveSettings({ wallpaper: entry });
        addRecentWallpaper(entry);
    });
});

document.querySelector('#wallpaper-upload').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const changeId = ++wallpaperChangeId;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        if (typeof reader.result !== 'string') {
            console.warn('Could not read the selected wallpaper image.');
            return;
        }
        clearCustomWallpaperObjectUrl();
        customWallpaperSource = reader.result;
        setWallpaper(`linear-gradient(rgba(8, 21, 29, .15), rgba(8, 21, 29, .15)), url("${reader.result}")`);
        renderLogoContrast();
        document.querySelectorAll('[data-wallpaper]').forEach((choice) => choice.classList.remove('active'));
        const key = `wallpaper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        void saveWallpaperImage(reader.result, key).then(() => {
            if (changeId === wallpaperChangeId) {
                const entry = { type: 'custom', value: key, label: file.name.replace(/\.[^.]+$/, '') || 'Custom' };
                saveSettings({ wallpaper: { type: 'custom', value: key } });
                addRecentWallpaper(entry);
            }
        }).catch((error) => {
            console.warn('Could not store the wallpaper image in IndexedDB:', error);
            if (changeId !== wallpaperChangeId) return;
            if (!saveSettings({ wallpaper: { type: 'custom', value: reader.result } })) {
                window.alert('This image could not be saved. Try a smaller wallpaper image.');
            }
        });
    });
    reader.readAsDataURL(file);
});

document.querySelector('#logo-toggle').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const visible = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(visible));
    logo.style.display = visible ? '' : 'none';
    renderLogoContrast();
    saveSettings({ showLogo: visible });
});

document.querySelector('#icon-size').addEventListener('input', (event) => {
    const size = Number(event.target.value);
    const desktop = document.querySelector('#desktop');
    desktop.style.setProperty('--app-icon-size', `${size}px`);
    desktop.style.setProperty('--app-tile-size', `${Math.round(size * 0.66)}px`);
    document.querySelector('#icon-size-value').textContent = `${size}px`;
    saveSettings({ iconSize: size });
});

document.querySelector('#window-opacity').addEventListener('input', (event) => {
    const opacity = Number(event.target.value);
    document.querySelectorAll('.window').forEach((windowElement) => {
        windowElement.style.opacity = opacity / 100;
    });
    document.querySelector('#window-opacity-value').textContent = `${opacity}%`;
    saveSettings({ windowOpacity: opacity });
});

document.querySelector('#center-windows-toggle').addEventListener('click', (event) => {
    const button = event.currentTarget;
    centerWindows = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(centerWindows));
    saveSettings({ centerWindows });
});

document.querySelector('#browser-url').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !event.target.value.trim()) return;
    let url = event.target.value.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    window.open(url, '_blank', 'noopener');
});

const NOTES_STORAGE_KEY = 'arcticweb-notes';
const notesEditor = document.querySelector('#notes-editor');
try {
    notesEditor.value = localStorage.getItem(NOTES_STORAGE_KEY) || '';
} catch (error) {
    console.warn('Could not load ArcticWEB notes:', error);
}
notesEditor.addEventListener('input', () => {
    try {
        localStorage.setItem(NOTES_STORAGE_KEY, notesEditor.value);
    } catch (error) {
        console.warn('Could not save ArcticWEB notes:', error);
    }
});

const calculatorDisplay = document.querySelector('#calculator-display');
let calculatorInput = '0';
let calculatorStoredValue = null;
let calculatorOperator = null;
let calculatorWaitingForOperand = false;

function updateCalculatorDisplay() {
    calculatorDisplay.textContent = calculatorInput;
}

function performCalculation(left, right, operator) {
    if (operator === '+') return left + right;
    if (operator === '-') return left - right;
    if (operator === '*') return left * right;
    if (operator === '/') return left / right;
    return right;
}

function handleCalculatorKey(key) {
    if (/^\d$/.test(key)) {
        calculatorInput = calculatorWaitingForOperand || calculatorInput === '0'
            ? key
            : calculatorInput + key;
        calculatorWaitingForOperand = false;
    } else if (key === '.') {
        if (calculatorWaitingForOperand) {
            calculatorInput = '0.';
            calculatorWaitingForOperand = false;
        } else if (!calculatorInput.includes('.')) {
            calculatorInput += '.';
        }
    } else if (key === 'clear') {
        calculatorInput = '0';
        calculatorStoredValue = null;
        calculatorOperator = null;
        calculatorWaitingForOperand = false;
    } else if (key === 'delete') {
        if (!calculatorWaitingForOperand) {
            calculatorInput = calculatorInput.length > 1 ? calculatorInput.slice(0, -1) : '0';
        }
    } else if (key === 'equals' || ['+', '-', '*', '/'].includes(key)) {
        const currentValue = Number(calculatorInput);
        if (calculatorOperator && calculatorStoredValue !== null && !calculatorWaitingForOperand) {
            const result = performCalculation(calculatorStoredValue, currentValue, calculatorOperator);
            if (!Number.isFinite(result)) {
                calculatorInput = 'Error';
                calculatorStoredValue = null;
                calculatorOperator = null;
                calculatorWaitingForOperand = true;
                updateCalculatorDisplay();
                return;
            }
            calculatorInput = String(Number(result.toPrecision(12)));
            calculatorStoredValue = Number(calculatorInput);
        } else {
            calculatorStoredValue = currentValue;
        }
        calculatorOperator = key === 'equals' ? null : key;
        calculatorWaitingForOperand = true;
    }
    updateCalculatorDisplay();
}

document.querySelectorAll('[data-calculator-key]').forEach((button) => {
    button.addEventListener('click', () => handleCalculatorKey(button.dataset.calculatorKey));
});

const calendarMonth = document.querySelector('#calendar-month');
const calendarDays = document.querySelector('#calendar-days');
const calendarSelectedDate = document.querySelector('#calendar-selected-date');
let calendarView = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = new Date();

function renderCalendar() {
    const today = new Date();
    calendarMonth.textContent = calendarView.toLocaleDateString([], { month: 'long', year: 'numeric' });
    calendarDays.replaceChildren();
    const firstWeekday = calendarView.getDay();
    const monthStart = new Date(calendarView.getFullYear(), calendarView.getMonth(), 1 - firstWeekday);

    for (let index = 0; index < 42; index += 1) {
        const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() + index);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'calendar-day';
        button.textContent = String(date.getDate());
        button.dataset.date = dateKey;
        button.setAttribute('aria-label', date.toLocaleDateString([], { dateStyle: 'full' }));
        if (date.getMonth() !== calendarView.getMonth()) button.classList.add('outside-month');
        if (date.toDateString() === today.toDateString()) button.classList.add('today');
        if (date.toDateString() === selectedCalendarDate.toDateString()) button.classList.add('selected');
        calendarDays.append(button);
    }
    calendarSelectedDate.textContent = `Selected: ${selectedCalendarDate.toLocaleDateString([], { dateStyle: 'full' })}`;
}

document.querySelector('#calendar-previous').addEventListener('click', () => {
    calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1);
    renderCalendar();
});
document.querySelector('#calendar-next').addEventListener('click', () => {
    calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1);
    renderCalendar();
});
calendarDays.addEventListener('click', (event) => {
    const day = event.target.closest('[data-date]');
    if (!day) return;
    const [year, month, date] = day.dataset.date.split('-').map(Number);
    selectedCalendarDate = new Date(year, month - 1, date);
    calendarView = new Date(year, month - 1, 1);
    renderCalendar();
});
renderCalendar();

const TODO_STORAGE_KEY = 'arcticweb-todos';
const todoForm = document.querySelector('#todo-form');
const todoInput = document.querySelector('#todo-input');
const todoList = document.querySelector('#todo-list');
let todoItems = [];
try {
    const storedTodos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    if (Array.isArray(storedTodos)) {
        todoItems = storedTodos.filter((item) =>
            item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.done === 'boolean'
        );
    }
} catch (error) {
    console.warn('Could not load ArcticWEB tasks:', error);
}

function saveTodos() {
    try {
        localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todoItems));
    } catch (error) {
        console.warn('Could not save ArcticWEB tasks:', error);
    }
}

function renderTodos() {
    todoList.replaceChildren();
    todoItems.forEach((item) => {
        const row = document.createElement('li');
        row.className = `todo-item${item.done ? ' is-done' : ''}`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = item.done;
        checkbox.setAttribute('aria-label', `Mark ${item.text} complete`);
        checkbox.addEventListener('change', () => {
            item.done = checkbox.checked;
            saveTodos();
            renderTodos();
        });
        const text = document.createElement('span');
        text.textContent = item.text;
        const remove = document.createElement('button');
        remove.className = 'todo-delete';
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Delete ${item.text}`);
        remove.addEventListener('click', () => {
            todoItems = todoItems.filter((todo) => todo.id !== item.id);
            saveTodos();
            renderTodos();
        });
        row.append(checkbox, text, remove);
        todoList.append(row);
    });
}

todoForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = todoInput.value.trim();
    if (!text) return;
    todoItems.push({ id: `${Date.now()}-${Math.random()}`, text, done: false });
    saveTodos();
    renderTodos();
    todoForm.reset();
    todoInput.focus();
});
renderTodos();

const paintCanvas = document.querySelector('#paint-canvas');
const paintContext = paintCanvas.getContext('2d');
let paintDrawing = false;
let previousPaintPoint = null;

function resizePaintCanvas() {
    const bounds = paintCanvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (paintCanvas.width === width && paintCanvas.height === height) return;
    const snapshot = document.createElement('canvas');
    snapshot.width = paintCanvas.width;
    snapshot.height = paintCanvas.height;
    snapshot.getContext('2d').drawImage(paintCanvas, 0, 0);
    paintCanvas.width = width;
    paintCanvas.height = height;
    paintContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (snapshot.width && snapshot.height) paintContext.drawImage(snapshot, 0, 0, bounds.width, bounds.height);
}

function getPaintPoint(event) {
    const bounds = paintCanvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

paintCanvas.addEventListener('pointerdown', (event) => {
    resizePaintCanvas();
    paintDrawing = true;
    previousPaintPoint = getPaintPoint(event);
    paintCanvas.setPointerCapture(event.pointerId);
});
paintCanvas.addEventListener('pointermove', (event) => {
    if (!paintDrawing || !previousPaintPoint) return;
    const point = getPaintPoint(event);
    paintContext.beginPath();
    paintContext.moveTo(previousPaintPoint.x, previousPaintPoint.y);
    paintContext.lineTo(point.x, point.y);
    paintContext.strokeStyle = document.querySelector('#paint-color').value;
    paintContext.lineWidth = Number(document.querySelector('#paint-size').value);
    paintContext.lineCap = 'round';
    paintContext.lineJoin = 'round';
    paintContext.stroke();
    previousPaintPoint = point;
});
function stopPaintDrawing(event) {
    paintDrawing = false;
    previousPaintPoint = null;
    if (paintCanvas.hasPointerCapture(event.pointerId)) paintCanvas.releasePointerCapture(event.pointerId);
}
paintCanvas.addEventListener('pointerup', stopPaintDrawing);
paintCanvas.addEventListener('pointercancel', stopPaintDrawing);
window.addEventListener('resize', resizePaintCanvas);
document.querySelector('#paint-clear').addEventListener('click', () => {
    paintContext.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
});
document.querySelector('#paint-download').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'arcticweb-drawing.png';
    link.href = paintCanvas.toDataURL('image/png');
    link.click();
});
resizePaintCanvas();

const clockNow = document.querySelector('#clock-now');
const stopwatchDisplay = document.querySelector('#stopwatch-display');
const stopwatchToggle = document.querySelector('#stopwatch-toggle');
let stopwatchStartedAt = 0;
let stopwatchElapsed = 0;
let stopwatchRunning = false;
let lastClockSecond = -1;

function updateClockApp() {
    const now = new Date();
    if (now.getSeconds() !== lastClockSecond) {
        clockNow.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        lastClockSecond = now.getSeconds();
    }
    if (stopwatchRunning) {
        const elapsed = stopwatchElapsed + performance.now() - stopwatchStartedAt;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const tenths = Math.floor((elapsed % 1000) / 100);
        stopwatchDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
    }
}
stopwatchToggle.addEventListener('click', () => {
    if (stopwatchRunning) {
        stopwatchElapsed += performance.now() - stopwatchStartedAt;
        stopwatchRunning = false;
        stopwatchToggle.textContent = 'Start';
    } else {
        stopwatchStartedAt = performance.now();
        stopwatchRunning = true;
        stopwatchToggle.textContent = 'Pause';
    }
    updateClockApp();
});
document.querySelector('#stopwatch-reset').addEventListener('click', () => {
    stopwatchRunning = false;
    stopwatchElapsed = 0;
    stopwatchDisplay.textContent = '00:00.0';
    stopwatchToggle.textContent = 'Start';
});
updateClockApp();
window.setInterval(updateClockApp, 100);

const colorInput = document.querySelector('#color-input');
const colorHex = document.querySelector('#color-hex');
const colorPreview = document.querySelector('#color-preview');

function updatePickedColor(value) {
    const normalized = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
    if (!/^#[\da-f]{6}$/i.test(normalized)) {
        colorHex.setCustomValidity('Enter a valid six-digit hex color.');
        return;
    }
    colorHex.setCustomValidity('');
    colorInput.value = normalized;
    colorHex.value = normalized.toLowerCase();
    colorPreview.style.backgroundColor = normalized;
}
colorInput.addEventListener('input', () => updatePickedColor(colorInput.value));
colorHex.addEventListener('input', () => updatePickedColor(colorHex.value));
document.querySelector('#color-copy').addEventListener('click', async (event) => {
    try {
        await navigator.clipboard.writeText(colorInput.value);
        event.currentTarget.textContent = 'Copied';
        window.setTimeout(() => { event.currentTarget.textContent = 'Copy'; }, 1200);
    } catch (error) {
        console.warn('Could not copy the selected color:', error);
        colorHex.focus();
        colorHex.select();
        event.currentTarget.textContent = 'Select hex';
        window.setTimeout(() => { event.currentTarget.textContent = 'Copy'; }, 1600);
    }
});

const conversionUnits = {
    length: {
        m: { label: 'Meters (m)', factor: 1 },
        km: { label: 'Kilometers (km)', factor: 1000 },
        cm: { label: 'Centimeters (cm)', factor: 0.01 },
        mi: { label: 'Miles (mi)', factor: 1609.344 },
        ft: { label: 'Feet (ft)', factor: 0.3048 }
    },
    weight: {
        kg: { label: 'Kilograms (kg)', factor: 1 },
        g: { label: 'Grams (g)', factor: 0.001 },
        lb: { label: 'Pounds (lb)', factor: 0.45359237 },
        oz: { label: 'Ounces (oz)', factor: 0.028349523125 }
    },
    temperature: {
        C: { label: 'Celsius (°C)' },
        F: { label: 'Fahrenheit (°F)' },
        K: { label: 'Kelvin (K)' }
    }
};
const converterCategory = document.querySelector('#converter-category');
const converterFrom = document.querySelector('#converter-from');
const converterTo = document.querySelector('#converter-to');
const converterValue = document.querySelector('#converter-value');
const converterResult = document.querySelector('#converter-result');

function populateConverterUnits() {
    const units = conversionUnits[converterCategory.value];
    [converterFrom, converterTo].forEach((select) => {
        select.replaceChildren(...Object.entries(units).map(([value, unit]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = unit.label;
            return option;
        }));
    });
    converterTo.selectedIndex = Math.min(1, converterTo.options.length - 1);
    updateConversion();
}

function convertTemperature(value, from, to) {
    const celsius = from === 'C' ? value : from === 'F' ? (value - 32) * 5 / 9 : value - 273.15;
    return to === 'C' ? celsius : to === 'F' ? celsius * 9 / 5 + 32 : celsius + 273.15;
}

function updateConversion() {
    const value = Number(converterValue.value);
    if (converterValue.value === '' || !Number.isFinite(value)) {
        converterResult.textContent = 'Enter a valid number.';
        return;
    }
    const from = converterFrom.value;
    const to = converterTo.value;
    const result = converterCategory.value === 'temperature'
        ? convertTemperature(value, from, to)
        : value * conversionUnits[converterCategory.value][from].factor / conversionUnits[converterCategory.value][to].factor;
    const formattedResult = Number(result.toPrecision(8));
    converterResult.textContent = `${value} ${from} = ${formattedResult} ${to}`;
}
converterCategory.addEventListener('change', populateConverterUnits);
converterFrom.addEventListener('change', updateConversion);
converterTo.addEventListener('change', updateConversion);
converterValue.addEventListener('input', updateConversion);
populateConverterUnits();

const STORE_INSTALLS_KEY = 'arcticweb-installed-apps';
const storeGrid = document.querySelector('#store-grid');
const storeSearch = document.querySelector('#store-search');
const storeApps = [
    { id: 'notes', name: 'Notes', category: 'Productivity', description: 'Write and keep notes on this device.', windowId: 'notes-window', icon: 'N', iconClass: 'notes-icon' },
    { id: 'calculator', name: 'Calculator', category: 'Utilities', description: 'A simple calculator for everyday sums.', windowId: 'calculator-window', icon: '÷', iconClass: 'calculator-icon' },
    { id: 'calendar', name: 'Calendar', category: 'Productivity', description: 'Browse months and select dates.', windowId: 'calendar-window', icon: '▦', iconClass: 'calendar-icon' },
    { id: 'todo', name: 'To-do', category: 'Productivity', description: 'Track tasks and mark them complete.', windowId: 'todo-window', icon: '✓', iconClass: 'tasks-icon' },
    { id: 'paint', name: 'Paint', category: 'Creative', description: 'Draw a sketch and save it as an image.', windowId: 'paint-window', icon: '✎', iconClass: 'paint-icon' },
    { id: 'clock', name: 'Clock', category: 'Utilities', description: 'Check the time and use the stopwatch.', windowId: 'clock-window', icon: '◷', iconClass: 'clock-icon' },
    { id: 'color', name: 'Color picker', category: 'Creative', description: 'Pick, preview, and copy a hex color.', windowId: 'color-window', icon: '●', iconClass: 'color-icon' },
    { id: 'converter', name: 'Unit converter', category: 'Utilities', description: 'Convert length, weight, and temperature.', windowId: 'converter-window', icon: '⇄', iconClass: 'converter-icon' },
    { id: 'focus-timer', name: 'Focus Timer', category: 'Productivity', description: 'A 25-minute timer for focused work sessions.', windowId: 'focus-window', icon: '25', iconClass: 'focus-icon', installable: true },
    { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', category: 'Games', description: 'A classic two-player game. Get three marks in a row.', windowId: 'tic-tac-toe-window', icon: '×○', iconClass: 'game-icon', installable: true },
    { id: 'memory-match', name: 'Memory Match', category: 'Games', description: 'Flip cards and find all six matching pairs.', windowId: 'memory-window', icon: '◆', iconClass: 'memory-icon', installable: true },
    { id: 'snake', name: 'Snake', category: 'Games', description: 'Eat the fruit, grow longer, and avoid the walls.', windowId: 'snake-window', icon: '●', iconClass: 'snake-icon', installable: true },
    { id: 'rock-paper-scissors', name: 'Rock Paper Scissors', category: 'Games', description: 'Play the timeless hand game against the computer.', windowId: 'rps-window', icon: '✊', iconClass: 'rps-icon', installable: true }
];
let installedApps = [];
try {
    const storedApps = JSON.parse(localStorage.getItem(STORE_INSTALLS_KEY) || '[]');
    if (Array.isArray(storedApps)) {
        installedApps = [...new Set(storedApps.filter((id) =>
            typeof id === 'string' && storeApps.some((app) => app.id === id && app.installable)
        ))];
    }
} catch (error) {
    console.warn('Could not load installed ArcticWEB apps:', error);
}

function saveInstalledApps() {
    try {
        localStorage.setItem(STORE_INSTALLS_KEY, JSON.stringify(installedApps));
    } catch (error) {
        console.warn('Could not save installed ArcticWEB apps:', error);
    }
}

function renderAppMenuInstallations() {
    document.querySelectorAll('[data-installed-app]').forEach((item) => item.remove());
    const storeButton = appMenu.querySelector('[data-open-window="store-window"]');
    installedApps.forEach((id) => {
        const app = storeApps.find((item) => item.id === id);
        if (!app) return;
        const button = document.createElement('button');
        button.className = 'app-menu-item';
        button.type = 'button';
        button.dataset.openWindow = app.windowId;
        button.dataset.installedApp = app.id;
        const icon = document.createElement('span');
        icon.className = `app-menu-icon ${app.iconClass}`;
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = app.icon;
        const text = document.createElement('span');
        text.append(app.name);
        const description = document.createElement('small');
        description.textContent = app.category === 'Games' ? 'Installed game' : app.description;
        text.append(description);
        button.append(icon, text);
        appMenu.insertBefore(button, storeButton);
    });
}

function renderStore() {
    const query = storeSearch.value.trim().toLocaleLowerCase();
    const visibleApps = storeApps.filter((app) =>
        `${app.name} ${app.category} ${app.description}`.toLocaleLowerCase().includes(query)
    );
    storeGrid.replaceChildren();
    if (visibleApps.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'store-empty';
        empty.textContent = 'No apps match your search.';
        storeGrid.append(empty);
        return;
    }

    visibleApps.forEach((app) => {
        const installed = !app.installable || installedApps.includes(app.id);
        const card = document.createElement('article');
        card.className = 'store-card';
        card.innerHTML = `
            <div class="store-card-header">
                <span class="store-app-icon ${app.iconClass}" aria-hidden="true">${app.icon}</span>
                <div><h2 class="store-app-title"></h2><p class="store-app-category"></p></div>
            </div>
            <p class="store-app-description"></p>
            <div class="store-card-footer">
                <span class="store-status"></span>
                <span class="store-card-actions"></span>
            </div>`;
        card.querySelector('.store-app-title').textContent = app.name;
        card.querySelector('.store-app-category').textContent = app.category;
        card.querySelector('.store-app-description').textContent = app.description;
        card.querySelector('.store-status').textContent = installed ? 'Installed' : 'Free';
        const actions = card.querySelector('.store-card-actions');
        if (installed) {
            const openButton = document.createElement('button');
            openButton.className = 'store-action';
            openButton.type = 'button';
            openButton.dataset.storeOpen = app.windowId;
            openButton.textContent = 'Open';
            actions.append(openButton);
            if (app.installable) {
                const removeButton = document.createElement('button');
                removeButton.className = 'store-action is-installed';
                removeButton.type = 'button';
                removeButton.dataset.storeRemove = app.id;
                removeButton.textContent = 'Remove';
                removeButton.style.marginLeft = '5px';
                actions.append(removeButton);
            }
        } else {
            const installButton = document.createElement('button');
            installButton.className = 'store-action';
            installButton.type = 'button';
            installButton.dataset.storeInstall = app.id;
            installButton.textContent = 'Install';
            actions.append(installButton);
        }
        storeGrid.append(card);
    });
}

storeGrid.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-store-open]');
    if (openButton) {
        openWindow(openButton.dataset.storeOpen);
        return;
    }

    const installButton = event.target.closest('[data-store-install]');
    const installableApp = installButton && storeApps.find((app) =>
        app.id === installButton.dataset.storeInstall && app.installable
    );
    if (installableApp) {
        installedApps = [...new Set([...installedApps, installableApp.id])];
        saveInstalledApps();
        renderAppMenuInstallations();
        renderStore();
        storeGrid.querySelector(`[data-store-open="${installableApp.windowId}"]`)?.focus();
        return;
    }

    const removeButton = event.target.closest('[data-store-remove]');
    const removableApp = removeButton && storeApps.find((app) =>
        app.id === removeButton.dataset.storeRemove && app.installable
    );
    if (removableApp) {
        closeWindow(removableApp.windowId);
        installedApps = installedApps.filter((id) => id !== removableApp.id);
        saveInstalledApps();
        renderAppMenuInstallations();
        renderStore();
        storeGrid.querySelector(`[data-store-install="${removableApp.id}"]`)?.focus();
    }
});
storeSearch.addEventListener('input', renderStore);
renderAppMenuInstallations();
renderStore();

const focusDisplay = document.querySelector('#focus-display');
const focusToggle = document.querySelector('#focus-toggle');
let focusRemaining = 25 * 60;
let focusDeadline = null;
let focusRunning = false;

function updateFocusTimer() {
    if (focusRunning) {
        focusRemaining = Math.max(0, Math.ceil((focusDeadline - Date.now()) / 1000));
        if (focusRemaining === 0) {
            focusRunning = false;
            focusDeadline = null;
            focusToggle.textContent = 'Start again';
        }
    }
    const minutes = Math.floor(focusRemaining / 60);
    const seconds = focusRemaining % 60;
    focusDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

focusToggle.addEventListener('click', () => {
    if (focusRunning) {
        focusRemaining = Math.max(0, Math.ceil((focusDeadline - Date.now()) / 1000));
        focusRunning = false;
        focusDeadline = null;
        focusToggle.textContent = focusRemaining === 0 ? 'Start again' : 'Resume';
    } else {
        if (focusRemaining === 0) focusRemaining = 25 * 60;
        focusDeadline = Date.now() + focusRemaining * 1000;
        focusRunning = true;
        focusToggle.textContent = 'Pause';
    }
    updateFocusTimer();
});
document.querySelector('#focus-reset').addEventListener('click', () => {
    focusRemaining = 25 * 60;
    focusDeadline = null;
    focusRunning = false;
    focusToggle.textContent = 'Start';
    updateFocusTimer();
});
window.setInterval(updateFocusTimer, 250);

const ticCells = [...document.querySelectorAll('[data-tic-cell]')];
const ticStatus = document.querySelector('#tic-status');
const ticWins = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
let ticBoard = Array(9).fill('');
let ticTurn = 'X';
let ticFinished = false;

function resetTicTacToe() {
    ticBoard = Array(9).fill('');
    ticTurn = 'X';
    ticFinished = false;
    ticStatus.textContent = 'X goes first';
    ticCells.forEach((cell) => {
        cell.textContent = '';
        cell.disabled = false;
    });
}

ticCells.forEach((cell) => {
    cell.addEventListener('click', () => {
        const index = Number(cell.dataset.ticCell);
        if (ticFinished || ticBoard[index]) return;
        ticBoard[index] = ticTurn;
        cell.textContent = ticTurn;
        const winner = ticWins.some((line) => line.every((position) => ticBoard[position] === ticTurn));
        if (winner) {
            ticStatus.textContent = `${ticTurn} wins!`;
            ticFinished = true;
        } else if (ticBoard.every(Boolean)) {
            ticStatus.textContent = "It's a draw!";
            ticFinished = true;
        } else {
            ticTurn = ticTurn === 'X' ? 'O' : 'X';
            ticStatus.textContent = `${ticTurn}'s turn`;
        }
        if (ticFinished) ticCells.forEach((item) => { item.disabled = true; });
    });
});
document.querySelector('#tic-reset').addEventListener('click', resetTicTacToe);

const memoryGrid = document.querySelector('#memory-grid');
const memoryStatus = document.querySelector('#memory-status');
const memorySymbols = ['❄', '●', '▲', '◆', '☀', '♫'];
let memoryCards = [];
let memoryOpen = [];
let memoryMatched = 0;
let memoryMoves = 0;
let memoryLocked = false;
let memoryMismatchTimer = null;

function resetMemoryGame() {
    window.clearTimeout(memoryMismatchTimer);
    memoryCards = [...memorySymbols, ...memorySymbols]
        .map((symbol, index) => ({ symbol, key: `${symbol}-${index}` }));
    for (let index = memoryCards.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [memoryCards[index], memoryCards[swapIndex]] = [memoryCards[swapIndex], memoryCards[index]];
    }
    memoryOpen = [];
    memoryMatched = 0;
    memoryMoves = 0;
    memoryLocked = false;
    memoryStatus.textContent = 'Find all the matching pairs.';
    memoryGrid.replaceChildren();
    memoryCards.forEach((card, index) => {
        const button = document.createElement('button');
        button.className = 'memory-card';
        button.type = 'button';
        button.dataset.memoryCard = String(index);
        button.textContent = '?';
        button.setAttribute('aria-label', `Hidden card ${index + 1}`);
        button.addEventListener('click', () => flipMemoryCard(index, button));
        memoryGrid.append(button);
    });
}

function flipMemoryCard(index, button) {
    if (memoryLocked || memoryOpen.includes(index) || button.classList.contains('is-matched')) return;
    button.classList.add('is-open');
    button.textContent = memoryCards[index].symbol;
    button.setAttribute('aria-label', `Card ${index + 1}: ${memoryCards[index].symbol}`);
    memoryOpen.push(index);
    if (memoryOpen.length < 2) return;
    memoryMoves += 1;
    const [firstIndex, secondIndex] = memoryOpen;
    const firstButton = memoryGrid.querySelector(`[data-memory-card="${firstIndex}"]`);
    const secondButton = memoryGrid.querySelector(`[data-memory-card="${secondIndex}"]`);
    if (memoryCards[firstIndex].symbol === memoryCards[secondIndex].symbol) {
        [firstButton, secondButton].forEach((item) => {
            item.classList.remove('is-open');
            item.classList.add('is-matched');
            item.disabled = true;
        });
        memoryMatched += 1;
        memoryOpen = [];
        memoryStatus.textContent = memoryMatched === memorySymbols.length
            ? `You found every pair in ${memoryMoves} moves!`
            : `${memoryMatched} of ${memorySymbols.length} pairs found · ${memoryMoves} moves`;
    } else {
        memoryLocked = true;
        memoryStatus.textContent = `Try again · ${memoryMoves} moves`;
        memoryMismatchTimer = window.setTimeout(() => {
            [firstButton, secondButton].forEach((item) => {
                item.classList.remove('is-open');
                item.textContent = '?';
                item.setAttribute('aria-label', `Hidden card ${Number(item.dataset.memoryCard) + 1}`);
            });
            memoryOpen = [];
            memoryLocked = false;
        }, 750);
    }
}
document.querySelector('#memory-reset').addEventListener('click', resetMemoryGame);
resetMemoryGame();

const snakeCanvas = document.querySelector('#snake-board');
const snakeContext = snakeCanvas.getContext('2d');
const snakeStatus = document.querySelector('#snake-status');
const snakeColumns = 18;
const snakeRows = 12;
const snakeCellSize = 20;
let snakeBody = [];
let snakeFood = { x: 12, y: 6 };
let snakeDirection = { x: 1, y: 0 };
let snakeScore = 0;
let snakeRunning = false;
let snakeTimer = null;

function drawSnake() {
    snakeContext.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    snakeContext.fillStyle = '#eaf3f3';
    snakeContext.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    snakeContext.fillStyle = '#df7c5a';
    snakeContext.beginPath();
    snakeContext.arc((snakeFood.x + 0.5) * snakeCellSize, (snakeFood.y + 0.5) * snakeCellSize, snakeCellSize * 0.34, 0, Math.PI * 2);
    snakeContext.fill();
    snakeBody.forEach((segment, index) => {
        snakeContext.fillStyle = index === 0 ? '#1d8c79' : '#56ad8c';
        snakeContext.fillRect(segment.x * snakeCellSize + 1, segment.y * snakeCellSize + 1, snakeCellSize - 2, snakeCellSize - 2);
    });
    if (!snakeRunning) {
        snakeContext.fillStyle = 'rgba(18, 44, 52, .58)';
        snakeContext.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    }
}

function setSnakeDirection(directionName) {
    const directions = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
    };
    const next = directions[directionName];
    if (next && next.x !== -snakeDirection.x && next.y !== -snakeDirection.y) snakeDirection = next;
}

function placeSnakeFood() {
    const emptyCells = [];
    for (let y = 0; y < snakeRows; y += 1) {
        for (let x = 0; x < snakeColumns; x += 1) {
            if (!snakeBody.some((segment) => segment.x === x && segment.y === y)) emptyCells.push({ x, y });
        }
    }
    if (emptyCells.length === 0) {
        snakeRunning = false;
        window.clearInterval(snakeTimer);
        snakeStatus.textContent = `You filled the board! Score: ${snakeScore}`;
        return;
    }
    snakeFood = emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

function finishSnakeGame() {
    snakeRunning = false;
    window.clearInterval(snakeTimer);
    snakeStatus.textContent = `Game over · Score: ${snakeScore}. Start again to play.`;
    drawSnake();
}

function moveSnake() {
    const head = { x: snakeBody[0].x + snakeDirection.x, y: snakeBody[0].y + snakeDirection.y };
    const eating = head.x === snakeFood.x && head.y === snakeFood.y;
    const bodyToCheck = eating ? snakeBody : snakeBody.slice(0, -1);
    if (head.x < 0 || head.x >= snakeColumns || head.y < 0 || head.y >= snakeRows ||
        bodyToCheck.some((segment) => segment.x === head.x && segment.y === head.y)) {
        finishSnakeGame();
        return;
    }
    snakeBody.unshift(head);
    if (eating) {
        snakeScore += 1;
        placeSnakeFood();
    } else {
        snakeBody.pop();
    }
    snakeStatus.textContent = snakeRunning ? `Use arrow keys or controls to play. Score: ${snakeScore}` : `You filled the board! Score: ${snakeScore}`;
    drawSnake();
}

function startSnakeGame() {
    window.clearInterval(snakeTimer);
    snakeBody = [{ x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }];
    snakeDirection = { x: 1, y: 0 };
    snakeScore = 0;
    snakeRunning = true;
    placeSnakeFood();
    snakeStatus.textContent = 'Use arrow keys or controls to play. Score: 0';
    drawSnake();
    snakeTimer = window.setInterval(moveSnake, 150);
}

document.querySelector('#snake-reset').addEventListener('click', startSnakeGame);
document.querySelectorAll('[data-snake-direction]').forEach((button) => {
    button.addEventListener('click', () => setSnakeDirection(button.dataset.snakeDirection));
});
document.addEventListener('keydown', (event) => {
    if (!snakeRunning || !document.querySelector('#snake-window').classList.contains('is-running')) return;
    const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const directionName = keys[event.key];
    if (directionName) {
        event.preventDefault();
        setSnakeDirection(directionName);
    }
});
drawSnake();

const rpsStatus = document.querySelector('#rps-status');
const rpsScore = document.querySelector('#rps-score');
let playerScore = 0;
let computerScore = 0;
const rpsMoves = ['rock', 'paper', 'scissors'];

document.querySelectorAll('[data-rps-choice]').forEach((button) => {
    button.addEventListener('click', () => {
        const playerMove = button.dataset.rpsChoice;
        const computerMove = rpsMoves[Math.floor(Math.random() * rpsMoves.length)];
        const outcome = playerMove === computerMove
            ? 'It is a tie.'
            : (playerMove === 'rock' && computerMove === 'scissors') ||
                (playerMove === 'paper' && computerMove === 'rock') ||
                (playerMove === 'scissors' && computerMove === 'paper')
                ? 'You win this round!'
                : 'Computer wins this round.';
        if (playerMove !== computerMove) {
            if (outcome.startsWith('You')) playerScore += 1;
            else computerScore += 1;
        }
        rpsStatus.textContent = `You chose ${playerMove}; computer chose ${computerMove}. ${outcome}`;
        rpsScore.textContent = `You ${playerScore} — ${computerScore} Computer`;
    });
});
document.querySelector('#rps-reset').addEventListener('click', () => {
    playerScore = 0;
    computerScore = 0;
    rpsStatus.textContent = 'Choose your move.';
    rpsScore.textContent = 'You 0 — 0 Computer';
});

function restoreSettings() {
    if (themes[savedSettings.theme]) applyTheme(savedSettings.theme);

    const wallpaper = savedSettings.wallpaper;
    if (wallpaper?.type === 'preset' && wallpapers[wallpaper.value]) {
        setWallpaper(wallpapers[wallpaper.value]);
        document.querySelectorAll('[data-wallpaper]').forEach((button) => {
            button.classList.toggle('active', button.dataset.wallpaper === wallpaper.value);
        });
        addRecentWallpaper({ type: 'preset', value: wallpaper.value });
    } else if (wallpaper?.type === 'custom' && typeof wallpaper.value === 'string') {
        const changeId = ++wallpaperChangeId;
        const imageKey = wallpaper.value === 'indexeddb' ? 'custom' : wallpaper.value;
        if (wallpaper.value === 'indexeddb' || !wallpaper.value.startsWith('data:')) {
            void loadWallpaperImage(imageKey).then((imageBlob) => {
                if (changeId !== wallpaperChangeId) return;
                if (!imageBlob) {
                    console.warn('The saved custom wallpaper image is missing.');
                    return;
                }
                clearCustomWallpaperObjectUrl();
                customWallpaperObjectUrl = URL.createObjectURL(imageBlob);
                customWallpaperSource = customWallpaperObjectUrl;
                setWallpaper(`linear-gradient(rgba(8, 21, 29, .15), rgba(8, 21, 29, .15)), url("${customWallpaperSource}")`);
                renderLogoContrast();
                addRecentWallpaper({
                    type: 'custom',
                    value: imageKey,
                    label: imageKey === 'custom' ? 'Custom' : 'Custom'
                });
            }).catch((error) => {
                console.warn('Could not restore the custom wallpaper image:', error);
            });
        } else {
            customWallpaperSource = wallpaper.value;
            setWallpaper(`linear-gradient(rgba(8, 21, 29, .15), rgba(8, 21, 29, .15)), url("${wallpaper.value}")`);
            renderLogoContrast();
            const key = `wallpaper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            void saveWallpaperImage(wallpaper.value, key).then(() => {
                if (changeId === wallpaperChangeId) {
                    saveSettings({ wallpaper: { type: 'custom', value: key } });
                    addRecentWallpaper({ type: 'custom', value: key, label: 'Custom' });
                }
            }).catch((error) => {
                console.warn('Could not migrate the saved wallpaper image:', error);
            });
        }
        document.querySelectorAll('[data-wallpaper]').forEach((button) => button.classList.remove('active'));
    } else if (!wallpaper) {
        const defaultWallpaper = { type: 'preset', value: 'mountains' };
        setWallpaper(wallpapers[defaultWallpaper.value]);
        document.querySelectorAll('[data-wallpaper]').forEach((button) => {
            button.classList.toggle('active', button.dataset.wallpaper === defaultWallpaper.value);
        });
        saveSettings({ wallpaper: defaultWallpaper });
        addRecentWallpaper(defaultWallpaper);
    }

    if (typeof savedSettings.showLogo === 'boolean') {
        document.querySelector('.logo').style.display = savedSettings.showLogo ? '' : 'none';
        document.querySelector('#logo-toggle').setAttribute('aria-pressed', String(savedSettings.showLogo));
    }
    renderLogoContrast();

    if (Number.isFinite(savedSettings.iconSize)) {
        const size = savedSettings.iconSize;
        const desktop = document.querySelector('#desktop');
        desktop.style.setProperty('--app-icon-size', `${size}px`);
        desktop.style.setProperty('--app-tile-size', `${Math.round(size * 0.66)}px`);
        document.querySelector('#icon-size').value = size;
        document.querySelector('#icon-size-value').textContent = `${size}px`;
    }

    if (Number.isFinite(savedSettings.windowOpacity)) {
        const opacity = savedSettings.windowOpacity;
        document.querySelectorAll('.window').forEach((windowElement) => {
            windowElement.style.opacity = opacity / 100;
        });
        document.querySelector('#window-opacity').value = opacity;
        document.querySelector('#window-opacity-value').textContent = `${opacity}%`;
    }

    if (typeof savedSettings.centerWindows === 'boolean') {
        centerWindows = savedSettings.centerWindows;
        document.querySelector('#center-windows-toggle').setAttribute('aria-pressed', String(centerWindows));
    }
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Service Worker error:', error));
}

restoreSettings();
renderRecentWallpapers();
updateTaskbarState();
updateClock();
window.setInterval(updateClock, 1000);
