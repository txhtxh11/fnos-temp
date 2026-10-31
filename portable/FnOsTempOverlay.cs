using System;
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
                Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs e)
                {
                    Log("ThreadException: " + e.Exception);
                };
                AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e)
                {
                    Log("Unhandled: " + e.ExceptionObject);
                };
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
                if (File.Exists(path))
                    return Assembly.Load(File.ReadAllBytes(path));
            }
            catch { }
            return null;
        }

        public static void Log(string message)
        {
            try
            {
                File.AppendAllText(
                    Path.Combine(BaseDir, "app.log"),
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + Environment.NewLine,
                    Encoding.UTF8);
            }
            catch { }
        }
    }

    internal sealed class Config
    {
        public string Host = "";
        public int Port = 22;
        public string User = "";
        public string Auth = "key";
        public string KeyPath = "";
        public string PasswordEnc = "";
        public int IntervalSeconds = 2;
        public bool ShowTrayIcon = true;

        public static string FilePath
        {
            get { return Path.Combine(Program.BaseDir, "config.ini"); }
        }

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
                    string key = line.Substring(0, eq).Trim().ToLowerInvariant();
                    string val = line.Substring(eq + 1).Trim();
                    switch (key)
                    {
                        case "host": c.Host = val; break;
                        case "port": int.TryParse(val, out c.Port); break;
                        case "user": c.User = val; break;
                        case "auth": c.Auth = val; break;
                        case "keypath": c.KeyPath = val; break;
                        case "passwordenc": c.PasswordEnc = val; break;
                        case "intervalseconds": int.TryParse(val, out c.IntervalSeconds); break;
                        case "showtrayicon": c.ShowTrayIcon = val != "0"; break;
                    }
                }
            }
            if (c.Port < 1 || c.Port > 65535) c.Port = 22;
            if (c.IntervalSeconds < 1) c.IntervalSeconds = 1;
            if (c.IntervalSeconds > 60) c.IntervalSeconds = 60;
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
            sb.AppendLine("IntervalSeconds=" + IntervalSeconds.ToString(CultureInfo.InvariantCulture));
            sb.AppendLine("ShowTrayIcon=" + (ShowTrayIcon ? "1" : "0"));
            File.WriteAllText(FilePath, sb.ToString(), new UTF8Encoding(false));
        }

        public string GetPassword()
        {
            if (string.IsNullOrEmpty(PasswordEnc)) return "";
            try
            {
                byte[] data = Convert.FromBase64String(PasswordEnc);
                byte[] plain = ProtectedData.Unprotect(data, null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(plain);
            }
            catch { return ""; }
        }

        public void SetPassword(string password)
        {
            if (string.IsNullOrEmpty(password)) { PasswordEnc = ""; return; }
            byte[] data = ProtectedData.Protect(Encoding.UTF8.GetBytes(password), null, DataProtectionScope.CurrentUser);
            PasswordEnc = Convert.ToBase64String(data);
        }
    }

    internal static class Autostart
    {
        private static string LinkPath
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.Startup),
                    "linux-cpu温度.vbs");
            }
        }

        public static bool IsEnabled()
        {
            return File.Exists(LinkPath);
        }

        public static void Set(bool enabled)
        {
            if (!enabled)
            {
                if (File.Exists(LinkPath)) File.Delete(LinkPath);
                return;
            }
            string ps1 = Path.Combine(Program.BaseDir, "FnOsTempOverlay.ps1");
            string vbs =
                "Set sh = CreateObject(\"WScript.Shell\")\r\n" +
                "sh.Run \"powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File \"\"" +
                ps1 + "\"\"\", 0, False\r\n";
            File.WriteAllText(LinkPath, vbs, Encoding.Unicode);
        }
    }

    internal sealed class TempReader : IDisposable
    {
        private const string TempCommand = @"
for z in /sys/class/thermal/thermal_zone*; do
  t=$(cat ""$z/type"" 2>/dev/null)
  case ""$t"" in
    x86_pkg_temp|cpu_thermal|cpu-thermal|soc_thermal|soc-thermal) cat ""$z/temp"" 2>/dev/null; exit 0;;
  esac
done
for h in /sys/class/hwmon/hwmon*; do
  n=$(cat ""$h/name"" 2>/dev/null)
  case ""$n"" in
    coretemp|k10temp|zenpower) cat $h/temp*_input 2>/dev/null | sort -n | tail -1; exit 0;;
  esac
