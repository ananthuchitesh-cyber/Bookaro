#!/usr/bin/env python3
import argparse
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Extract TravelApp.zip and build the compiled travel JSON dataset.")
    parser.add_argument("--zip-file", default=r"d:\TravelApp.zip")
    parser.add_argument("--out", default="db/compiled/india-travel-data.json")
    args = parser.parse_args()

    zip_path = Path(args.zip_file).resolve()
    if not zip_path.exists():
        raise FileNotFoundError(f"Zip file not found: {zip_path}")

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    builder_script = Path(__file__).resolve().with_name("build_travel_data_json.py")

    with tempfile.TemporaryDirectory(prefix="travelapp_zip_") as temp_dir:
        extract_root = Path(temp_dir)
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(extract_root)

        source_dir = extract_root / "TravelApp"
        if not source_dir.exists():
            candidates = [p for p in extract_root.iterdir() if p.is_dir()]
            if len(candidates) == 1:
                source_dir = candidates[0]

        if not source_dir.exists():
            raise FileNotFoundError("Could not find the extracted TravelApp folder inside the zip file.")

        subprocess.run(
            [sys.executable, str(builder_script), "--source-dir", str(source_dir), "--out", str(out_path)],
            check=True,
        )

    print(f"Built compiled travel dataset at {out_path}")


if __name__ == "__main__":
    main()
