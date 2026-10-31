import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const CONFIG = `${GLib.get_home_dir()}/.config/linux-temp/config`;

function readConfig() {
    const cfg = { host: '', user: 't', port: '22', key: '', password: '', interval: '5',
                  localInterval: '5', remoteInterval: '5', showLocal: 'true', localType: 'avg',
                  showRemote: 'true', remoteType: 'avg' };
    try {
        const [ok, bytes] = GLib.file_get_contents(CONFIG);
        if (ok) {
            let s = '';
            for (const b of bytes) s += String.fromCharCode(b);
            for (const line of s.split('\n')) {
                const i = line.indexOf('=');
                if (i > 0) {
                    const k = line.slice(0, i).trim();
                    const v = line.slice(i + 1).trim();
                    if (k === 'FNOS_HOST') cfg.host = v;
                    else if (k === 'FNOS_USER') cfg.user = v;
                    else if (k === 'FNOS_PORT') cfg.port = v || '22';
                    else if (k === 'FNOS_KEY') cfg.key = v;
                    else if (k === 'FNOS_PASSWORD') cfg.password = v;
                    else if (k === 'INTERVAL') cfg.interval = v;
                    else if (k === 'LOCAL_INTERVAL') cfg.localInterval = v;
                    else if (k === 'REMOTE_INTERVAL') cfg.remoteInterval = v;
                    else if (k === 'SHOW_LOCAL') cfg.showLocal = v;
                    else if (k === 'LOCAL_TEMP_TYPE') cfg.localType = v;
                    else if (k === 'SHOW_REMOTE') cfg.showRemote = v;
                    else if (k === 'REMOTE_TEMP_TYPE') cfg.remoteType = v;
                    else cfg[k] = v;
                }
            }
        }
    } catch (e) { log('read err ' + e); }
    return cfg;
}
function writeConfig(cfg) {
    let s = '';
    s += `FNOS_HOST=${cfg.host}\n`;
    s += `FNOS_USER=${cfg.user}\n`;
    s += `FNOS_PORT=${cfg.port || '22'}\n`;
    s += `FNOS_KEY=${cfg.key}\n`;
    s += `FNOS_PASSWORD=${cfg.password}\n`;
    s += `INTERVAL=${cfg.interval || '5'}\n`;
    s += `LOCAL_INTERVAL=${cfg.localInterval}\n`;
    s += `REMOTE_INTERVAL=${cfg.remoteInterval}\n`;
    s += `SHOW_LOCAL=${cfg.showLocal}\n`;
    s += `LOCAL_TEMP_TYPE=${cfg.localType}\n`;
    s += `SHOW_REMOTE=${cfg.showRemote}\n`;
    s += `REMOTE_TEMP_TYPE=${cfg.remoteType}\n`;
    try {
        GLib.mkdir_with_parents(GLib.path_get_dirname(CONFIG), 0o755);
        GLib.file_set_contents(CONFIG, s);
    } catch (e) { log('write err ' + e); }
}

function mkTitle(text) {
    const l = new Gtk.Label({ label: text, halign: Gtk.Align.START, xalign: 0 });
    l.add_css_class('heading');
    return l;
}
function mkSpin(label, val) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
    box.append(new Gtk.Label({ label, halign: Gtk.Align.START, hexpand: true }));
    const spin = new Gtk.SpinButton({ adjustment: new Gtk.Adjustment({ lower: 1, upper: 300, step_increment: 1, value: parseInt(val || '5') || 5 }), width_chars: 4 });
    box.append(spin);
    return { box, spin };
}
function mkType(label, cur) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
    box.append(new Gtk.Label({ label, halign: Gtk.Align.START, hexpand: true }));
    const combo = Gtk.ComboBoxText.new();
    combo.append('avg', '平均温度');
    combo.append('max', '最高温度');
    combo.active_id = cur || 'avg';
    box.append(combo);
    return { box, combo };
}
function mkEntry(label) {
    const l = new Gtk.Label({ label, halign: Gtk.Align.START, xalign: 0 });
    const e = new Gtk.Entry();
    e.set_hexpand(true);
    return { box: [l, e], entry: e };
}
function mkSwitch(label, on) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
    box.append(new Gtk.Label({ label, halign: Gtk.Align.START, hexpand: true }));
    const sw = new Gtk.Switch();
    sw.set_active((on || 'true') === 'true');
    box.append(sw);
    return { box, sw };
}