done
max=0
for z in /sys/class/thermal/thermal_zone*; do
  v=$(cat ""$z/temp"" 2>/dev/null)
  case ""$v"" in ''|*[!0-9]*) continue;; esac
  [ ""$v"" -gt ""$max"" ] && max=$v
done
[ ""$max"" -gt 0 ] && echo ""$max""
";

        private readonly Config _config;
        private Thread _thread;
        private volatile bool _stop;
        private volatile int _temp = -1;
        private string _error = "";

        public TempReader(Config config) { _config = config; }

        public int Temp { get { return _temp; } }
        public string LastError { get { return _error; } }

        public void Start()
        {
            Stop();
            _stop = false;
            _thread = new Thread(Loop);
            _thread.IsBackground = true;
            _thread.Start();
        }

        public void Stop()
        {
            _stop = true;
            Thread t = _thread;
            _thread = null;
            if (t != null)
            {
                try { t.Join(2000); } catch { }
            }
            _temp = -1;
        }

        private void Loop()
        {
            try
            {
                while (!_stop)
                {
                    try
                    {
                        using (SshClient client = CreateClient())
                        {
                            client.ConnectionInfo.Timeout = TimeSpan.FromSeconds(8);
                            client.KeepAliveInterval = TimeSpan.FromSeconds(30);
                            client.Connect();
                            _error = "";
                            while (!_stop)
                            {
                                SshCommand cmd = client.CreateCommand(TempCommand);
                                cmd.CommandTimeout = TimeSpan.FromSeconds(6);
                                string result = cmd.Execute().Trim();
                                int milli;
                                if (int.TryParse(result, NumberStyles.Integer, CultureInfo.InvariantCulture, out milli)
                                    && milli > 0 && milli < 200000)
                                    _temp = milli / 1000;
                                else
                                    _temp = -1;
                                SleepInterruptible(_config.IntervalSeconds * 1000);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _error = ex.Message;
                        _temp = -1;
                        Program.Log("ssh: " + ex.Message);
                        SleepInterruptible(5000);
                    }
                }
            }
            catch (Exception ex)
            {
                Program.Log("Loop fatal: " + ex);
            }
        }

        private SshClient CreateClient()
        {
            if (string.Equals(_config.Auth, "password", StringComparison.OrdinalIgnoreCase))
                return new SshClient(_config.Host, _config.Port, _config.User, _config.GetPassword());
            var key = new PrivateKeyFile(_config.KeyPath);
            return new SshClient(_config.Host, _config.Port, _config.User, key);
        }

        private void SleepInterruptible(int milliseconds)
        {
            int left = milliseconds;
            while (left > 0 && !_stop)
            {
                Thread.Sleep(Math.Min(100, left));
                left -= 100;
            }
        }

        public void Dispose() { Stop(); }
    }

    internal sealed class TrayContext : ApplicationContext
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool DestroyIcon(IntPtr handle);

        private Config _config;
        private readonly NotifyIcon _notify;
        private readonly System.Windows.Forms.Timer _timer;
        private TempReader _reader;
        private SettingsForm _settings;
        private Icon _icon;
        private int _last = -1;
        private bool _closing;

        public TrayContext()
        {
            _config = Config.Load();
            _reader = new TempReader(_config);
            _reader.Start();

            _icon = CreateIcon("--");
            _notify = new NotifyIcon();
            _notify.Icon = _icon;
            _notify.Text = "linux-cpu温度 v1.0.0";
            _notify.Visible = _config.ShowTrayIcon;
            _notify.DoubleClick += delegate { OpenSettings(); };

            var menu = new ContextMenuStrip();
            menu.Items.Add("设置…", null, delegate { OpenSettings(); });
            menu.Items.Add("托盘设置", null, delegate
            {
                try { Process.Start("ms-settings:taskbar"); } catch { }
            });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("退出", null, delegate { ExitThread(); });
            _notify.ContextMenuStrip = menu;

            _timer = new System.Windows.Forms.Timer();
            _timer.Interval = 500;
            _timer.Tick += OnTick;
            _timer.Start();
        }

        private void OnTick(object sender, EventArgs e)
        {
            int t = _reader.Temp;
            if (t >= 0 && t != _last)
            {
                _last = t;
                ReplaceIcon(t.ToString(CultureInfo.InvariantCulture), "linux-cpu " + t + "°C");
            }
            else if (t < 0 && _last != -2)
            {
                _last = -2;
                ReplaceIcon("--", "linux-cpu温度");
            }
        }

        private void ReplaceIcon(string text, string tooltip)
        {
            Icon next = CreateIcon(text);
            Icon old = _notify.Icon;
            _notify.Icon = next;
            _notify.Text = tooltip;
            _icon = next;
            if (old != null && !ReferenceEquals(old, next))
            {
                try { old.Dispose(); } catch { }
            }
        }

        private static Icon CreateIcon(string text)
        {
            using (var bmp = new Bitmap(16, 16))
            {
                using (var g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.Transparent);
                    g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
                    g.SmoothingMode = SmoothingMode.None;
                    using (var font = new Font("Tahoma", 8f, FontStyle.Regular, GraphicsUnit.Point))
                    using (var brush = new SolidBrush(Color.Black))
                    using (var sf = new StringFormat())
                    {
                        sf.Alignment = StringAlignment.Center;
                        sf.LineAlignment = StringAlignment.Center;
                        sf.FormatFlags = StringFormatFlags.NoClip;
                        g.DrawString(text, font, brush, new RectangleF(0, 0, 16, 16), sf);
                    }
                }
                IntPtr h = bmp.GetHicon();
                try
                {
                    using (Icon tmp = Icon.FromHandle(h))
                        return (Icon)tmp.Clone();
                }
                finally
                {
                    DestroyIcon(h);
                }
            }
        }

        private void OpenSettings()
        {
            if (_closing) return;
            try
            {
                if (_settings != null && !_settings.IsDisposed)
                {
                    _settings.Activate();
                    return;
                }
                _settings = new SettingsForm(_config);
                _settings.FormClosed += delegate
                {
                    _settings = null;
                    ReloadConfig();
                };
                _settings.Show();
                _settings.Activate();
            }
            catch (Exception ex)
            {
                Program.Log("OpenSettings: " + ex);
            }
        }

        private void ReloadConfig()
        {
            _config = Config.Load();
            _reader.Stop();
            _reader = new TempReader(_config);
            _reader.Start();
            _notify.Visible = _config.ShowTrayIcon;
            _last = -1;
        }

        protected override void ExitThreadCore()
        {
            _closing = true;
            try { _timer.Stop(); } catch { }
            try { _reader.Dispose(); } catch { }
            try { _notify.Visible = false; _notify.Dispose(); } catch { }
            try { if (_icon != null) _icon.Dispose(); } catch { }
            base.ExitThreadCore();
        }
    }

    internal sealed class SettingsForm : Form
    {
        private readonly Config _config;
        private readonly TextBox _host;
        private readonly NumericUpDown _port;
        private readonly TextBox _user;
        private readonly RadioButton _rbKey;
        private readonly RadioButton _rbPassword;
        private readonly TextBox _keyPath;
        private readonly Button _browse;
        private readonly TextBox _password;
        private readonly NumericUpDown _interval;
        private readonly CheckBox _autostart;
        private readonly Label _status;

        public SettingsForm(Config config)
        {
            _config = config;

            Text = "linux-cpu温度设置";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterScreen;
            MaximizeBox = false;
            MinimizeBox = false;
            TopMost = true;
            ClientSize = new Size(600, 470);
            Font = new Font("Microsoft YaHei UI", 9f, FontStyle.Regular, GraphicsUnit.Point);

            // 品牌行：左 名称+版本，右 TXH
            var brandLeft = new Label();
            brandLeft.Text = "linux-cpu温度 v1.0.0";
            brandLeft.Font = new Font("Microsoft YaHei UI", 12f, FontStyle.Bold, GraphicsUnit.Point);
            brandLeft.AutoSize = true;
            brandLeft.Location = new Point(20, 10);
            Controls.Add(brandLeft);

            var brandRight = new Label();
            brandRight.Text = "TXH";
            brandRight.Font = new Font("Microsoft YaHei UI", 12f, FontStyle.Bold, GraphicsUnit.Point);
            brandRight.TextAlign = ContentAlignment.MiddleRight;
            brandRight.Size = new Size(40, 26);
            brandRight.Location = new Point(440, 8);
            brandRight.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            Controls.Add(brandRight);

            AddLabel("主机", 20, 53);
            _host = AddText(config.Host, 100, 50, 180);
            AddLabel("端口", 300, 53);
            _port = new NumericUpDown();
            _port.Minimum = 1;
            _port.Maximum = 65535;
            _port.Value = config.Port;
            _port.Location = new Point(395, 50);
            _port.Size = new Size(70, 25);
            Controls.Add(_port);

            AddLabel("用户名", 20, 88);
            _user = AddText(config.User, 100, 85, 240);

            var grp = new GroupBox();
            grp.Text = "SSH 认证";
            grp.Location = new Point(20, 120);
            grp.Size = new Size(460, 130);
            Controls.Add(grp);

            _rbKey = new RadioButton();
            _rbKey.Text = "使用密钥文件";
            _rbKey.Location = new Point(15, 25);
            _rbKey.Size = new Size(120, 24);
            _rbKey.Checked = config.Auth != "password";
            grp.Controls.Add(_rbKey);

            _keyPath = new TextBox();
            _keyPath.Text = config.KeyPath;
            _keyPath.Location = new Point(140, 24);
            _keyPath.Size = new Size(230, 25);
            grp.Controls.Add(_keyPath);

            _browse = new Button();
            _browse.Text = "浏览…";
            _browse.Location = new Point(378, 22);
            _browse.Size = new Size(66, 28);
            _browse.Click += delegate { BrowseKey(); };
            grp.Controls.Add(_browse);

            _rbPassword = new RadioButton();
            _rbPassword.Text = "使用密码";
            _rbPassword.Location = new Point(15, 60);
            _rbPassword.Size = new Size(120, 24);
            _rbPassword.Checked = config.Auth == "password";
            grp.Controls.Add(_rbPassword);

            _password = new TextBox();
            _password.UseSystemPasswordChar = true;
            _password.Location = new Point(140, 59);
            _password.Size = new Size(230, 25);
            _password.Text = config.GetPassword();
            grp.Controls.Add(_password);

            var note = new Label();
            note.Text = "密码用当前 Windows 用户的 DPAPI 加密保存";
            note.ForeColor = Color.Gray;
            note.Location = new Point(15, 95);
            note.Size = new Size(430, 20);
            grp.Controls.Add(note);

            _rbKey.CheckedChanged += delegate { UpdateAuth(); };
            _rbPassword.CheckedChanged += delegate { UpdateAuth(); };
            UpdateAuth();

            AddLabel("刷新间隔(秒)", 20, 265);
            _interval = new NumericUpDown();
            _interval.Minimum = 1;
            _interval.Maximum = 60;
            _interval.Value = config.IntervalSeconds;
            _interval.Location = new Point(130, 262);
            _interval.Size = new Size(60, 25);
            Controls.Add(_interval);

            var btnTray = new Button();
            btnTray.Text = "托盘设置";
            btnTray.Location = new Point(380, 259);
            btnTray.Size = new Size(100, 28);
            btnTray.Click += delegate
            {
                try { Process.Start("ms-settings:taskbar"); } catch { }
            };
            Controls.Add(btnTray);

            _autostart = new CheckBox();
            _autostart.Text = "随系统启动";
            _autostart.Checked = Autostart.IsEnabled();
            _autostart.Location = new Point(20, 295);
            _autostart.Size = new Size(160, 24);
            Controls.Add(_autostart);

            var hideNote = new Label();
            hideNote.Text = "显示/隐藏图标：托盘设置 → 其他系统托盘图标";
            hideNote.ForeColor = Color.Gray;
            hideNote.Location = new Point(220, 295);
            hideNote.Size = new Size(260, 24);
            Controls.Add(hideNote);

            var support = new Label();
            support.Text = "支持任意 Linux：读取 /sys/class/thermal 或 hwmon（coretemp / k10temp / zenpower）";
            support.ForeColor = Color.Gray;
            support.Location = new Point(20, 325);
            support.Size = new Size(460, 22);
            Controls.Add(support);

            var btnTest = new Button();
            btnTest.Text = "测试连接";
            btnTest.Location = new Point(20, 360);
            btnTest.Size = new Size(100, 32);
            btnTest.Click += delegate { TestConnection(); };
            Controls.Add(btnTest);

            var btnSave = new Button();
            btnSave.Text = "保存";
            btnSave.Location = new Point(140, 360);
            btnSave.Size = new Size(100, 32);
            btnSave.Click += delegate { SaveSettings(); };
            Controls.Add(btnSave);

            var btnCancel = new Button();
            btnCancel.Text = "取消";
            btnCancel.Location = new Point(260, 360);
            btnCancel.Size = new Size(100, 32);
            btnCancel.Click += delegate { Close(); };
            Controls.Add(btnCancel);

            var btnExit = new Button();
            btnExit.Text = "退出程序";
            btnExit.Location = new Point(380, 360);
            btnExit.Size = new Size(100, 32);
            btnExit.Click += delegate { Application.Exit(); };
            Controls.Add(btnExit);

            _status = new Label();
            _status.ForeColor = Color.Gray;
            _status.Location = new Point(20, 410);
            _status.Size = new Size(460, 24);
            Controls.Add(_status);

            AcceptButton = btnSave;
            CancelButton = btnCancel;
        }

        private void AddLabel(string text, int x, int y)
        {
            var label = new Label();
            label.Text = text;
            label.Location = new Point(x, y);
            label.Size = new Size(80, 24);
            Controls.Add(label);
        }

        private TextBox AddText(string text, int x, int y, int width)
        {
            var box = new TextBox();
            box.Text = text;
            box.Location = new Point(x, y);
            box.Size = new Size(width, 25);
            Controls.Add(box);
            return box;
        }

        private void UpdateAuth()
        {
            bool key = _rbKey.Checked;
            _keyPath.Enabled = key;
            _browse.Enabled = key;
            _password.Enabled = !key;
        }

        private void BrowseKey()
        {
            using (var dialog = new OpenFileDialog())
            {
                dialog.Filter = "所有文件|*.*";
                dialog.InitialDirectory = Program.BaseDir;
                if (dialog.ShowDialog(this) == DialogResult.OK)
                    _keyPath.Text = dialog.FileName;
            }
        }

        private bool ApplyToConfig()
        {
            string host = _host.Text.Trim();
            string user = _user.Text.Trim();
            if (host.Length == 0 || user.Length == 0)
            {
                MessageBox.Show(this, "主机和用户名不能为空。", "linux-cpu温度设置");
                return false;
            }
            if (_rbKey.Checked)
            {
                string key = _keyPath.Text.Trim();
                if (key.Length == 0 || !File.Exists(key))
                {
                    MessageBox.Show(this, "密钥文件不存在。", "linux-cpu温度设置");
                    return false;
                }
            }
            else if (_password.Text.Length == 0 && _config.PasswordEnc.Length == 0)
            {
                MessageBox.Show(this, "请输入 SSH 密码。", "linux-cpu温度设置");
                return false;
            }

            _config.Host = host;
            _config.Port = (int)_port.Value;
            _config.User = user;
            _config.Auth = _rbKey.Checked ? "key" : "password";
            if (_rbKey.Checked) _config.KeyPath = _keyPath.Text.Trim();
            if (_password.Text.Length > 0) _config.SetPassword(_password.Text);
            _config.IntervalSeconds = (int)_interval.Value;
            return true;
        }

        private void SaveSettings()
        {
            if (!ApplyToConfig()) return;
            try
            {
                _config.Save();
                Autostart.Set(_autostart.Checked);
                DialogResult = DialogResult.OK;
                Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, "保存失败: " + ex.Message, "linux-cpu温度设置");
            }
        }

        private void TestConnection()
        {
            string host = _host.Text.Trim();
            string user = _user.Text.Trim();
            int port = (int)_port.Value;
            if (host.Length == 0 || user.Length == 0)
            {
                MessageBox.Show(this, "主机和用户名不能为空。", "测试连接");
                return;
            }

            Cursor previous = Cursor;
            Cursor = Cursors.WaitCursor;
            _status.Text = "正在连接 " + host + " …";
            try
            {
                using (SshClient client = CreateTestClient(host, port, user))
                {
                    client.ConnectionInfo.Timeout = TimeSpan.FromSeconds(8);
                    client.Connect();
                    SshCommand cmd = client.CreateCommand("echo ok");
                    cmd.CommandTimeout = TimeSpan.FromSeconds(6);
                    string result = cmd.Execute().Trim();
                    _status.Text = "连接成功";
                    MessageBox.Show(this, "连接成功，返回: " + result, "测试连接");
                }
            }
            catch (Exception ex)
            {
                _status.Text = "连接失败";
                MessageBox.Show(this, "连接失败:\r\n" + ex.Message, "测试连接");
            }
            finally
            {
                Cursor = previous;
            }
        }

        private SshClient CreateTestClient(string host, int port, string user)
        {
            if (_rbKey.Checked)
            {
                var key = new PrivateKeyFile(_keyPath.Text.Trim());
                return new SshClient(host, port, user, key);
            }
            string password = _password.Text.Length > 0 ? _password.Text : _config.GetPassword();
            return new SshClient(host, port, user, password);
        }
    }
}
