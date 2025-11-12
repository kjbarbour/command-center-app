const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, Notification, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let quickAddWindow = null;
let tray = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // If someone tries to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function createMainWindow() {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        x: 20, // 20px from left edge
        y: height - 620, // 20px from bottom
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    
    // Don't quit app when window is closed
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

function createQuickAddWindow() {
    quickAddWindow = new BrowserWindow({
        width: 500,
        height: 550,
        show: false,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    quickAddWindow.loadFile('quick-add.html');

    quickAddWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            quickAddWindow.hide();
        }
    });
}

function createTray() {
    // Use a simple emoji in the menu bar (most reliable approach)
    tray = new Tray(nativeImage.createEmpty());
    
    // Set icon to a target emoji
    tray.setTitle('🎯');
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Command Center',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Quick Add Task',
            click: () => {
                if (quickAddWindow) {
                    quickAddWindow.show();
                    quickAddWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.isQuitting = true;
                if (mainWindow) mainWindow.destroy();
                if (quickAddWindow) quickAddWindow.destroy();
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Command Center');
    
    // Click tray icon to toggle main window
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

app.whenReady().then(() => {
    createMainWindow();
    createQuickAddWindow();
    createTray();
    
    // Register global shortcuts after a short delay
    setTimeout(() => {
        // Cmd+Shift+N for Quick Add
        const quickAddRegistered = globalShortcut.register('CommandOrControl+Shift+N', () => {
            if (quickAddWindow) {
                quickAddWindow.show();
                quickAddWindow.focus();
            }
        });
        
        if (quickAddRegistered) {
            console.log('Quick Add shortcut registered: Cmd+Shift+N');
        } else {
            console.log('Quick Add shortcut registration failed');
        }
    }, 1000);
});

// IPC handlers
ipcMain.on('open-quick-add', () => {
    if (quickAddWindow) {
        quickAddWindow.show();
        quickAddWindow.focus();
    }
});

ipcMain.on('open-airtable', () => {
    shell.openExternal('https://airtable.com/appQlPzbpST2aQ3ca');
});

ipcMain.on('quick-add-close', () => {
    if (quickAddWindow) {
        quickAddWindow.hide();
    }
});

ipcMain.on('task-added', () => {
    if (mainWindow) {
        mainWindow.webContents.send('refresh-tasks');
    }
});

ipcMain.on('show-notification', (event, { title, message }) => {
    const notification = new Notification({
        title: title,
        body: message,
        silent: false
    });
    notification.show();
});

app.on('window-all-closed', (event) => {
    // Don't quit on macOS when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
});

app.on('will-quit', () => {
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
});

app.on('activate', () => {
    if (mainWindow) {
        mainWindow.show();
    }
});