"""Normalize ZIP filename encoding without changing signed app files or Unix metadata."""

import copy
import hashlib
import pathlib
import sys
import tempfile
import zipfile


def normalize(filename):
    package = pathlib.Path(filename).resolve()
    with zipfile.ZipFile(package, metadata_encoding="utf-8") as original:
        entries = original.infolist()
        if all(entry.flag_bits & 0x800 or entry.filename.isascii() for entry in entries):
            print(f"Already UTF-8 compatible: {package.name}")
            return
        # Some 7-Zip builds write UTF-8 names without the ZIP language-encoding flag.
        with tempfile.NamedTemporaryFile(dir=package.parent, suffix=".zip", delete=False) as temp:
            temporary = pathlib.Path(temp.name)
        try:
            hashes = []
            with zipfile.ZipFile(temporary, "w") as fixed:
                fixed.comment = original.comment
                for entry in entries:
                    data = original.read(entry)
                    hashes.append(hashlib.sha256(data).digest())
                    fixed.writestr(copy.copy(entry), data)
            with zipfile.ZipFile(temporary) as fixed:
                assert fixed.namelist() == original.namelist(), "Filename decoding changed"
                for entry, repaired, digest in zip(entries, fixed.infolist(), hashes, strict=True):
                    assert repaired.external_attr == entry.external_attr, "Unix permissions changed"
                    assert repaired.create_system == entry.create_system, "Platform metadata changed"
                    assert repaired.flag_bits & 0x800 or repaired.filename.isascii()
                    assert hashlib.sha256(fixed.read(repaired)).digest() == digest, "App content changed"
            original.close()
            temporary.replace(package)
        finally:
            temporary.unlink(missing_ok=True)
    print(f"Verified UTF-8 filenames, original file contents and Unix permissions: {package.name}")


if __name__ == "__main__":
    for filename in sys.argv[1:]:
        normalize(filename)
