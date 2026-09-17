#!/usr/bin/env python3
# transcribe.py - 转录稿生成(CI 专用, 本地无依赖时自动跳过)
# 流程: 读 transcript-queue.json -> ffmpeg 提音频 -> faster-whisper(base, int8) 中文转写
#       -> 写回 videos-auto.json 的 transcript 字段并重生成 videos-auto.js
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "site", "data")
QUEUE = os.path.join(DATA, "transcript-queue.json")
AUTO_JSON = os.path.join(DATA, "videos-auto.json")
AUTO_JS = os.path.join(DATA, "videos-auto.js")

MAX_VIDEOS = 8          # 单轮最多转录条数(控制 CI 时长)
MAX_DURATION = 1200     # 超过 20 分钟的视频跳过
MODEL = os.environ.get("WHISPER_MODEL", "base")


def log(msg):
    print(f"[transcribe] {msg}", flush=True)


def have(cmd):
    try:
        subprocess.run([cmd, "-version"], capture_output=True, check=False)
        return True
    except FileNotFoundError:
        return False


def ffprobe_duration(wav):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", wav],
            capture_output=True, text=True, check=False)
        return float(out.stdout.strip() or 0)
    except Exception:
        return 0


def main():
    # 依赖缺失 -> 安静跳过(不拖垮整个抓取任务)
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        log("faster-whisper 未安装, 跳过转录。")
        return
    if not have("ffmpeg"):
        log("ffmpeg 未安装, 跳过转录。")
        return
    if not os.path.exists(QUEUE):
        log("无转录队列, 跳过。")
        return
    with open(QUEUE, "r", encoding="utf-8") as f:
        queue = json.load(f)
    if not queue:
        log("转录队列为空。")
        return
    if not os.path.exists(AUTO_JSON):
        log("无 videos-auto.json, 跳过。")
        return

    with open(AUTO_JSON, "r", encoding="utf-8") as f:
        store = json.load(f)
    by_id = {str(v.get("id")): v for v in store if v.get("id")}

    log(f"加载模型 {MODEL} (int8, CPU)...")
    model = WhisperModel(MODEL, device="cpu", compute_type="int8")

    done = 0
    for item in queue[:MAX_VIDEOS]:
        vid = str(item.get("id", ""))
        url = item.get("url", "")
        rec = by_id.get(vid)
        if not vid or not url or not rec or rec.get("transcript"):
            continue
        with tempfile.TemporaryDirectory() as td:
            wav = os.path.join(td, "a.wav")
            log(f"下载并提取音频 {vid} ...")
            r = subprocess.run(
                ["ffmpeg", "-y", "-nostdin", "-loglevel", "error",
                 "-user_agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                 "-i", url, "-vn", "-ac", "1", "-ar", "16000", wav],
                capture_output=True, check=False)
            if r.returncode != 0 or not os.path.exists(wav):
                log(f"  音频下载失败(直链可能过期), 下轮重试: {r.stderr.decode('utf-8','ignore')[:120]}")
                continue
            dur = ffprobe_duration(wav)
            if dur > MAX_DURATION:
                log(f"  时长 {int(dur)}s 超上限, 跳过。")
                continue
            log(f"  转写中(时长 {int(dur)}s)...")
            segments, info = model.transcribe(wav, language="zh", vad_filter=True,
                                              vad_parameters=dict(min_silence_duration_ms=500))
            text = "".join(seg.text.strip() for seg in segments).strip()
            if not text:
                log("  转写结果为空。")
                continue
            rec["transcript"] = text
            rec["transcriptAt"] = __import__("datetime").date.today().isoformat()
            done += 1
            log(f"  完成 {len(text)} 字。")

    if done:
        with open(AUTO_JSON, "w", encoding="utf-8") as f:
            json.dump(store, f, ensure_ascii=False, indent=1)
        js = ("// videos-auto.js - 自动抓取的新视频(由 scraper/scrape-auto.js 生成, 勿手改)\n"
              "window.MOXING_VIDEOS = window.MOXING_VIDEOS.concat("
              + json.dumps(store, ensure_ascii=False) + ");\n")
        with open(AUTO_JS, "w", encoding="utf-8") as f:
            f.write(js)
    # 队列消费完即清空(直链有时效, 下轮 scraper 会重建)
    with open(QUEUE, "w", encoding="utf-8") as f:
        json.dump([], f)
    log(f"本轮转录 {done} 条, 队列已清空。")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"转录流程异常(不影响抓取数据): {e}")
        sys.exit(0)