export default class Prefs {
    fillPreferencesWindow(window) {
        const cfg = readConfig();
        const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10,
                                   margin_top: 14, margin_bottom: 14, margin_start: 18, margin_end: 18 });
        const cols = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16 });
        root.append(cols);

        // 列1 显示选项
        const col1 = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6, hexpand: true });
        col1.append(mkTitle('显示选项'));
        const lIv = mkSpin('本机刷新间隔(秒)', cfg.localInterval); col1.append(lIv.box);
        const rIv = mkSpin('远程刷新间隔(秒)', cfg.remoteInterval); col1.append(rIv.box);
        const lTy = mkType('本机显示', cfg.localType); col1.append(lTy.box);
        const rTy = mkType('远程显示', cfg.remoteType); col1.append(rTy.box);
        cols.append(col1);

        // 列2 传感器提供程序
        const col2 = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6, hexpand: true });
        col2.append(mkTitle('传感器提供程序'));
        const eHost = mkEntry('远程主机 IP'); col2.append(eHost.box[0]); col2.append(eHost.box[1]); eHost.entry.set_text(cfg.host);
        const eUser = mkEntry('用户名'); col2.append(eUser.box[0]); col2.append(eUser.box[1]); eUser.entry.set_text(cfg.user);
        const ePort = mkEntry('端口'); col2.append(ePort.box[0]); col2.append(ePort.box[1]); ePort.entry.set_text(cfg.port);
        col2.append(new Gtk.Label({ label: '密钥路径(可选)', halign: Gtk.Align.START, xalign: 0 }));
        const kr = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
        const eKey = new Gtk.Entry(); eKey.set_text(cfg.key); eKey.set_hexpand(true);
        const bBrowse = new Gtk.Button({ label: '浏览…' });
        bBrowse.connect('clicked', () => {
            const fc = new Gtk.FileChooserNative({ title: '选择 SSH 密钥文件', action: Gtk.FileChooserAction.OPEN, accept_label: '选择' });
            fc.connect('response', (dlg, resp) => {
                if (resp === Gtk.ResponseType.ACCEPT && fc.get_file()) eKey.set_text(fc.get_file().get_path() || '');
                dlg.destroy();
            });
            fc.show();
        });
        kr.append(eKey); kr.append(bBrowse);
        col2.append(kr);
        const ePass = mkEntry('密码(可选)'); col2.append(ePass.box[0]); col2.append(ePass.box[1]); ePass.entry.set_text(cfg.password);
        cols.append(col2);

        // 列3 显示传感器
        const col3 = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6, hexpand: true });
        col3.append(mkTitle('显示传感器'));
        const swL = mkSwitch('本机温度', cfg.showLocal); col3.append(swL.box);
        const swR = mkSwitch('远程温度', cfg.showRemote); col3.append(swR.box);
        cols.append(col3);

        // 按钮栏
        const bar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, halign: Gtk.Align.END });
        const bReset = new Gtk.Button({ label: '恢复默认' });
        bReset.connect('clicked', () => {
            eHost.entry.set_text(''); eUser.entry.set_text('t'); ePort.entry.set_text('22'); eKey.set_text(''); ePass.entry.set_text('');
            lIv.spin.set_value(5); rIv.spin.set_value(5); lTy.combo.active_id = 'avg'; rTy.combo.active_id = 'avg';
            swL.sw.set_active(true); swR.sw.set_active(true);
        });
        const bSave = new Gtk.Button({ label: '保存' });
        bSave.add_css_class('suggested-action');
        bSave.connect('clicked', () => {
            writeConfig({
                host: eHost.entry.get_text().trim(),
                user: eUser.entry.get_text().trim(),
                port: ePort.entry.get_text().trim() || '22',
                key: eKey.get_text().trim(),
                password: ePass.entry.get_text(),
                interval: cfg.interval || '5',
                localInterval: String(Math.round(lIv.spin.value)),
                remoteInterval: String(Math.round(rIv.spin.value)),
                showLocal: swL.sw.active ? 'true' : 'false',
                localType: lTy.combo.active_id || 'avg',
                showRemote: swR.sw.active ? 'true' : 'false',
                remoteType: rTy.combo.active_id || 'avg',
            });
        });
        bar.append(bReset); bar.append(bSave);
        root.append(bar);
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: 'linux-cpu温度 v1.0.0 / TXH' });
        group.add(root);
        page.add(group);
        window.add(page);
    }
}
