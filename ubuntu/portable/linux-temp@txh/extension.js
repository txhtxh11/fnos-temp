import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

const ROLE = 'linuxTemp';
const CONFIG_DIR = `${GLib.get_home_dir()}/.config/linux-temp`;
const CONFIG_FILE = `${CONFIG_DIR}/config`;

function readConfig() {
    const c = {host: '', user: '', port: '22', key: '', password: '', interval: '5',
               localInterval: '', remoteInterval: '', showLocal: 'true', localType: 'avg', showRemote: 'true', remoteType: 'avg'};
    try {
        const [ok, contents] = GLib.file_get_contents(CONFIG_FILE);
        if (ok && contents) {
            const text = new TextDecoder().decode(contents);
            for (const line of text.split('\n')) {
                const i = line.indexOf('=');
                if (i <= 0) continue;
                const k = line.slice(0, i).trim();
                const v = line.slice(i + 1).trim();
                if (k === 'FNOS_HOST') c.host = v;
                else if (k === 'FNOS_USER') c.user = v;
                else if (k === 'FNOS_PORT') c.port = v || '22';
                else if (k === 'FNOS_KEY') c.key = v;
                else if (k === 'FNOS_PASSWORD') c.password = v;
                else if (k === 'INTERVAL') c.interval = v || '5';
                else if (k === 'LOCAL_INTERVAL') c.localInterval = v;
                else if (k === 'REMOTE_INTERVAL') c.remoteInterval = v;
                else if (k === 'SHOW_LOCAL') c.showLocal = v || 'true';
                else if (k === 'LOCAL_TEMP_TYPE') c.localType = v === 'max' ? 'max' : 'avg';
                else if (k === 'SHOW_REMOTE') c.showRemote = v || 'true';
                else if (k === 'REMOTE_TEMP_TYPE') c.remoteType = v === 'max' ? 'max' : 'avg';
            }
        }
    } catch (e) { log(`linux-temp: readConfig err ${e}`); }
    if (!c.localInterval) c.localInterval = c.interval || '5';
    if (!c.remoteInterval) c.remoteInterval = c.interval || '5';
    return c;
}

function writeConfig(c) {
    try {
        GLib.mkdir_with_parents(CONFIG_DIR, 0o755);
        const text = [
            `FNOS_HOST=${c.host}`,
            `FNOS_USER=${c.user}`,
            `FNOS_PORT=${c.port || '22'}`,
            `FNOS_KEY=${c.key}`,
            `FNOS_PASSWORD=${c.password}`,
            `INTERVAL=${c.interval || '5'}`,
            `LOCAL_INTERVAL=${c.localInterval || c.interval || '5'}`,
            `REMOTE_INTERVAL=${c.remoteInterval || c.interval || '5'}`,
            `SHOW_LOCAL=${c.showLocal === 'false' ? 'false' : 'true'}`,
            `LOCAL_TEMP_TYPE=${c.localType === 'max' ? 'max' : 'avg'}`,
            `SHOW_REMOTE=${c.showRemote === 'false' ? 'false' : 'true'}`,
            `REMOTE_TEMP_TYPE=${c.remoteType === 'max' ? 'max' : 'avg'}`,
        ].join('\n') + '\n';
        GLib.file_set_contents(CONFIG_FILE, new TextEncoder().encode(text));
        GLib.chmod(CONFIG_FILE, 0o600);
    } catch (e) { log(`linux-temp: writeConfig err ${e}`); }
}

// 读取本机 coretemp 所有核温度（毫摄氏度→摄氏度），返回各核温度数组
function readLocalCores() {
    const cores = [];
    try {
        const base = Gio.File.new_for_path('/sys/class/hwmon');
        if (!base.query_exists(null)) return cores;
        const it = base.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = it.next_file(null)) !== null) {
            const d = info.get_name();
            if (!/^hwmon\d+$/.test(d)) continue;
            const [ok, bytes] = GLib.file_get_contents(`/sys/class/hwmon/${d}/name`);
            if (!ok) continue;
            const name = new TextDecoder().decode(bytes).trim();
            if (name !== 'coretemp') continue;
            const sub = base.get_child(d).enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let s;
            while ((s = sub.next_file(null)) !== null) {
                const f = s.get_name();
                if (!/^temp\d+_input$/.test(f)) continue;
                const [ok2, bytes2] = GLib.file_get_contents(`/sys/class/hwmon/${d}/${f}`);
                if (!ok2) continue;
                const v = parseInt(new TextDecoder().decode(bytes2).trim(), 10);
                if (!Number.isNaN(v) && v > 0) cores.push(Math.round(v / 1000));
            }
        }
    } catch (e) { log(`linux-temp: readLocalCores err ${e}`); }
    cores.sort((a, b) => a - b);
    return cores;
}

