using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Renci.SshNet;

namespace FnOsTempTray
{
    public static class Program
    {
        public static string BaseDir = AppDomain.CurrentDomain.BaseDirectory;

        public static void Run(string baseDir)
        {
            if (!string.IsNullOrEmpty(baseDir)) BaseDir = baseDir;
            Log("Run start");
            AppDomain.CurrentDomain.AssemblyResolve += ResolveAssembly;

            bool created;
            using (var mutex = new Mutex(true, "FnOsTempTray_SingleInstance", out created))
            {
                if (!created) return;
                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
                Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs e) { Log("ThreadException: " + e.Exception); };
                AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e) { Log("Unhandled: " + e.ExceptionObject); };
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayContext());
                Log("Run end");
            }
        }

        private static Assembly ResolveAssembly(object sender, ResolveEventArgs e)
        {
            try
            {
                string name = new AssemblyName(e.Name).Name;
                string path = Path.Combine(BaseDir, name + ".dll");
                if (File.Exists(path)) return Assembly.Load(File.ReadAllBytes(path));
            }
            catch { }
            return null;
        }

        public static void Log(string message)
        {
            try
            {
                string path = Path.Combine(BaseDir, "app.log");
                if (File.Exists(path)) { var fi = new FileInfo(path); if (fi.Length > 512 * 1024) File.Delete(path); }
                File.AppendAllText(path, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }
    }

    internal sealed class Config
    {
        public string Host = "";
        public int Port = 22;
        public string User = "t";
        public string Auth = "key";
        public string KeyPath = "";
        public string PasswordEnc = "";
        public int LocalInterval = 2;
        public int RemoteInterval = 5;
        public string LocalMode = "max";
        public string RemoteMode = "max";
        public bool ShowLocal = true;
        public bool ShowRemote = true;
        public bool ShowTrayIcon = true;

        public static string FilePath { get { return Path.Combine(Program.BaseDir, "config.ini"); } }

        public static Config Load()
        {
            var c = new Config();
            if (File.Exists(FilePath))
            {
                foreach (string raw in File.ReadAllLines(FilePath))
                {
                    string line = raw.Trim();
                    if (line.Length == 0 || line[0] == '#' || line[0] == ';') continue;
                    int eq = line.IndexOf('=');
                    if (eq <= 0) continue;
                    string k = line.Substring(0, eq).Trim().ToLowerInvariant();
                    string v = line.Substring(eq + 1).Trim();
                    switch (k)
                    {
                        case "host": c.Host = v; break;
                        case "port": int.TryParse(v, out c.Port); break;
                        case "user": c.User = v; break;
                        case "auth": c.Auth = v; break;
                        case "keypath": c.KeyPath = v; break;
                        case "passwordenc": c.PasswordEnc = v; break;
                        case "localinterval": int.TryParse(v, out c.LocalInterval); break;
                        case "remoteinterval": int.TryParse(v, out c.RemoteInterval); break;
                        case "localmode": c.LocalMode = v; break;
                        case "remotemode": c.RemoteMode = v; break;
                        case "showlocal": c.ShowLocal = v != "0"; break;
                        case "showremote": c.ShowRemote = v != "0"; break;
                        case "showtrayicon": c.ShowTrayIcon = v != "0"; break;
                    }
                }
            }
            if (c.Port < 1 || c.Port > 65535) c.Port = 22;
            if (c.LocalInterval < 1) c.LocalInterval = 1; if (c.LocalInterval > 60) c.LocalInterval = 60;
            if (c.RemoteInterval < 1) c.RemoteInterval = 1; if (c.RemoteInterval > 60) c.RemoteInterval = 60;
            if (c.LocalMode != "avg") c.LocalMode = "max";
            if (c.RemoteMode != "avg") c.RemoteMode = "max";
            if (!string.Equals(c.Auth, "password", StringComparison.OrdinalIgnoreCase)) c.Auth = "key";
            if (!Path.IsPathRooted(c.KeyPath)) c.KeyPath = Path.Combine(Program.BaseDir, c.KeyPath);
            return c;
        }

        public void Save()
        {
            var sb = new StringBuilder();
            sb.AppendLine("Host=" + Host);
            sb.AppendLine("Port=" + Port.ToString(CultureInfo.InvariantCulture));
            sb.AppendLine("User=" + User);
            sb.AppendLine("Auth=" + Auth);
            sb.AppendLine("KeyPath=" + KeyPath);
            sb.AppendLine("PasswordEnc=" + PasswordEnc);
            sb.AppendLine("LocalInterval=" + LocalInterval);
            sb.AppendLine("RemoteInterval=" + RemoteInterval);
            sb.AppendLine("LocalMode=" + LocalMode);
            sb.AppendLine("RemoteMode=" + RemoteMode);
            sb.AppendLine("ShowLocal=" + (ShowLocal ? "1" : "0"));
            sb.AppendLine("ShowRemote=" + (ShowRemote ? "1" : "0"));
            sb.AppendLine("ShowTrayIcon=" + (ShowTrayIcon ? "1" : "0"));
            File.WriteAllText(FilePath, sb.ToString(), new UTF8Encoding(false));
        }

        public string GetPassword()
        {
            if (string.IsNullOrEmpty(PasswordEnc)) return "";
            try { return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(PasswordEnc), null, DataProtectionScope.CurrentUser)); }
            catch { return ""; }
        }
        public void SetPassword(string password)
        {
            if (string.IsNullOrEmpty(password)) { PasswordEnc = ""; return; }
            PasswordEnc = Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(password), null, DataProtectionScope.CurrentUser));
        }
    }

    internal static class Autostart
    {
        private static string LinkPath { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "linux-cpu温度.vbs"); } }
        public static bool IsEnabled() { return File.Exists(LinkPath); }
        public static void Set(bool enabled)
        {
            if (!enabled) { if (File.Exists(LinkPath)) File.Delete(LinkPath); return; }
            string ps1 = Path.Combine(Program.BaseDir, "FnOsTempOverlay.ps1");
            File.WriteAllText(LinkPath,
                "Set sh = CreateObject(\"WScript.Shell\")\r\nsh.Run \"powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File \"\"" + ps1 + "\"\"\", 0, False\r\n",
                Encoding.Unicode);
        }
    }

    // 本机 Core Temp 共享内存读取
    internal sealed class LocalTempReader : IDisposable
    {
        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern IntPtr OpenFileMappingW(uint a, bool b, string n);
        [DllImport("kernel32.dll")]
        private static extern IntPtr MapViewOfFile(IntPtr h, uint a, uint hi, uint lo, UIntPtr n);
        [DllImport("kernel32.dll")]
        private static extern bool UnmapViewOfFile(IntPtr p);
        [DllImport("kernel32.dll")]
        private static extern bool CloseHandle(IntPtr h);

        private Thread _t; private volatile bool _stop;
        private volatile int[] _temps = new int[0]; private volatile bool _ok;
        public int[] Temps { get { return _temps; } }
        public bool Ok { get { return _ok; } }
        public int MaxTemp { get { int m = -1; foreach (int v in _temps) if (v > m) m = v; return m; } }

        public void Start(int ms) { Stop(); _stop = false; _t = new Thread(() => Loop(ms)) { IsBackground = true }; _t.Start(); }
        public void Stop() { _stop = true; var t = _t; _t = null; if (t != null) try { t.Join(1500); } catch { } _temps = new int[0]; _ok = false; }

        private void Loop(int ms)
        {
            while (!_stop)
            {
                try
                {
                    IntPtr h = OpenFileMappingW(0x0004, false, "CoreTempMappingObjectEx");
                    if (h == IntPtr.Zero) h = OpenFileMappingW(0x0004, false, "CoreTempMappingObject");
                    if (h != IntPtr.Zero)
                    {
                        IntPtr p = MapViewOfFile(h, 0x0004, 0, 0, UIntPtr.Zero);
                        if (p != IntPtr.Zero)
                        {
                            try
                            {
                                byte[] buf = new byte[4096];
                                Marshal.Copy(p, buf, 0, buf.Length);
                                int cc = BitConverter.ToInt32(buf, 1536);
                                if (cc > 0 && cc <= 256)
                                {
                                    bool delta = buf[2685] != 0;
                                    var list = new List<int>();
                                    for (int i = 0; i < cc; i++)
                                    {
                                        float tv = BitConverter.ToSingle(buf, 1544 + i * 4);
                                        uint tj = BitConverter.ToUInt32(buf, 1024 + i * 4);
                                        list.Add((int)Math.Round(delta ? tj - tv : tv));
                                    }
                                    _temps = list.ToArray(); _ok = true;
                                }
                            }
                            finally { UnmapViewOfFile(p); }
                        }
                        CloseHandle(h);
                    }
                    else { _ok = false; _temps = new int[0]; }
                }
                catch (Exception ex) { Program.Log("local: " + ex.Message); _ok = false; }
                int left = ms; while (left > 0 && !_stop) { Thread.Sleep(Math.Min(100, left)); left -= 100; }
            }
        }
        public void Dispose() { Stop(); }
    }

    // 远程 SSH 各核温度
    internal sealed class RemoteTempReader : IDisposable
    {
        private const string TempCommand = @"
for h in /sys/class/hwmon/hwmon*; do
  n=$(cat ""$h/name"" 2>/dev/null)
  case ""$n"" in
    coretemp|k10temp|zenpower)
      for f in $h/temp*_input; do cat ""$f"" 2>/dev/null; done
      exit 0;;
  esac
