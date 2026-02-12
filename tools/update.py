"""Auto-update Sharp GUI from GitHub releases.

Usage:
    python update.py            # Update to latest stable release
    python update.py --pre      # Include pre-releases
    python update.py --check    # Check only, don't download

No GitHub API calls — uses redirect/HTML parsing to avoid rate limits.
"""
import os
import re
import shutil
import socket
import ssl
import sys
import tempfile
import urllib.request
import zipfile

REPO = "lueluelue12138/sharp-gui"
REPO_URL = f"https://github.com/{REPO}"
VERSION_FILE = "version.txt"
SERVER_PORT = 5050


def get_script_dir():
    return os.path.dirname(os.path.abspath(__file__))


def get_current_version():
    vf = os.path.join(get_script_dir(), VERSION_FILE)
    if os.path.exists(vf):
        return open(vf).read().strip()
    return "未知"


def _make_ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _urlopen(url, timeout=15):
    """Open URL with SSL fallback."""
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "sharp-gui-updater")
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except (urllib.error.URLError, ssl.SSLError):
        return urllib.request.urlopen(
            req, context=_make_ssl_context(), timeout=timeout
        )


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Capture redirect URL without following it."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.redirect_url = newurl
        return None  # don't follow


def fetch_latest_tag():
    """Get latest stable release tag via 302 redirect (no API, no rate limit).

    GET https://github.com/REPO/releases/latest
    → 302 → https://github.com/REPO/releases/tag/v1.0.2
    """
    handler = NoRedirect()
    opener = urllib.request.build_opener(handler)
    req = urllib.request.Request(f"{REPO_URL}/releases/latest")
    req.add_header("User-Agent", "sharp-gui-updater")

    try:
        opener.open(req, timeout=15)
    except (urllib.error.HTTPError, urllib.error.URLError):
        pass
    except Exception:
        pass

    # Also try with SSL disabled
    if not hasattr(handler, "redirect_url"):
        try:
            ssl_handler = urllib.request.HTTPSHandler(
                context=_make_ssl_context()
            )
            opener = urllib.request.build_opener(handler, ssl_handler)
            opener.open(req, timeout=15)
        except Exception:
            pass

    if hasattr(handler, "redirect_url"):
        # URL: https://github.com/REPO/releases/tag/v1.0.2
        tag = handler.redirect_url.rstrip("/").split("/")[-1]
        return tag

    raise RuntimeError("无法获取最新版本 (重定向失败)")


def fetch_latest_pre_tag():
    """Get latest release tag (including pre-releases) by parsing releases HTML.

    Scrapes https://github.com/REPO/releases with regex to find first tag.
    """
    try:
        resp = _urlopen(f"{REPO_URL}/releases")
        html = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        raise RuntimeError(f"无法获取发布页面: {e}")

    # GitHub release page has links like /releases/tag/v1.0.3-rc.1
    pattern = rf"/{re.escape(REPO)}/releases/tag/(v[^\"'&\s]+)"
    match = re.search(pattern, html)
    if match:
        return match.group(1)

    raise RuntimeError("无法解析最新版本")


