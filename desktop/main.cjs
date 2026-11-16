// The desktop app (Windows and Mac): the same web app as the phones, in its own window.
// Files are served from an app:// address rather than file://, so saved data (localStorage,
// IndexedDB for the login) stays put and the app behaves exactly like the web version.
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WEB = path.join(__dirname, 'web');
const START = 'app://town/index.html';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

/** Serve the built web app; refuse anything outside its folder. */
function serveWebApp() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(WEB, decodeURIComponent(pathname)));
    if (!file.startsWith(WEB)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

const isWebLink = (url) => /^https?:\/\//i.test(url);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    title: 'My Little Town',
    backgroundColor: '#fdf3e7',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      // keep the timer ticking on time while the window is minimised
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  // links to websites open in the normal browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebLink(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('app://')) return;
    event.preventDefault();
    if (isWebLink(url)) shell.openExternal(url);
  });
  win.loadURL(START);
  return win;
}

function setMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null); // Windows: no menu bar, the app has its own buttons
    return;
  }
  // Mac: the usual menus, so Cmd+Q, Cmd+C/V and full screen work
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
}

if (!app.requestSingleInstanceLock()) {
  app.quit(); // the app is already open: focus that window instead (below)
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  if (process.platform === 'win32') app.setAppUserModelId('com.example.studytown'); // notifications
  app.whenReady().then(() => {
    serveWebApp();
    setMenu();
    createWindow();
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