done
for z in /sys/class/thermal/thermal_zone*; do
  t=$(cat ""$z/type"" 2>/dev/null)
  case ""$t"" in
    x86_pkg_temp|cpu_thermal|cpu-thermal|soc_thermal|soc-thermal) cat ""$z/temp"" 2>/dev/null; exit 0;;
  esac
done
";
        private readonly Config _config;
        private Thread _t; private volatile bool _stop;
        private volatile int[] _temps = new int[0]; private volatile bool _ok; private string _err = "";
        public int[] Temps { get { return _temps; } }
        public bool Ok { get { return _ok; } }
        public int MaxTemp { get { int m = -1; foreach (int v in _temps) if (v > m) m = v; return m; } }

        public RemoteTempReader(Config c) { _config = c; }
        public void Start() { Stop(); _stop = false; _t = new Thread(Loop) { IsBackground = true }; _t.Start(); }
        public void Stop() { _stop = true; var t = _t; _t = null; if (t != null) try { t.Join(1500); } catch { } _temps = new int[0]; _ok = false; }

        private void Loop()
        {
            while (!_stop)
            {
                try
                {
                    using (var client = CreateClient())
                    {
                        client.ConnectionInfo.Timeout = TimeSpan.FromSeconds(8);
                        client.KeepAliveInterval = TimeSpan.FromSeconds(30);
                        client.Connect(); _err = "";
                        while (!_stop)
                        {
                            var cmd = client.CreateCommand(TempCommand);
                            cmd.CommandTimeout = TimeSpan.FromSeconds(6);
                            string r = cmd.Execute().Trim();
                            var list = new List<int>();
                            foreach (string line in r.Split('\n'))
                            {
                                string s = line.Trim();
                                int m;
                                if (int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out m) && m > 0 && m < 200000) list.Add(m / 1000);
                            }
                            _temps = list.ToArray(); _ok = list.Count > 0;
                            SleepInterruptible(_config.RemoteInterval * 1000);
                        }
                    }
                }
                catch (Exception ex) { _err = ex.Message; _ok = false; Program.Log("ssh: " + ex.Message); SleepInterruptible(5000); }
            }
        }
        private SshClient CreateClient()
        {
            if (string.Equals(_config.Auth, "password", StringComparison.OrdinalIgnoreCase))
                return new SshClient(_config.Host, _config.Port, _config.User, _config.GetPassword());
            return new SshClient(_config.Host, _config.Port, _config.User, new PrivateKeyFile(_config.KeyPath));
        }
        private void SleepInterruptible(int ms) { int l = ms; while (l > 0 && !_stop) { Thread.Sleep(Math.Min(100, l)); l -= 100; } }
        public void Dispose() { Stop(); }
    }

    // 托盘
    internal sealed class TrayContext : ApplicationContext
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool DestroyIcon(IntPtr h);

        private Config _config;
        private readonly NotifyIcon _notify;
        private readonly System.Windows.Forms.Timer _timer;
        private LocalTempReader _local; private RemoteTempReader _remote;
        private SettingsForm _settings; private Icon _icon; private int _last = -1; private bool _closing;

        public TrayContext()
        {
            _config = Config.Load();
            _local = new LocalTempReader(); _local.Start(_config.LocalInterval * 1000);
            _remote = new RemoteTempReader(_config); _remote.Start();
            _icon = CreateIcon("--");
            _notify = new NotifyIcon { Icon = _icon, Text = "linux-cpu温度 v1.0.0", Visible = _config.ShowTrayIcon };
            _notify.DoubleClick += delegate { OpenSettings(); };
            var menu = new ContextMenuStrip();
            menu.Items.Add("设置…", null, delegate { OpenSettings(); });
            menu.Items.Add("立即刷新", null, delegate { RefreshNow(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("退出", null, delegate { ExitThread(); });
            _notify.ContextMenuStrip = menu;
            _timer = new System.Windows.Forms.Timer { Interval = 500 };
            _timer.Tick += OnTick; _timer.Start();
        }

        private void OnTick(object s, EventArgs e)
        {
            int lt = _config.ShowLocal ? _local.MaxTemp : -1;
            int rt = _config.ShowRemote ? _remote.MaxTemp : -1;
            int show = Math.Max(lt, rt);
            string tip;
            if (lt >= 0 && rt >= 0) tip = string.Format("本机 {0}°C · 远程 {1}°C", lt, rt);
            else if (lt >= 0) tip = "本机 " + lt + "°C";
            else if (rt >= 0) tip = "远程 " + rt + "°C";
            else tip = "linux-cpu温度";
            if (show >= 0 && show != _last) { _last = show; ReplaceIcon(show.ToString(CultureInfo.InvariantCulture), tip); }
            else if (show < 0 && _last != -2) { _last = -2; ReplaceIcon("--", tip); }
        }

        private void RefreshNow()
        {
            try { _local.Stop(); _local.Start(_config.LocalInterval * 1000); _remote.Stop(); _remote = new RemoteTempReader(_config); _remote.Start(); }
            catch (Exception ex) { Program.Log("RefreshNow: " + ex); }
        }

        private void ReplaceIcon(string text, string tooltip)
        {
            Icon next = CreateIcon(text); Icon old = _notify.Icon;
            _notify.Icon = next; _notify.Text = tooltip; _icon = next;
            if (old != null && !ReferenceEquals(old, next)) try { old.Dispose(); } catch { }
        }

        private static Icon CreateIcon(string text)
        {
            using (var bmp = new Bitmap(16, 16))
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.Transparent);
                g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
                g.SmoothingMode = SmoothingMode.None;
                using (var font = new Font("Tahoma", 8f))
                using (var brush = new SolidBrush(Color.Black))
                using (var sf = new StringFormat())
                {
                    sf.Alignment = StringAlignment.Center; sf.LineAlignment = StringAlignment.Center; sf.FormatFlags = StringFormatFlags.NoClip;
                    g.DrawString(text, font, brush, new RectangleF(0, 0, 16, 16), sf);
                }
                IntPtr h = bmp.GetHicon();
                try { using (var tmp = Icon.FromHandle(h)) return (Icon)tmp.Clone(); }
                finally { DestroyIcon(h); }
            }
        }

        private void OpenSettings()
        {
            if (_closing) return;
            try
            {
                if (_settings != null && !_settings.IsDisposed) { _settings.Activate(); return; }
                _settings = new SettingsForm(_config, _local, _remote);
                _settings.FormClosed += delegate { _settings = null; ReloadConfig(); };
                _settings.Show(); _settings.Activate();
            }
            catch (Exception ex) { Program.Log("OpenSettings: " + ex); }
        }

        private void ReloadConfig()
        {
            _config = Config.Load();
            _local.Stop(); _local = new LocalTempReader(); _local.Start(_config.LocalInterval * 1000);
            _remote.Stop(); _remote = new RemoteTempReader(_config); _remote.Start();
            _notify.Visible = _config.ShowTrayIcon; _last = -1;
        }

        protected override void ExitThreadCore()
        {
            _closing = true;
            try { _timer.Stop(); } catch { }
            try { _local.Dispose(); _remote.Dispose(); } catch { }
            try { _notify.Visible = false; _notify.Dispose(); } catch { }
            try { if (_icon != null) _icon.Dispose(); } catch { }
            base.ExitThreadCore();
        }
    }

    // ============ 自绘橙色 ToggleSwitch（参考 Freon 风格） ============
    internal sealed class ToggleSwitch : Control
    {
        private bool _checked;
        public bool Checked
        {
            get { return _checked; }
            set { _checked = value; Invalidate(); }
        }
        public event EventHandler CheckedChanged;

        public ToggleSwitch()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Size = new Size(46, 24);
            Cursor = Cursors.Hand;
        }

        protected override void OnClick(EventArgs e)
        {
            _checked = !_checked;
            Invalidate();
            if (CheckedChanged != null) CheckedChanged(this, e);
            base.OnClick(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            int w = Width, h = Height;
            int r = h / 2;
            // 轨道
            var trackColor = _checked ? Color.FromArgb(232, 93, 38) : Color.FromArgb(200, 200, 200);
            using (var brush = new SolidBrush(trackColor))
            using (var path = RoundedRect(0, 0, w - 1, h - 1, r))
                g.FillPath(brush, path);
            // 圆头
            int knobD = h - 4;
            int knobX = _checked ? (w - knobD - 2) : 2;
            using (var brush = new SolidBrush(Color.White))
                g.FillEllipse(brush, knobX, 2, knobD, knobD);
        }

        private static GraphicsPath RoundedRect(int x, int y, int w, int h, int r)
        {
            var p = new GraphicsPath();
            p.AddArc(x, y, r * 2, r * 2, 180, 90);
            p.AddArc(x + w - r * 2, y, r * 2, r * 2, 270, 90);
            p.AddArc(x + w - r * 2, y + h - r * 2, r * 2, r * 2, 0, 90);
            p.AddArc(x, y + h - r * 2, r * 2, r * 2, 90, 90);
            p.CloseFigure();
            return p;
        }
    }

    // ============ 三列设置窗口（Freon 风格） ============
    internal sealed class SettingsForm : Form
    {
        private readonly Config _config;
        private readonly LocalTempReader _local;
        private readonly RemoteTempReader _remote;

        // 颜色（参考 Freon）
        private static readonly Color TextMain = Color.FromArgb(45, 45, 45);
        private static readonly Color TextSub = Color.FromArgb(140, 140, 140);
        private static readonly Color Divider = Color.FromArgb(235, 235, 235);

        private NumericUpDown _localInterval, _remoteInterval, _port;
        private RadioButton _localAvg, _localMax, _remoteAvg, _remoteMax;
        private TextBox _host, _user, _keyPath, _password;
        private Button _browse;
        private ToggleSwitch _showLocal, _showRemote;
        private Label _localTemps, _remoteTemps;
        private System.Windows.Forms.Timer _refreshTimer;

        public SettingsForm(Config config, LocalTempReader local, RemoteTempReader remote)
        {
            _config = config; _local = local; _remote = remote;

            Text = "linux-cpu温度";
            FormBorderStyle = FormBorderStyle.FixedSingle;
            StartPosition = FormStartPosition.CenterScreen;
            MaximizeBox = false; MinimizeBox = false; TopMost = true;
            ClientSize = new Size(900, 540);
            BackColor = Color.White;
            Font = new Font("Microsoft YaHei UI", 9f);

            // 顶部标题居中
            var title = new Label
            {
                Text = "linux-cpu温度 v1.0.0",
                Font = new Font("Microsoft YaHei UI", 11f, FontStyle.Bold),
                ForeColor = TextMain,
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, 12),
                Size = new Size(900, 26)
            };
            Controls.Add(title);

            BuildLeftColumn();
            BuildMidColumn();
            BuildRightColumn();

            // 底部按钮
            var btnCancel = MakeButton("取消", 620, 498);
            btnCancel.Click += delegate { Close(); };
            Controls.Add(btnCancel);
            var btnSave = MakeButton("保存", 760, 498);
            btnSave.Click += delegate { SaveSettings(); };
            Controls.Add(btnSave);

            AcceptButton = btnSave; CancelButton = btnCancel;

            _refreshTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            _refreshTimer.Tick += delegate { UpdateTempLabels(); };
            _refreshTimer.Start();
            UpdateTempLabels();
        }

        // ---- 一行设置项容器：标签左，控件右，底部分隔线 ----
        private Panel MakeRow(int x, int y, string label, int w)
        {
            var p = new Panel { Location = new Point(x, y), Size = new Size(w, 44), BackColor = Color.White };
            var l = new Label { Text = label, Location = new Point(16, 0), Size = new Size(w - 100, 44), ForeColor = TextMain, TextAlign = ContentAlignment.MiddleLeft, BackColor = Color.White };
            p.Controls.Add(l);
            var line = new Panel { Location = new Point(16, 43), Size = new Size(w - 32, 1), BackColor = Divider };
            p.Controls.Add(line);
            return p;
        }

        private void BuildLeftColumn()
        {
            var h1 = new Label { Text = "显示选项", Font = new Font("Microsoft YaHei UI", 10f, FontStyle.Bold), ForeColor = TextMain, Location = new Point(20, 50), AutoSize = true };
            Controls.Add(h1);

            int y = 80;
            var row1 = MakeRow(20, y, "本机刷新间隔(秒)", 280);
            _localInterval = new NumericUpDown { Minimum = 1, Maximum = 60, Value = _config.LocalInterval, Location = new Point(220, 10), Size = new Size(50, 25) };
            row1.Controls.Add(_localInterval);
            Controls.Add(row1); y += 44;

            var row2 = MakeRow(20, y, "远程刷新间隔(秒)", 280);
            _remoteInterval = new NumericUpDown { Minimum = 1, Maximum = 60, Value = _config.RemoteInterval, Location = new Point(220, 10), Size = new Size(50, 25) };
            row2.Controls.Add(_remoteInterval);
            Controls.Add(row2); y += 44;

            var row3 = MakeRow(20, y, "本机温度类型", 280);
            _localAvg = new RadioButton { Text = "平均", Location = new Point(185, 12), AutoSize = true, Checked = _config.LocalMode != "max" };
            _localMax = new RadioButton { Text = "最高", Location = new Point(235, 12), AutoSize = true, Checked = _config.LocalMode == "max" };
            row3.Controls.Add(_localAvg); row3.Controls.Add(_localMax);
            Controls.Add(row3); y += 44;

            var row4 = MakeRow(20, y, "远程温度类型", 280);
            _remoteAvg = new RadioButton { Text = "平均", Location = new Point(185, 12), AutoSize = true, Checked = _config.RemoteMode != "max" };
            _remoteMax = new RadioButton { Text = "最高", Location = new Point(235, 12), AutoSize = true, Checked = _config.RemoteMode == "max" };
            row4.Controls.Add(_remoteAvg); row4.Controls.Add(_remoteMax);
            Controls.Add(row4);
        }

        private void BuildMidColumn()
        {
            var h2 = new Label { Text = "传感器提供程序", Font = new Font("Microsoft YaHei UI", 10f, FontStyle.Bold), ForeColor = TextMain, Location = new Point(320, 50), AutoSize = true };
            Controls.Add(h2);

            // 远程 SSH 主机卡片
            var card = new Panel { Location = new Point(320, 80), Size = new Size(280, 330), BackColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
            Controls.Add(card);

            var cardTitle = new Label { Text = "远程 SSH 主机", Font = new Font("Microsoft YaHei UI", 9.5f, FontStyle.Bold), ForeColor = TextMain, Location = new Point(16, 12), AutoSize = true };
            card.Controls.Add(cardTitle);

            int y = 44;
            AddInputRow(card, "主机 IP/域名", ref _host, _config.Host, ref y, 18);
            AddInputRow(card, "SSH 用户名", ref _user, _config.User, ref y, 18);
            AddInputRow(card, "端口", ref _port, _config.Port, ref y, 18, true);

            // 密钥路径 + 浏览按钮
            AddDividerRow(card, ref y);
            var lblKey = new Label { Text = "密钥路径(可选)", ForeColor = TextMain, Location = new Point(16, y + 8), Size = new Size(100, 20), BackColor = Color.White };
            card.Controls.Add(lblKey);
            _keyPath = new TextBox { Text = _config.KeyPath, Location = new Point(16, y + 30), Size = new Size(180, 25), BorderStyle = BorderStyle.FixedSingle };
            card.Controls.Add(_keyPath);
            _browse = new Button { Text = "浏览…", Location = new Point(202, y + 29), Size = new Size(66, 27), FlatStyle = FlatStyle.Flat };
            _browse.FlatAppearance.BorderSize = 1;
            _browse.Click += delegate { BrowseKey(); };
            card.Controls.Add(_browse);
            y += 68;

            // 密码
            var lblPwd = new Label { Text = "密码(可选)", ForeColor = TextMain, Location = new Point(16, y + 8), Size = new Size(100, 20), BackColor = Color.White };
            card.Controls.Add(lblPwd);
            _password = new TextBox { UseSystemPasswordChar = true, Text = _config.GetPassword(), Location = new Point(16, y + 30), Size = new Size(254, 25), BorderStyle = BorderStyle.FixedSingle };
            card.Controls.Add(_password);
        }

        private void AddInputRow(Panel parent, string label, ref TextBox box, string val, ref int y, int top)
        {
            var l = new Label { Text = label, ForeColor = TextMain, Location = new Point(16, y + top), Size = new Size(120, 20), BackColor = Color.White };
            parent.Controls.Add(l);
            box = new TextBox { Text = val, Location = new Point(16, y + top + 22), Size = new Size(254, 25), BorderStyle = BorderStyle.FixedSingle };
            parent.Controls.Add(box);
            y += 52;
        }
        private void AddInputRow(Panel parent, string label, ref NumericUpDown box, int val, ref int y, int top, bool isNum)
        {
            var l = new Label { Text = label, ForeColor = TextMain, Location = new Point(16, y + top), Size = new Size(120, 20), BackColor = Color.White };
            parent.Controls.Add(l);
            box = new NumericUpDown { Minimum = 1, Maximum = 65535, Value = val, Location = new Point(16, y + top + 22), Size = new Size(80, 25) };
            parent.Controls.Add(box);
            y += 52;
        }
        private void AddDividerRow(Panel parent, ref int y)
        {
            var line = new Panel { Location = new Point(16, y), Size = new Size(248, 1), BackColor = Divider };
            parent.Controls.Add(line);
            y += 10;
        }

        private void BuildRightColumn()
        {
            var h3 = new Label { Text = "显示传感器", Font = new Font("Microsoft YaHei UI", 10f, FontStyle.Bold), ForeColor = TextMain, Location = new Point(630, 50), AutoSize = true };
            Controls.Add(h3);

            var row1 = MakeRow(630, 80, "本机温度", 250);
            _showLocal = new ToggleSwitch { Checked = _config.ShowLocal, Location = new Point(195, 10) };
            row1.Controls.Add(_showLocal);
            Controls.Add(row1);

            var row2 = MakeRow(630, 124, "远程温度", 250);
            _showRemote = new ToggleSwitch { Checked = _config.ShowRemote, Location = new Point(195, 10) };
            row2.Controls.Add(_showRemote);
            Controls.Add(row2);

            var h4 = new Label { Text = "当前各核温度", Font = new Font("Microsoft YaHei UI", 9.5f, FontStyle.Bold), ForeColor = TextMain, Location = new Point(630, 180), AutoSize = true };
            Controls.Add(h4);

            _localTemps = new Label { Location = new Point(630, 210), Size = new Size(260, 90), ForeColor = TextMain, Font = new Font("Microsoft YaHei UI", 9f), BackColor = Color.White };
            Controls.Add(_localTemps);

            _remoteTemps = new Label { Location = new Point(630, 310), Size = new Size(260, 110), ForeColor = TextMain, Font = new Font("Microsoft YaHei UI", 9f), BackColor = Color.White };
            Controls.Add(_remoteTemps);
        }

        private static Button MakeButton(string text, int x, int y)
        {
            return new Button
            {
                Text = text, Location = new Point(x, y), Size = new Size(120, 34),
                FlatStyle = FlatStyle.Flat, BackColor = Color.White,
                Font = new Font("Microsoft YaHei UI", 9.5f)
            };
        }

        private void BrowseKey()
        {
            using (var dlg = new OpenFileDialog())
            {
                dlg.Filter = "密钥文件|*.*";
                dlg.InitialDirectory = Program.BaseDir;
                if (dlg.ShowDialog(this) == DialogResult.OK) _keyPath.Text = dlg.FileName;
            }
        }

        private void UpdateTempLabels()
        {
            _localTemps.Text = FormatTemps("本机", _local.Temps, _local.Ok);
            _remoteTemps.Text = FormatTemps("远程", _remote.Temps, _remote.Ok);
        }

        private static string FormatTemps(string prefix, int[] temps, bool ok)
        {
            if (!ok || temps == null || temps.Length == 0) return prefix + "：—";
            var sb = new StringBuilder();
            sb.Append(prefix).Append("：");
            for (int i = 0; i < temps.Length; i++)
            {
                if (i > 0) sb.Append(i % 3 == 0 ? "\n" : "  ");
                sb.Append("Core").Append(i).Append(' ').Append(temps[i]).Append("°C");
            }
            return sb.ToString();
        }

        private void SaveSettings()
        {
            string host = _host.Text.Trim();
            string user = _user.Text.Trim();
            if (host.Length == 0 || user.Length == 0)
            {
                MessageBox.Show(this, "主机和用户名不能为空。", "linux-cpu温度");
                return;
            }
            string key = _keyPath.Text.Trim();
            if (!string.IsNullOrEmpty(key) && !File.Exists(key))
            {
                MessageBox.Show(this, "密钥文件不存在：" + key, "linux-cpu温度");
                return;
            }

            _config.Host = host;
            _config.Port = (int)_port.Value;
            _config.User = user;
            _config.KeyPath = key;
            if (_password.Text.Length > 0) _config.SetPassword(_password.Text);
            _config.Auth = string.IsNullOrEmpty(key) ? "password" : "key";
            _config.LocalInterval = (int)_localInterval.Value;
            _config.RemoteInterval = (int)_remoteInterval.Value;
            _config.LocalMode = _localMax.Checked ? "max" : "avg";
            _config.RemoteMode = _remoteMax.Checked ? "max" : "avg";
            _config.ShowLocal = _showLocal.Checked;
            _config.ShowRemote = _showRemote.Checked;

            try { _config.Save(); DialogResult = DialogResult.OK; Close(); }
            catch (Exception ex) { MessageBox.Show(this, "保存失败: " + ex.Message, "linux-cpu温度"); }
        }
    }
}
