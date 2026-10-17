"""Compare a served web build with the local compiled artifact."""

import argparse
import hashlib
import json
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--dist", type=Path, default=Path("frontend/dist"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not (args.dist / "index.html").is_file():
        parser.error("The compiled build must contain index.html")
    files = []
    for path in sorted(item for item in args.dist.rglob("*") if item.is_file()):
        relative = path.relative_to(args.dist).as_posix()
        expected = hashlib.sha256(path.read_bytes()).hexdigest()
        try:
            with urlopen(f"{args.url.rstrip('/')}/{relative}", timeout=15) as response:
                actual = hashlib.sha256(response.read()).hexdigest()
            files.append({"path": relative, "expected": expected, "actual": actual})
        except (URLError, TimeoutError) as error:
            files.append({"path": relative, "expected": expected, "error": str(error)})
    passed = all(item.get("actual") == item["expected"] for item in files)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x") as output:
        json.dump({"url": args.url, "passed": passed, "files": files}, output, indent=2)
        output.write("\n")
    print(json.dumps({"passed": passed, "files": len(files), "output": str(args.output)}))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
