import hashlib
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath


def restore(archive_file):
    root = Path(__file__).resolve().parent.parent
    with zipfile.ZipFile(archive_file) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        records = manifest['files']
        names = [record['path'] for record in records]
        archived_names = archive.namelist()
        if len(set(names)) != len(names) or len(set(archived_names)) != len(archived_names) or set(archived_names) != set(names) | {'manifest.json'}:
            raise ValueError('资料包存在重复路径或未列入清单的文件')
        targets = []
        # 先完整校验所有内容和目标，再写入；已有不同内容绝不覆盖。
        for record in records:
            relative = PurePosixPath(record['path'])
            if str(relative) != record['path'] or relative.is_absolute() or '..' in relative.parts or '\\' in record['path'] or ':' in record['path']:
                raise ValueError('资料路径无效')
            if not relative.parts or relative.parts[0] not in ('data', 'runs', 'archives'):
                raise ValueError('资料包不能修改源代码或 Git 配置')
            target = root.joinpath(*relative.parts)
            target.resolve().relative_to(root)
            if any(parent.exists() and not parent.is_dir() for parent in target.parents if parent != root):
                raise ValueError('目标目录被文件占用：' + record['path'])
            content = archive.read(record['path'])
            if len(content) != record['bytes'] or hashlib.sha256(content).hexdigest() != record['sha256']:
                raise ValueError('资料内容校验失败：' + record['path'])
            if target.exists() and (not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != record['sha256']):
                raise ValueError('目标已有不同资料，拒绝覆盖：' + record['path'])
            targets.append((record, target))
        restored = 0
        for record, target in targets:
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as stream:
                    stream.write(archive.read(record['path']))
                restored += 1
        print(json.dumps({'checked': len(records), 'restored': restored, 'existingUnchanged': len(records) - restored}, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('用法：python3 scripts/restore-cloud-data.py <cloud-data.zip>')
    try:
        restore(sys.argv[1])
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        raise SystemExit('恢复失败：' + str(error))
