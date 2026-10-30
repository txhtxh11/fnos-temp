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
    const c = {host: '', user: '', port: '22', key: '', password: '', interval: '5'};
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
        ].join('\n') + '\n';
        GLib.file_set_contents(CONFIG_FILE, new TextEncoder().encode(text));
        GLib.chmod(CONFIG_FILE, 0o600);
    } catch (e) { log(`linux-temp: writeConfig err ${e}`); }
}

export default class LinuxTempExtension extends Extension {
    enable() {
        log('[linux-temp] loaded v2');
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

    _readNow() {
        const helper = `${this.path}/linux-temp-read.sh`;
        const proc = Gio.Subprocess.new(['bash', helper], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                const [, out] = p.communicate_utf8_finish(res);
                const s = (out || '').trim();
                if (/^NOCONFIG/.test(s)) {
                    this._label.set_text('未配置');
                    this._button.tooltip_text = 'linux-cpu温度：未配置，点击图标设置';
                } else if (/^NOSSPASS/.test(s)) {
                    this._label.set_text('需sshpass');
                    this._button.tooltip_text = '配置了密码但未安装 sshpass，请改用密钥';
                } else {
                    const val = parseInt(s, 10);
                    if (!Number.isNaN(val) && val > 0) {
                        this._label.set_text(`${val}\u00b0C`);
                        this._button.tooltip_text = `linux-cpu ${val}\u00b0C`;
                    } else {
                        this._label.set_text('\u2013\u2013\u00b0C');
                        this._button.tooltip_text = 'linux-cpu温度读取失败';
                    }
                }
            } catch (e) { log(`linux-temp: read err ${e}`); }
        });
    }

    _openSettings() {
        if (this._dialog) { this._dialog.close(); this._dialog = null; return; }
        const cfg = readConfig();

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
        const hint = new St.Label({text: '填写要读取温度的主机 SSH 信息（密钥或密码二选一，均可留空）', style_class: 'fnos-hint'});
        box.add_child(hint);

        const mkEntry = (label, val) => {
            const row = new St.BoxLayout({vertical: false});
            const lab = new St.Label({text: label, style_class: 'fnos-label'});
            const entry = new St.Entry({text: val, can_focus: true, style_class: 'fnos-entry'});
            entry.set_width(300);
            row.add_child(lab);
            row.add_child(entry);
            box.add_child(row);
            return entry;
        };
        const eHost = mkEntry('主机 IP/域名', cfg.host);
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
