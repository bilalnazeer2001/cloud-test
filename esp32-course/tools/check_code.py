#!/usr/bin/env python3
"""Syntax-check every complete code listing in the course.

How it works (plain language):
  1. Reads every .md file in the course.
  2. Pulls out each code block marked cpp (Arduino) or c (ESP-IDF).
  3. A cpp block containing "void setup(" is treated as a full Arduino sketch.
     A c block containing "app_main(" is treated as a full ESP-IDF main file.
     A block whose first line is "// File: name.h" or "// File: name.c" is saved
     under that name so other blocks in the same lesson can #include it.
  4. Each full listing is passed to gcc/g++ with -fsyntax-only, using the small
     stand-in headers in tools/stubs/ instead of the real ESP32 libraries.

This catches typos, missing semicolons, undeclared names and wrong argument
counts. It is NOT a replacement for a real build with Arduino IDE / idf.py.

Run from anywhere:  python3 tools/check_code.py
"""
import pathlib, re, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
STUBS = ROOT / "tools" / "stubs"
BLOCK = re.compile(r"^```(cpp|c)\n(.*?)^```", re.S | re.M)
FILE_LINE = re.compile(r"^// File: (\S+)")

def main():
    ok = fail = snippets = 0
    for md in sorted(ROOT.rglob("*.md")):
        blocks = BLOCK.findall(md.read_text(encoding="utf-8"))
        if not blocks:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            tmp = pathlib.Path(tmp)
            jobs = []
            for i, (lang, code) in enumerate(blocks, 1):
                m = FILE_LINE.match(code)
                name = pathlib.Path(m.group(1)).name if m else None
                if name and name.endswith(".h"):
                    (tmp / name).write_text(code)
                    continue
                if lang == "cpp" and "void setup(" in code:
                    f = tmp / f"block{i}.cpp"
                    f.write_text("#include <Arduino.h>\n#line 1\n" + code)
                    jobs.append((i, ["g++", "-std=gnu++17", "-I", str(STUBS / "arduino")], f))
                elif lang == "c" and ("app_main(" in code or (name and name.endswith(".c"))):
                    f = tmp / f"block{i}.c"
                    f.write_text(code)
                    jobs.append((i, ["gcc", "-std=gnu17", "-I", str(STUBS / "idf"), "-include", "sdkconfig.h"], f))
                else:
                    snippets += 1
            for i, cmd, f in jobs:
                r = subprocess.run(cmd + ["-fsyntax-only", "-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-I", str(tmp), str(f)],
                                   capture_output=True, text=True)
                if r.returncode == 0:
                    ok += 1
                else:
                    fail += 1
                    print(f"FAIL {md.relative_to(ROOT)} (code block #{i})\n{r.stderr}")
    print(f"{ok} listings passed, {fail} failed, {snippets} short snippets not checked")
    sys.exit(1 if fail else 0)

if __name__ == "__main__":
    main()