def is_server_running():
    """Check if Sharp GUI server is running on the default port."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(("127.0.0.1", SERVER_PORT))
        sock.close()
        return result == 0
    except Exception:
        return False


def is_git_repo(path):
    """Check if the directory is a git clone (has .git/)."""
    return os.path.isdir(os.path.join(path, ".git"))


def parse_version(tag):
    """Parse version tag into comparable tuple.

    Examples:
        'v1.0.2'       → (1, 0, 2, None)    (stable)
        'v1.0.3-rc.1'  → (1, 0, 3, 'rc.1')  (pre-release)
    """
    tag = tag.lstrip("v")
    parts = tag.split("-", 1)
    base = parts[0]
    pre = parts[1] if len(parts) > 1 else None
    try:
        nums = tuple(int(x) for x in base.split("."))
    except ValueError:
        nums = (0, 0, 0)
    return nums, pre


def is_newer(latest_tag, current_tag):
    """Check if latest_tag is actually newer than current_tag.

    Handles pre-release comparison:
        v1.0.3       > v1.0.3-rc.1  (stable > pre-release of same version)
        v1.0.3       > v1.0.2       (newer base version)
        v1.0.3-rc.2  > v1.0.3-rc.1  (newer pre-release)
        v1.0.2       < v1.0.3-rc.1  (older base version, NOT newer)
    """
    latest_nums, latest_pre = parse_version(latest_tag)
    current_nums, current_pre = parse_version(current_tag)

    if latest_nums > current_nums:
        return True
    if latest_nums < current_nums:
        return False

    # Same base version: stable beats pre-release
    if latest_nums == current_nums:
        if latest_pre is None and current_pre is not None:
            return True   # v1.0.3 > v1.0.3-rc.1
        if latest_pre is not None and current_pre is None:
            return False  # v1.0.3-rc.1 < v1.0.3
        if latest_pre and current_pre:
            return latest_pre > current_pre  # rc.2 > rc.1

    return False


def download_with_progress(url, dest):
    """Download a file with progress bar and SSL fallback."""

    def reporthook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            pct = min(100, downloaded * 100 // total_size)
            mb = downloaded / (1024 * 1024)
            total_mb = total_size / (1024 * 1024)
            bar_len = 30
            filled = int(bar_len * pct / 100)
            bar = "█" * filled + "░" * (bar_len - filled)
            sys.stdout.write(
                f"\r  {bar} {mb:.1f}/{total_mb:.1f} MB ({pct}%)"
            )
        else:
            mb = downloaded / (1024 * 1024)
            sys.stdout.write(f"\r  下载中: {mb:.1f} MB")
        sys.stdout.flush()

    try:
        urllib.request.urlretrieve(url, dest, reporthook=reporthook)
    except (urllib.error.URLError, ssl.SSLError):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ctx)
        )
        urllib.request.install_opener(opener)
        urllib.request.urlretrieve(url, dest, reporthook=reporthook)

    print()


def extract_zip_overlay(zip_path, target_dir):
    """Extract zip contents over target directory, preserving unlisted files."""
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(target_dir)


def update_dependencies(script_dir):
    """Run pip install to catch any new dependencies."""
    if sys.platform == "win32":
        pip = os.path.join(script_dir, "venv", "Scripts", "pip.exe")
    else:
        pip = os.path.join(script_dir, "venv", "bin", "pip")

    if not os.path.exists(pip):
        print("  [跳过] 虚拟环境未找到，请运行 install 脚本")
        return

    req_file = os.path.join(script_dir, "ml-sharp", "requirements.txt")
    if os.path.exists(req_file):
        os.system(f'"{pip}" install -r "{req_file}" -q 2>{"nul" if sys.platform == "win32" else "/dev/null"}')

    os.system(f'"{pip}" install flask -q 2>{"nul" if sys.platform == "win32" else "/dev/null"}')


def main():
    include_pre = "--pre" in sys.argv
    check_only = "--check" in sys.argv
    script_dir = get_script_dir()

    print()
    print("=" * 50)
    print("  Sharp GUI 自动更新")
    print("=" * 50)
    print()

    # Check if this is a git clone
    if is_git_repo(script_dir):
        print("  [提示] 检测到 Git 仓库，建议直接使用 git 更新:")
        print()
        print("    git pull origin main")
        print()
        print("  此更新脚本适用于从 Release 包安装的用户")
        return 0

    # Check if server is running
    if is_server_running():
        print(f"  [警告] Sharp GUI 正在运行中 (端口 {SERVER_PORT})")
        print("  建议先关闭服务再更新")
        try:
            confirm = input("  是否继续? [y/N] ").strip()
        except EOFError:
            confirm = "n"
        if confirm.lower() != "y":
            print("  已取消，请先关闭服务后再更新")
            return 0
        print()

    # Current version
    current = get_current_version()
    print(f"  当前版本: {current}")

    # Fetch latest tag (no API, no rate limit)
    mode = "最新版本 (含预发布)" if include_pre else "最新稳定版"
    print(f"  正在检查{mode}...")
    print()

    try:
        if include_pre:
            tag = fetch_latest_pre_tag()
        else:
            tag = fetch_latest_tag()
    except Exception as e:
        print(f"[错误] 无法检查更新: {e}")
        return 1

    is_pre = "-" in tag  # v1.0.3-rc.1 contains '-'
    pre_label = " (pre-release)" if is_pre else ""
    print(f"  最新版本: {tag}{pre_label}")

    if current == tag:
        print()
        print("[OK] 已是最新版本，无需更新")
        return 0

    # Version comparison: avoid downgrading
    if current != "未知" and not is_newer(tag, current):
        print()
        print(f"[OK] 当前版本 ({current}) 已经是最新或更新")
        if not include_pre:
            print("  提示: 使用 --pre 可检查预发布版本")
        return 0

    # Construct download URL directly (no API needed)
    zip_name = f"sharp-gui-{tag}.zip"
    zip_url = f"{REPO_URL}/releases/download/{tag}/{zip_name}"

    print(f"  发布包: {zip_name}")
    print()

    if check_only:
        print(f"  有新版本可用: {current} → {tag}")
        print("  运行 update 脚本(不带 --check)即可更新")
        return 0

    # Confirm
    try:
        confirm = input(f"  是否更新 {current} → {tag}? [Y/n] ").strip()
    except EOFError:
        confirm = "y"
    if confirm.lower() == "n":
        print("  已取消")
        return 0

    # Download to temp
    print()
    print("  正在下载...")
    tmp_dir = tempfile.mkdtemp(prefix="sharp-gui-update-")
    zip_path = os.path.join(tmp_dir, zip_name)

    try:
        download_with_progress(zip_url, zip_path)
    except Exception as e:
        print(f"[错误] 下载失败: {e}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return 1

    # Extract overlay
    print("  正在解压覆盖...")
    try:
        extract_zip_overlay(zip_path, script_dir)
        print("  [OK] 文件更新完成")
    except Exception as e:
        print(f"[错误] 解压失败: {e}")
        print()
        print("  自动覆盖失败，请手动更新:")
        print(f"  1. 下载: {zip_url}")
        print(f"  2. 解压覆盖到当前目录: {script_dir}")
        # Keep the downloaded file for manual use if possible
        manual_path = os.path.join(script_dir, zip_name)
        try:
            shutil.copy2(zip_path, manual_path)
            print(f"  (已保存到 {manual_path}，可直接解压)")
        except Exception:
            pass
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return 1

    # Write version
    with open(os.path.join(script_dir, VERSION_FILE), "w") as f:
        f.write(tag + "\n")

    # Cleanup temp
    shutil.rmtree(tmp_dir, ignore_errors=True)

    # Update dependencies
    print()
    print("  正在检查依赖更新...")
    update_dependencies(script_dir)
    print("  [OK] 依赖检查完成")

    # Done
    print()
    print("=" * 50)
    print(f"  ✅ 更新完成!  {current} → {tag}")
    print("=" * 50)
    print()
    print("  运行 run.bat (Windows) 或 ./run.sh (macOS/Linux) 启动")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