export default class LinuxTempExtension extends Extension {
    enable() {
        log('[linux-temp] loaded v3');
        this._button = new PanelMenu.Button(0.0, undefined, false);
        this._button.menuAlignment = 0.5;
        this._box = new St.BoxLayout({style_class: 'panel-status-menu-box', reactive: false, can_focus: false});
        this._label = new St.Label({text: '\u2013\u2013\u00b0C', y_align: Clutter.ActorAlign.CENTER});
        this._box.add_child(this._label);
        this._button.add_child(this._box);
        this._button.tooltip_text = 'linux-cpu温度：未配置';

        const head = new PopupMenu.PopupMenuItem('本机    远程', {reactive: false});
        this._button.menu.addMenuItem(head);
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._refreshItem = new PopupMenu.PopupMenuItem('刷新');
        this._refreshItem.connect('activate', () => { this._readLocalNow(); this._readRemoteNow(); });
        this._button.menu.addMenuItem(this._refreshItem);
        this._settingsItem = new PopupMenu.PopupMenuItem('设置…');
        this._settingsItem.connect('activate', () => Main.extensionManager.openExtensionPrefs(this.metadata.uuid, ''));
        this._button.menu.addMenuItem(this._settingsItem);

        Main.panel.addToStatusArea(ROLE, this._button);
        this._lastLocal = null;
        this._lastRemote = null;
        this._lastCores = [];
        this._readLocalNow();
        if (readConfig().host) this._readRemoteNow();
        this._restartTimers();
    }

