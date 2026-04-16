# Ultravisor Beacon Tool Setup

This guide covers installing the media processing tools on the machine running the Ultravisor beacon worker. Each tool enables a specific set of capabilities in retold-remote.

## ffmpeg & ffprobe

Used for video thumbnails, frame extraction, audio waveform generation, and media metadata probing.

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install ffmpeg
```

Both `ffmpeg` and `ffprobe` are included in the same package.

### macOS

```bash
brew install ffmpeg
```

### Windows

1. Download a release build from [gyan.dev/ffmpeg](https://www.gyan.dev/ffmpeg/builds/) -- choose the **ffmpeg-release-full** zip.
2. Extract to a permanent location, e.g. `C:\ffmpeg`.
3. Add `C:\ffmpeg\bin` to the system PATH:
   - Open **Settings -> System -> About -> Advanced system settings -> Environment Variables**.
   - Edit the **Path** variable under System variables and add `C:\ffmpeg\bin`.
4. Open a new terminal and verify:

```cmd
ffmpeg -version
ffprobe -version
```

## ImageMagick

Used as a fallback for image thumbnails and for image format conversion.

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install imagemagick
```

By default ImageMagick restricts some operations via a security policy. If you encounter permission errors processing certain formats, edit `/etc/ImageMagick-6/policy.xml` (or the ImageMagick-7 equivalent) and adjust the relevant policy lines.

### macOS

```bash
brew install imagemagick
```

### Windows

1. Download the installer from [imagemagick.org/script/download.php](https://imagemagick.org/script/download.php) -- choose the **Win64 dynamic** installer.
2. During installation, check **Add application directory to your system path** and **Install legacy utilities (e.g. convert)**.
3. Open a new terminal and verify:

```cmd
magick --version
```

On Windows, use `magick convert` instead of bare `convert` to avoid conflicts with the built-in Windows `convert` command.

## dcraw

Used for converting raw camera images (CR2, NEF, ARW, DNG, ORF, RW2, etc.).

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install dcraw
```

### macOS

```bash
brew install dcraw
```

### Windows

1. Download the precompiled binary from [dechifro.org/dcraw](https://www.dechifro.org/dcraw/) or build from source.
2. Place `dcraw.exe` in a directory on your PATH, e.g. `C:\tools`.
3. Add that directory to the system PATH if it is not already present.
4. Verify:

```cmd
dcraw
```

dcraw prints usage information when run without arguments.

## audiowaveform

Used for generating audio waveform peak data displayed in the audio viewer.

### Ubuntu / Debian

```bash
sudo add-apt-repository ppa:chris-needham/ppa
sudo apt update
sudo apt install audiowaveform
```

If the PPA is not available for your Ubuntu version, build from source:

```bash
sudo apt install cmake libmad0-dev libid3tag0-dev libsndfile1-dev \
  libgd-dev libboost-filesystem-dev libboost-program-options-dev \
  libboost-regex-dev
git clone https://github.com/bbc/audiowaveform.git
cd audiowaveform
mkdir build && cd build
cmake ..
make
sudo make install
```

### macOS

```bash
brew install audiowaveform
```

If the formula is not in the default tap:

```bash
brew tap bbc/audiowaveform
brew install audiowaveform
```

### Windows

audiowaveform does not provide official Windows binaries. Options:

1. **WSL** (recommended) -- install Ubuntu via WSL and follow the Ubuntu instructions above. Run the beacon worker inside WSL.
2. **Build from source** -- requires CMake, Visual Studio, and the Boost, libmad, libsndfile, and libgd libraries. See the [audiowaveform GitHub repo](https://github.com/bbc/audiowaveform) for build instructions.

## ebook-convert (Calibre)

Used for converting MOBI and AZW ebooks to EPUB format for the in-browser reader.

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install calibre
```

This installs the full Calibre suite. Only `ebook-convert` is used by the beacon.

### macOS

```bash
brew install --cask calibre
```

After installation, the `ebook-convert` command-line tool is at:

```
/Applications/calibre.app/Contents/MacOS/ebook-convert
```

Add it to your PATH or create a symlink:

```bash
sudo ln -s /Applications/calibre.app/Contents/MacOS/ebook-convert /usr/local/bin/ebook-convert
```

### Windows

1. Download and install Calibre from [calibre-ebook.com/download_windows](https://calibre-ebook.com/download_windows).
2. The default install path is `C:\Program Files\Calibre2`.
3. Add `C:\Program Files\Calibre2` to the system PATH.
4. Verify:

```cmd
ebook-convert --version
```

## Verifying the Beacon

After installing tools, start the beacon and check its reported capabilities. The Ultravisor server exposes `GET /Beacon/Capabilities` which lists the aggregate capabilities of all connected beacons.

You can also verify each tool individually:

```bash
ffmpeg -version
ffprobe -version
convert --version      # ImageMagick (use 'magick --version' on Windows)
dcraw                  # prints usage
audiowaveform --help
ebook-convert --version
```

retold-remote only dispatches commands for tools the beacon has available. Missing tools simply mean those operations fall back to local processing on the NAS.

## Quick Reference

| Tool | Ubuntu | macOS | Windows |
|------|--------|-------|---------|
| ffmpeg / ffprobe | `apt install ffmpeg` | `brew install ffmpeg` | Download from gyan.dev, add to PATH |
| ImageMagick | `apt install imagemagick` | `brew install imagemagick` | Installer from imagemagick.org |
| dcraw | `apt install dcraw` | `brew install dcraw` | Download binary, add to PATH |
| audiowaveform | PPA or build from source | `brew install audiowaveform` | WSL or build from source |
| ebook-convert | `apt install calibre` | `brew install --cask calibre` + symlink | Calibre installer, add to PATH |
