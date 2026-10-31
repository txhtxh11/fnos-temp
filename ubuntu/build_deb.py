#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建 linux-cpu温度 Ubuntu GNOME 扩展的 .deb 安装包（纯 Python，Windows/Linux 均可）。

用法:
    python3 build_deb.py

产物: 本目录下 linux-cpu-temp_1.0.0_all.deb
源:   portable/linux-temp@txh/  （GNOME 扩展本体）
安装: sudo dpkg -i linux-cpu-temp_1.0.0_all.deb  （自动装系统级扩展目录并启用）
"""
import os
import io
import gzip
import tarfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_EXT = os.path.join(SCRIPT_DIR, 'portable', 'linux-temp@txh')
OUT = os.path.join(SCRIPT_DIR, 'linux-cpu-temp_1.0.0_all.deb')

PKG = "linux-cpu-temp"
VER = "1.0.0"


def build_tar_gz(members):
    """members: list of (path_in_tar, mode, data_bytes). 返回 gzip(tar) bytes"""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w') as tf:
        for name, mode, data in members:
            ti = tarfile.TarInfo(name)
            ti.size = len(data)
            ti.mode = mode
            ti.mtime = 0
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = 'root'
            tf.addfile(ti, io.BytesIO(data))
    raw = buf.getvalue()
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode='wb', mtime=0) as g:
        g.write(raw)
    return out.getvalue()


def ar_member(name, data, mode='100644'):
    """构造单个 ar 成员：header + data，数据长度补齐到偶数"""
    name_b = name.encode('utf-8').ljust(16, b' ')
    mtime = b'0'.ljust(12, b' ')
    uid = b'0'.ljust(6, b' ')
    gid = b'0'.ljust(6, b' ')
    perm = mode.encode('ascii').ljust(8, b' ')
    size = str(len(data)).encode('utf-8').ljust(10, b' ')
    head = name_b + mtime + uid + gid + perm + size + b'`\n'
    if len(data) % 2 == 1:
        data += b'\n'
    return head + data


def main():
    # data 文件 (usr/share/gnome-shell/extensions/linux-temp@txh/)
    data_files = []
    prefix = "usr/share/gnome-shell/extensions/linux-temp@txh/"
    for fn in sorted(os.listdir(SRC_EXT)):
        with open(os.path.join(SRC_EXT, fn), 'rb') as f:
            data_files.append((prefix + fn, 0o100644, f.read()))

    CONTROL = f"""Package: {PKG}
Version: {VER}
Section: utils
Priority: optional
Architecture: all
Depends: gnome-shell
Recommends: sshpass
Maintainer: txhtxh11
Description: linux-cpu温度 GNOME 顶部栏扩展（本机+远程 Linux CPU 温度显示）
 通过 SSH 读取本机与局域网远程 Linux 主机（飞牛 fnOS、群晖、Ubuntu、
 Debian 等）的 CPU 温度，实时显示在 GNOME 顶部状态栏，支持本机+远程
 双温度、各自刷新间隔与温度类型，设置界面为 Adw 浅色三段布局。
"""

    POSTINST = r"""#!/bin/sh
set -e
UUID=linux-temp@txh
# DEB 安装到系统级扩展目录，移除可能残留的用户级同名扩展避免冲突
rm -rf "$HOME/.local/share/gnome-shell/extensions/$UUID" 2>/dev/null || true
# 配置模板（不存在才生成）
mkdir -p "$HOME/.config/linux-temp"
if [ ! -f "$HOME/.config/linux-temp/config" ]; then
cat > "$HOME/.config/linux-temp/config" <<'EOF'
FNOS_HOST=
FNOS_USER=
FNOS_PORT=22
FNOS_KEY=
FNOS_PASSWORD=
INTERVAL=5
LOCAL_INTERVAL=5
REMOTE_INTERVAL=5
SHOW_LOCAL=true
LOCAL_TEMP_TYPE=avg
SHOW_REMOTE=true
REMOTE_TEMP_TYPE=avg
EOF
fi
if command -v gnome-extensions >/dev/null 2>&1; then
  gnome-extensions enable "$UUID" || true
fi
exit 0
"""

    PRERM = r"""#!/bin/sh
set -e
if command -v gnome-extensions >/dev/null 2>&1; then
  gnome-extensions disable linux-temp@txh || true
fi
exit 0
"""

    control_gz = build_tar_gz([
        ("control", 0o100644, CONTROL.encode('utf-8')),
        ("postinst", 0o100755, POSTINST.encode('utf-8')),
        ("prerm",    0o100755, PRERM.encode('utf-8')),
    ])
    data_gz = build_tar_gz(data_files)
    deb_binary = b'2.0\n'

    blob = b'!<arch>\n'
    blob += ar_member('debian-binary', deb_binary)
    blob += ar_member('control.tar.gz', control_gz)
    blob += ar_member('data.tar.gz', data_gz)
    with open(OUT, 'wb') as f:
        f.write(blob)
    print("DEB 已生成:", OUT, len(blob), "字节")


if __name__ == '__main__':
    main()