    _restartTimers() {
        if (this._localTimer) GLib.source_remove(this._localTimer);
        if (this._remoteTimer) GLib.source_remove(this._remoteTimer);
        this._localTimer = null;
        this._remoteTimer = null;
        const cfg = readConfig();
        const localSec = Math.max(1, parseInt(cfg.localInterval, 10) || 5);
        const remoteSec = Math.max(1, parseInt(cfg.remoteInterval, 10) || 5);
        this._localTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, localSec, () => {
            this._readLocalNow();
            return GLib.SOURCE_CONTINUE;
        });
        this._remoteTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, remoteSec, () => {
            this._readRemoteNow();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _readRemote(cfg, cb) {
        const helper = `${this.path}/linux-temp-read.sh`;
        const proc = Gio.Subprocess.new(['bash', helper], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                const [, out] = p.communicate_utf8_finish(res);
                const s = (out || '').trim();
                const parts = s.split(/\s+/).map(x => parseInt(x, 10))
                    .filter(v => !Number.isNaN(v) && v > 0);
                cb(parts.length ? parts : null);
            } catch (e) { log(`linux-temp: remote err ${e}`); cb(null); }
        });
    }

    _readLocalNow() {
        const cfg = readConfig();
        const cores = readLocalCores();
        let localMain = null;
        if (cores.length) {
            localMain = cfg.localType === 'max'
                ? Math.max(...cores)
                : Math.round(cores.reduce((a, b) => a + b, 0) / cores.length);
        }
        this._lastLocal = localMain;
        this._lastCores = cores;
        this._updateDisplay();
    }

    _readRemoteNow() {
        const cfg = readConfig();
        if (!cfg.host) return;
        this._readRemote(cfg, (cores) => { this._lastRemote = cores; this._updateDisplay(); });
    }

    _updateDisplay() {
        const cfg = readConfig();
        const localCores = this._lastCores || [];
        const localMain = this._lastLocal;
        const remoteCores = this._lastRemote || [];
        const showLocal = cfg.showLocal !== 'false';
        const showRemote = cfg.showRemote !== 'false';
        const avgOf = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
        const mainOf = (a, type) => (type === 'max' ? Math.max(...a) : avgOf(a));
        const remoteMain = remoteCores.length ? mainOf(remoteCores, cfg.remoteType) : null;

        // 顶栏：本机/远程开关各自控制，都开就都显示
        const showLocalBlock = showLocal && localMain != null;
        const showRemoteBlock = showRemote && remoteMain != null;
        let label = '';
        if (showLocalBlock && showRemoteBlock) {
            label = `${localMain}\u00b0C          ${remoteMain}\u00b0C`;
        } else if (showLocalBlock) {
            label = `${localMain}\u00b0C`;
        } else if (showRemoteBlock) {
            label = `${remoteMain}\u00b0C`;
        } else {
            label = cfg.host ? '\u2013\u2013\u00b0C' : '未配置';
        }
        this._label.set_text(label);

        const lines = [];
        if (showLocalBlock && showRemoteBlock) {
            lines.push(`本机(左) ${localMain}\u00b0C   /   远程(右) ${remoteMain}\u00b0C (${cfg.host})`);
        }
        if (showLocalBlock) {
            const lAvg = avgOf(localCores);
            const lMax = Math.max(...localCores);
            const lStr = localCores.map((t, i) => `Core${i} ${t}\u00b0C`).join('  ');
            lines.push('本机CPU:');
            lines.push(`  ${lStr}`);
            lines.push(`本机: 平均 ${lAvg}\u00b0C / 最高 ${lMax}\u00b0C`);
        }
        if (cfg.host) {
            if (showRemoteBlock) {
                const rAvg = avgOf(remoteCores);
                const rMax = Math.max(...remoteCores);
                const rStr = remoteCores.map((t, i) => `Core${i} ${t}\u00b0C`).join('  ');
                lines.push(`远程 ${cfg.host}:`);
                lines.push(`  ${rStr}`);
                lines.push(`远程: 平均 ${rAvg}\u00b0C / 最高 ${rMax}\u00b0C`);
            } else if (showRemote) {
                lines.push(`远程 ${cfg.host}: 读取中…`);
            }
        }
        if (!lines.length) lines.push('未配置，点击图标设置');
        this._button.tooltip_text = lines.join('\n');
    }

    // Ubuntu 系统设置界面风格：左导航 + 右侧分组表单
    _openSettings() {
        if (this._dialog) { this._dialog.close(); return; }
        const cfg = readConfig();
        const cores = readLocalCores();
        const remoteCores = this._lastRemote || [];
        let localType = cfg.localType === 'max' ? 'max' : 'avg';
        let remoteType = cfg.remoteType === 'max' ? 'max' : 'avg';
        let showLocal = cfg.showLocal !== 'false';
        let showRemote = cfg.showRemote !== 'false';

        const dialog = new ModalDialog.ModalDialog();
        dialog.connect('closed', () => { this._dialog = null; });

        const root = new St.BoxLayout({vertical: true, style_class: 'fnos-dialog'});
        root.set_width(920);

        // 顶部品牌栏：左 名称+版本，右 TXH
        const brand = new St.BoxLayout({vertical: false, style_class: 'fnos-brand'});
        const brandL = new St.Label({text: 'linux-cpu温度 v1.0.0', style_class: 'fnos-title'});
        const brandR = new St.Label({text: 'TXH', style_class: 'fnos-title fnos-brand-right'});
        brandR.x_expand = true;
        brandR.x_align = Clutter.ActorAlign.END;
        brand.add_child(brandL);
        brand.add_child(brandR);
        const closeBtn = new St.Button({label: '×', can_focus: true, style_class: 'fnos-close'});
        closeBtn.connect('clicked', () => dialog.close());
        brand.add_child(closeBtn);
        root.add_child(brand);

        const cols = new St.BoxLayout({vertical: false, style_class: 'fnos-cols'});

        const mkCol = (title) => {
            const col = new St.BoxLayout({vertical: true, style_class: 'fnos-col'});
            col.add_child(new St.Label({text: title, style_class: 'fnos-col-title'}));
            return col;
        };
        const mkLabelRow = (col, label, widget) => {
            const row = new St.BoxLayout({vertical: false, style_class: 'fnos-row'});
            const lab = new St.Label({text: label, style_class: 'fnos-label'});
            lab.y_align = Clutter.ActorAlign.CENTER;
            row.add_child(lab);
            row.add_child(widget);
            col.add_child(row);
        };
        const mkEntry = (col, label, val) => {
            const entry = new St.Entry({text: val, can_focus: true, style_class: 'fnos-entry'});
            entry.x_expand = true;
            mkLabelRow(col, label, entry);
            return entry;
        };
        const mkSwitch = (col, label, init) => {
            const sw = new St.Button({label: init ? '开' : '关', can_focus: true,
                                      style_class: 'fnos-switch ' + (init ? 'fnos-switch-on' : 'fnos-switch-off')});
            let st = init;
            sw.connect('clicked', () => {
                st = !st;
                sw.set_label(st ? '开' : '关');
                sw.set_style_class_name('fnos-switch ' + (st ? 'fnos-switch-on' : 'fnos-switch-off'));
            });
            mkLabelRow(col, label, sw);
            return () => st;
        };
        const mkType = (col, label, onPick) => {
            const box = new St.BoxLayout({vertical: false, style_class: 'fnos-type'});
            const btnAvg = new St.Button({label: '平均温度', can_focus: true, style_class: 'fnos-btn'});
            const btnMax = new St.Button({label: '最高温度', can_focus: true, style_class: 'fnos-btn'});
            btnAvg.connect('clicked', () => onPick('avg'));
            btnMax.connect('clicked', () => onPick('max'));
            box.add_child(btnAvg);
            box.add_child(btnMax);
            mkLabelRow(col, label, box);
            return (t) => {
                btnAvg.set_style_class_name('fnos-btn' + (t === 'avg' ? ' fnos-btn-active' : ''));
                btnMax.set_style_class_name('fnos-btn' + (t === 'max' ? ' fnos-btn-active' : ''));
            };
        };

        const mkSpin = (col, label, init) => {
            let val = Math.max(1, parseInt(init, 10) || 5);
            const row = new St.BoxLayout({vertical: false, style_class: 'fnos-row'});
            const lab = new St.Label({text: label, style_class: 'fnos-label'});
            lab.y_align = Clutter.ActorAlign.CENTER;
            const minus = new St.Button({label: '−', can_focus: true, style_class: 'fnos-step'});
            const valLab = new St.Label({text: String(val), style_class: 'fnos-stepval'});
            const plus = new St.Button({label: '+', can_focus: true, style_class: 'fnos-step'});
            minus.connect('clicked', () => { if (val > 1) { val -= 1; valLab.set_text(String(val)); } });
            plus.connect('clicked', () => { if (val < 999) { val += 1; valLab.set_text(String(val)); } });
            row.add_child(lab);
            row.add_child(minus);
            row.add_child(valLab);
            row.add_child(plus);
            col.add_child(row);
            return () => String(val);
        };

        // 列1：显示选项
        const colD = mkCol('显示选项');
        cols.add_child(colD);
        const getLocalIv = mkSpin(colD, '本机刷新间隔(秒)', cfg.localInterval);
        const getRemoteIv = mkSpin(colD, '远程刷新间隔(秒)', cfg.remoteInterval);
        const setLocalType = mkType(colD, '本机温度类型', (t) => { localType = t; });
        setLocalType(localType);
        const setRemoteType = mkType(colD, '远程温度类型', (t) => { remoteType = t; });
        setRemoteType(remoteType);

        // 列2：传感器提供程序（远程 SSH 主机）
        const colP = mkCol('传感器提供程序');
        cols.add_child(colP);
        colP.add_child(new St.Label({text: '远程 SSH 主机', style_class: 'fnos-sub-title'}));
        const eHost = mkEntry(colP, '主机 IP/域名', cfg.host);
        const eUser = mkEntry(colP, 'SSH 用户名', cfg.user);
        // 端口：短框
        const portRow = new St.BoxLayout({vertical: false, style_class: 'fnos-row'});
        const portLab = new St.Label({text: '端口', style_class: 'fnos-label'});
        portLab.y_align = Clutter.ActorAlign.CENTER;
        const ePort = new St.Entry({text: cfg.port, can_focus: true, style_class: 'fnos-entry'});
        ePort.width = 90;
        ePort.x_expand = false;
        portRow.add_child(portLab);
        portRow.add_child(ePort);
        colP.add_child(portRow);
        // 密钥路径：输入框 + 浏览按钮（打开资源管理器选密钥文件）
        const keyRow = new St.BoxLayout({vertical: false, style_class: 'fnos-row'});
        const keyLab = new St.Label({text: '密钥路径(可选)', style_class: 'fnos-label'});
        keyLab.y_align = Clutter.ActorAlign.CENTER;
        const eKey = new St.Entry({text: cfg.key, can_focus: true, style_class: 'fnos-entry'});
        eKey.x_expand = true;
        const btnBrowse = new St.Button({label: '浏览…', can_focus: true, style_class: 'fnos-browse'});
        btnBrowse.connect('clicked', () => {
            pickerBox.visible = !pickerBox.visible;
            if (pickerBox.visible) listDir('', true);
        });
        keyRow.add_child(keyLab);
        keyRow.add_child(eKey);
        keyRow.add_child(btnBrowse);
        colP.add_child(keyRow);
        const ePass = mkEntry(colP, '密码(可选)', cfg.password);

        // 列3：显示传感器
        const colS = mkCol('显示传感器');
        cols.add_child(colS);
        const getShowLocal = mkSwitch(colS, '本机温度', showLocal);
        const getShowRemote = mkSwitch(colS, '远程温度', showRemote);

        root.add_child(cols);
        // 文件选择内嵌区：点浏览在设置对话框内展开（随设置一起显示/关闭，避免嵌套 modal 无响应）
        const pickerBox = new St.BoxLayout({vertical: true, style_class: 'fnos-picker'});
        pickerBox.visible = false;
        const pPath = new St.Entry({can_focus: true, style_class: 'fnos-entry'});
        pPath.x_expand = true;
        const pScroll = new St.ScrollView({style_class: 'vfade'});
        pScroll.height = 160;
        const pList = new St.BoxLayout({vertical: true});
        pScroll.add_child(pList);
        pickerBox.add_child(pPath);
        pickerBox.add_child(pScroll);
        root.add_child(pickerBox);
        const listDir = (p, isStart) => {
            let cur = isStart ? ((eKey.get_text().trim() && GLib.path_is_absolute(eKey.get_text().trim())) ? eKey.get_text().trim() : GLib.get_home_dir()) : p;
            pPath.set_text(cur);
            pList.destroy_all_children();
            const parent = GLib.path_get_dirname(cur);
            if (parent !== cur) {
                const up = new St.Button({label: '.. 上一级', can_focus: true, style_class: 'fnos-browse'});
                up.connect('clicked', () => listDir(parent, false));
                pList.add_child(up);
            }
            try {
                const en = Gio.File.new_for_path(cur).enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
                let info;
                while ((info = en.next_file(null))) {
                    const name = info.get_name();
                    const isDir = info.get_file_type() === Gio.FileType.DIRECTORY;
                    const full = cur + '/' + name;
                    const row = new St.Button({label: (isDir ? '\ud83d\udcc1 ' : '\ud83d\udcc4 ') + name, can_focus: true, style_class: 'fnos-browse'});
                    row.connect('clicked', () => {
                        if (isDir) listDir(full, false);
                        else { eKey.set_text(full); pickerBox.visible = false; }
                    });
                    pList.add_child(row);
                }
            } catch (e) { log('picker err ' + e); }
        };
        pPath.connect('key-press-event', (w, ev) => {
            if (ev.get_key_symbol() === Clutter.KEY_Return || ev.get_key_symbol() === Clutter.KEY_KP_Enter) {
                listDir(pPath.get_text(), false);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        dialog.contentLayout.add_child(root);
        dialog.setButtons([
            {label: '取消', action: () => { dialog.close(); }},
            {label: '保存', action: () => {
                writeConfig({
                    host: eHost.get_text().trim(),
                    user: eUser.get_text().trim(),
                    port: ePort.get_text().trim() || '22',
                    key: eKey.get_text().trim(),
                    password: ePass.get_text(),
                    interval: cfg.interval || '5',
                    localInterval: getLocalIv(),
                    remoteInterval: getRemoteIv(),
                    showLocal: getShowLocal() ? 'true' : 'false',
                    localType,
                    showRemote: getShowRemote() ? 'true' : 'false',
                    remoteType,
                });
                this._restartTimers();
                this._readLocalNow();
                this._readRemoteNow();
                dialog.close();
            }},
        ]);
        this._dialog = dialog;
        dialog.connect('closed', () => {
            this._dialog = null;
        });
        dialog.open();
    }

    disable() {
        if (this._localTimer) { GLib.source_remove(this._localTimer); this._localTimer = null; }
        if (this._remoteTimer) { GLib.source_remove(this._remoteTimer); this._remoteTimer = null; }
        if (this._dialog) { this._dialog.close(); this._dialog = null; }
        this._button?.destroy();
        this._button = null;
    }
}
