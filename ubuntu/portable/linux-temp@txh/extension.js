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
               showLocal: 'true', localType: 'avg'};
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
                else if (k === 'SHOW_LOCAL') c.showLocal = v || 'true';
                else if (k === 'LOCAL_TEMP_TYPE') c.localType = v === 'max' ? 'max' : 'avg';
            }
        }
    } catch (e) { log(`linux-temp: readConfig err ${e}`); }
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
            `SHOW_LOCAL=${c.showLocal === 'false' ? 'false' : 'true'}`,
            `LOCAL_TEMP_TYPE=${c.localType === 'max' ? 'max' : 'avg'}`,
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
        this._button = new PanelMenu.Button(0.0, 'linux-cpu温度', false);
        this._box = new St.BoxLayout({style_class: 'panel-status-menu-box', reactive: false, can_focus: false});
        this._label = new St.Label({text: '\u2013\u2013\u00b0C', y_align: Clutter.ActorAlign.CENTER});
        this._box.add_child(this._label);
        this._button.add_child(this._box);
        this._button.tooltip_text = 'linux-cpu温度：未配置';

        const head = new PopupMenu.PopupMenuItem('linux-cpu温度 v1.0.0', {reactive: false});
        this._button.menu.addMenuItem(head);
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._refreshItem = new PopupMenu.PopupMenuItem('刷新');
        this._refreshItem.connect('activate', () => this._readNow());
        this._button.menu.addMenuItem(this._refreshItem);
        this._settingsItem = new PopupMenu.PopupMenuItem('设置…');
        this._settingsItem.connect('activate', () => this._openSettings());
        this._button.menu.addMenuItem(this._settingsItem);

        Main.panel.addToStatusArea(ROLE, this._button);
        this._readNow();
        this._restartTimer();
    }

    _restartTimer() {
        if (this._timer) GLib.source_remove(this._timer);
        const cfg = readConfig();
        const sec = Math.max(1, parseInt(cfg.interval, 10) || 5);
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, sec, () => {
            this._readNow();
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
                if (/^[0-9]+$/.test(s)) {
                    const v = parseInt(s, 10);
                    cb(v > 0 ? v : null);
                } else {
                    cb(null);
                }
            } catch (e) { log(`linux-temp: remote err ${e}`); cb(null); }
        });
    }

    _readNow() {
        const cfg = readConfig();
        const cores = readLocalCores();
        let localMain = null;
        if (cores.length) {
            localMain = cfg.localType === 'max'
                ? Math.max(...cores)
                : Math.round(cores.reduce((a, b) => a + b, 0) / cores.length);
        }
        if (cfg.host) {
            this._readRemote(cfg, (rv) => this._updateDisplay(localMain, rv, cfg, cores));
        } else {
            this._updateDisplay(localMain, null, cfg, cores);
        }
    }

    _updateDisplay(localMain, remoteVal, cfg, cores) {
        const useLocal = cfg.showLocal !== 'false';
        let main = null;
        if (useLocal && localMain != null) main = localMain;
        else if (remoteVal != null) main = remoteVal;
        else if (localMain != null) main = localMain;

        if (main != null) {
            this._label.set_text(`${main}\u00b0C`);
        } else {
            this._label.set_text(cfg.host ? '\u2013\u2013\u00b0C' : '未配置');
        }

        const lines = [];
        if (cores.length) {
            const avg = Math.round(cores.reduce((a, b) => a + b, 0) / cores.length);
            const max = Math.max(...cores);
            const coreStr = cores.map((t, i) => `Core${i} ${t}\u00b0C`).join('  ·  ');
            lines.push(`本机CPU: ${coreStr}`);
            lines.push(`本机温度: 平均 ${avg}\u00b0C / 最高 ${max}\u00b0C`);
        }
        if (cfg.host) {
            if (remoteVal != null) lines.push(`远程 ${cfg.host}: ${remoteVal}\u00b0C`);
            else lines.push(`远程 ${cfg.host}: 读取中…`);
        }
        if (!lines.length) lines.push('未配置，点击图标设置');
        this._button.tooltip_text = lines.join('\n');
    }

    _openSettings() {
        if (this._dialog) { this._dialog.close(); this._dialog = null; return; }
        const cfg = readConfig();
        const cores = readLocalCores();
        let showLocal = cfg.showLocal !== 'false';
        let localType = cfg.localType === 'max' ? 'max' : 'avg';

        const dialog = new ModalDialog.ModalDialog();
        const box = new St.BoxLayout({vertical: true, style_class: 'fnos-dialog'});

        const brand = new St.BoxLayout({vertical: false, style_class: 'fnos-brand'});
        const brandL = new St.Label({text: 'linux-cpu温度 v1.0.0', style_class: 'fnos-title'});
        const brandR = new St.Label({text: 'TXH', style_class: 'fnos-title fnos-brand-right'});
        brandR.x_expand = true;
        brandR.x_align = Clutter.ActorAlign.END;
        brand.add_child(brandL);
        brand.add_child(brandR);
        box.add_child(brand);

        const hint = new St.Label({text: '本机温度开箱即用；远程 SSH 主机温度可选配置', style_class: 'fnos-hint'});
        box.add_child(hint);

        // ---- 本机温度分区 ----
        const secTitle = new St.Label({text: '本机 CPU 温度', style_class: 'fnos-section-title'});
        box.add_child(secTitle);

        const toggleBtn = new St.Button({label: showLocal ? '显示本机温度：开' : '显示本机温度：关',
                                          can_focus: true, style_class: 'fnos-btn'});
        toggleBtn.connect('clicked', () => {
            showLocal = !showLocal;
            toggleBtn.set_label(showLocal ? '显示本机温度：开' : '显示本机温度：关');
        });
        box.add_child(toggleBtn);

        const typeRow = new St.BoxLayout({vertical: false, style_class: 'fnos-row'});
        const typeLab = new St.Label({text: '温度类型  ', style_class: 'fnos-label'});
        typeRow.add_child(typeLab);
        const btnAvg = new St.Button({label: '平均温度', can_focus: true, style_class: 'fnos-btn'});
        const btnMax = new St.Button({label: '最高温度', can_focus: true, style_class: 'fnos-btn'});
        const refreshType = () => {
            btnAvg.set_style_class_name('fnos-btn' + (localType === 'avg' ? ' fnos-btn-active' : ''));
            btnMax.set_style_class_name('fnos-btn' + (localType === 'max' ? ' fnos-btn-active' : ''));
        };
        refreshType();
        btnAvg.connect('clicked', () => { localType = 'avg'; refreshType(); });
        btnMax.connect('clicked', () => { localType = 'max'; refreshType(); });
        typeRow.add_child(btnAvg);
        typeRow.add_child(btnMax);
        box.add_child(typeRow);

        const coresLab = new St.Label({text: '当前各核：' + (cores.length
            ? cores.map((t, i) => `Core${i} ${t}\u00b0C`).join('  ')
            : '（未读到 coretemp）'), style_class: 'fnos-hint'});
        box.add_child(coresLab);

        box.add_child(new St.Label({text: '远程 SSH 主机（可选）', style_class: 'fnos-section-title'}));

        const mkEntry = (label, val) => {
            const row = new St.BoxLayout({vertical: false});
            const lab = new St.Label({text: label, style_class: 'fnos-label'});
            const entry = new St.Entry({text: val, can_focus: true, style_class: 'fnos-entry'});
            entry.set_width(280);
            row.add_child(lab);
            row.add_child(entry);
            box.add_child(row);
            return entry;
        };
        const eHost = mkEntry('远程主机 IP/域名', cfg.host);
        const eUser = mkEntry('SSH 用户名', cfg.user);
        const ePort = mkEntry('端口', cfg.port);
        const eKey = mkEntry('密钥文件路径(可选)', cfg.key);
        const ePass = mkEntry('密码(可选)', cfg.password);
        const eInterval = mkEntry('刷新间隔(秒)', cfg.interval);

        dialog.contentLayout.add_child(box);
        dialog.setButtons([
            {label: '取消', action: () => { dialog.close(); this._dialog = null; }},
            {label: '保存', action: () => {
                writeConfig({
                    host: eHost.get_text().trim(),
                    user: eUser.get_text().trim(),
                    port: ePort.get_text().trim() || '22',
                    key: eKey.get_text().trim(),
                    password: ePass.get_text(),
                    interval: eInterval.get_text().trim() || '5',
                    showLocal: showLocal ? 'true' : 'false',
                    localType,
                });
                this._restartTimer();
                this._readNow();
                dialog.close();
                this._dialog = null;
            }},
        ]);
        this._dialog = dialog;
        dialog.open();
    }

    disable() {
        if (this._timer) { GLib.source_remove(this._timer); this._timer = null; }
        if (this._dialog) { this._dialog.close(); this._dialog = null; }
        this._button?.destroy();
        this._button = null;
    }
}
