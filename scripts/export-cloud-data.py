import hashlib
import json
import sys
import zipfile
from pathlib import Path


def export(destination):
    root = Path(__file__).resolve().parent.parent
    folders = ('data/feedback', 'data/solutions', 'data/generated', 'runs', 'archives/cloud-migration')
    excluded = ('runs/codex-reliability-', 'runs/codex-stall-', 'runs/cloud-migration-20261011/')
    files = sorted(file for folder in folders for file in (root / folder).rglob('*') if file.is_file())
    manifest = {'metadata': {'purpose': '云端私人资料快照；源码另行提交 Git'}, 'files': []}
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # 新包独立保存，已有导出包和原始资料均不覆盖。
    with zipfile.ZipFile(destination, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in files:
            relative = file.relative_to(root).as_posix()
            if relative.startswith(excluded) or '__pycache__' in file.parts:
                continue
            content = file.read_bytes()
            archive.writestr(relative, content)
            manifest['files'].append({'path': relative, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
        archive.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError('导出包校验失败，请保留原件并重新导出到新文件')
    print(json.dumps({'file': str(destination), 'files': len(manifest['files']), 'bytes': destination.stat().st_size,
                      'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('用法：python3 scripts/export-cloud-data.py <新资料包路径.zip>')
    try:
        export(sys.argv[1])
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        raise SystemExit('导出失败：' + str(error))
