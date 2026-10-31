import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';

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
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    box.append(new Gtk.Label({ label, halign: Gtk.Align.START }));
    const spin = new Gtk.SpinButton({ adjustment: new Gtk.Adjustment({ lower: 1, upper: 300, step_increment: 1, value: parseInt(val || '5') || 5 }), width_chars: 4 });
    box.append(spin);
    return { box, spin };
}
function mkType(label, cur) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    box.append(new Gtk.Label({ label, halign: Gtk.Align.START }));
    const list = new Gtk.StringList();
    list.append('平均温度');
    list.append('最高温度');
    const dd = new Gtk.DropDown({ model: list });
    dd.selected = (cur === 'max') ? 1 : 0;
    box.append(dd);
    return { box, dd };
}
function mkEntry(label, widthChars) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    box.append(new Gtk.Label({ label, halign: Gtk.Align.START, xalign: 0 }));
    const e = new Gtk.Entry();
    if (widthChars) e.width_chars = widthChars;
    box.append(e);
    return { box, entry: e };
}
function mkSwitch(label, on) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    box.append(new Gtk.Label({ label, halign: Gtk.Align.START }));
    const sw = new Gtk.Switch();
    sw.set_active((on || 'true') === 'true');
    box.append(sw);
    return { box, sw };
}

export default class Prefs {
    fillPreferencesWindow(window) {
        const _b = new Gtk.CssProvider();
        _b.load_from_string('dropdown, dropdown button, dropdown button label, dropdown label, row:selected, row:selected label { font-weight: normal !important; }');
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), _b, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        const cfg = readConfig();
        const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16,
                                   margin_top: 14, margin_bottom: 14, margin_start: 18, margin_end: 18 });

        // 段1 显示传感器（一行两个开关）
        const g1 = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
        g1.append(mkTitle('显示传感器'));
        const swL = mkSwitch('本机温度', cfg.showLocal);
        const swR = mkSwitch('远程温度', cfg.showRemote);
        const row1 = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 28 });
        row1.append(swL.box); row1.append(swR.box);
        g1.append(row1);
        root.append(g1);

        // 段2 显示选项（两行，每行两个并排）
        const g2 = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
        g2.append(mkTitle('显示选项'));
        const lIv = mkSpin('本机刷新间隔(秒)', cfg.localInterval);
        const rIv = mkSpin('远程刷新间隔(秒)', cfg.remoteInterval);
        const row2a = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 28 });
        row2a.append(lIv.box); row2a.append(rIv.box);
        g2.append(row2a);
        const lTy = mkType('本机显示', cfg.localType);
        const rTy = mkType('远程显示', cfg.remoteType);
        const row2b = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 28 });
        row2b.append(lTy.box); row2b.append(rTy.box);
        g2.append(row2b);
        root.append(g2);

        // 段3 传感器提供程序（IP/用户名/端口 一行三个，密钥、密码各一行）
        const g3 = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
        g3.append(mkTitle('传感器提供程序'));
        const eHost = mkEntry('远程主机 IP', 15); eHost.entry.set_text(cfg.host);
        const eUser = mkEntry('用户名', 8); eUser.entry.set_text(cfg.user);
        const ePort = mkEntry('端口', 5); ePort.entry.set_text(cfg.port);
        const row3 = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 });
        row3.append(eHost.box); row3.append(eUser.box); row3.append(ePort.box);
        g3.append(row3);
        const krow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        krow.append(new Gtk.Label({ label: '密钥路径(可选)', halign: Gtk.Align.START, xalign: 0 }));
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
        krow.append(eKey); krow.append(bBrowse);
        g3.append(krow);
        const ePass = mkEntry('密码(可选)', 10); ePass.entry.set_text(cfg.password);
        g3.append(ePass.box);
        root.append(g3);

        // 按钮栏
        const bar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, halign: Gtk.Align.END });
        const bReset = new Gtk.Button({ label: '恢复默认' });
        bReset.connect('clicked', () => {
            eHost.entry.set_text(''); eUser.entry.set_text('t'); ePort.entry.set_text('22'); eKey.set_text(''); ePass.entry.set_text('');
            lIv.spin.set_value(5); rIv.spin.set_value(5); lTy.dd.selected = 0; rTy.dd.selected = 0;
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
                localType: lTy.dd.selected === 1 ? 'max' : 'avg',
                showRemote: swR.sw.active ? 'true' : 'false',
                remoteType: rTy.dd.selected === 1 ? 'max' : 'avg',
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
