# Vosk Setup Guide

This guide provides detailed instructions for setting up Vosk speech recognition in EchoAssist.

## Prerequisites

- Python 3.8 or newer
- pip (Python package installer)
- A working microphone
- Disk space depending on model size (see below)

## Installation Steps

### 1. Install Python Dependencies

```bash
# Install Vosk
pip install vosk

# Install sounddevice for audio capture
pip install sounddevice

# Install requests (used for model download)
pip install requests
```

### 2. Available Models

EchoAssist supports three Vosk model sizes:

| Model Size | Name | Disk Space | Description |
|------------|------|------------|-------------|
| **Small** | `vosk-model-small-en-us-0.15` | ~50 MB | Fast but less accurate |
| **Medium** | `vosk-model-en-us-0.22-lgraph` | ~500 MB | Good balance of speed and accuracy |
| **Large** | `vosk-model-en-us-0.22` | ~1.8 GB | Most accurate but slower |

### 3. Model Download/Installation

#### For Development (Local Models)

Pre-downloaded models are available in the `models/` folder as zip files:
- `vosk-model-small-en-us-0.15.zip`
- `vosk-model-en-us-0.22-lgraph.zip`
- `vosk-model-en-us-0.22.zip`

When running in development mode, the app will automatically extract these local models instead of downloading them.

#### For Production (Auto-Download)

When you first run EchoAssist in production mode, it will automatically download the selected model from:
- **Large**: https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip
- **Medium**: https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip
- **Small**: https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip

The default model is `large` for maximum accuracy.

## Troubleshooting

### Common Issues

#### 1. No Microphone Access

**Symptoms:**
- No transcription appears
- Error messages about audio device

**Solutions:**
- Check if your microphone is properly connected
- Verify microphone permissions in your OS settings
- Try selecting a different audio input device

#### 2. Model Download Fails

**Symptoms:**
- Error during first launch
- Missing model files

**Solutions:**
- Check your internet connection
- Manually download the model (see Manual Model Installation below)
- Verify you have enough disk space

#### 3. Performance Issues

**Symptoms:**
- Delayed transcription
- High CPU usage

**Solutions:**
- Close other CPU-intensive applications
- Consider using a smaller model
- Ensure your Python installation matches your system architecture (32/64 bit)

### Manual Model Installation

If the automatic model download fails, you can install it manually:

1. Create a directory: `models`
2. Download the model from: https://alphacephei.com/vosk/models
3. Select `vosk-model-small-en-us-0.15` (recommended)
4. Extract the downloaded archive into the models directory
5. Verify the path structure matches: `models/vosk-model-small-en-us-0.15/`

## Advanced Configuration

### Selecting Different Models

You can change the model size through the application settings. The app supports three model sizes:

| Size | Speed | Accuracy | Best For |
|------|-------|----------|----------|
| Small | Fastest | Lower | Quick tests, low-resource systems |
| Medium | Balanced | Good | General use, recommended |
| Large | Slower | Highest | Professional meetings, accuracy-critical |

#### Via Settings UI
1. Open Settings in the app
2. Navigate to Voice Settings
3. Select your preferred model size
4. The model will be extracted (dev) or downloaded (production) if not already installed

#### Via Command Line (for testing)
```bash
python vosk_live.py --model-size small
python vosk_live.py --model-size medium
python vosk_live.py --model-size large

# Development mode with local models
python vosk_live.py --model-size medium --dev --models-dir ./models
```

### Audio Device Selection

By default, the system's default microphone is used. To use a different audio device:

1. List available devices:
```python
import sounddevice as sd
print(sd.query_devices())
```

2. Note the device index you want to use
3. Update the device settings in your configuration

## System-Specific Notes

### Windows
- Ensure Microsoft Visual C++ Redistributable is installed
- Use Python 3.8+ 64-bit version
- Check Windows Security for microphone permissions

### macOS
- Grant microphone permissions in System Preferences
- Install Python through Homebrew for best compatibility

### Linux
- Install PortAudio development package:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install portaudio19-dev
  
  # Fedora
  sudo dnf install portaudio-devel
  ```
- Ensure your user has audio device permissions

## Additional Resources

- [Vosk API Documentation](https://alphacephei.com/vosk/api)
- [Vosk Models Repository](https://alphacephei.com/vosk/models)
- [sounddevice Documentation](https://python-sounddevice.readthedocs.io/)

## Support

If you encounter any issues not covered in this guide:
1. Check the [GitHub Issues](https://github.com/yourusername/echo-assist/issues)
2. Create a new issue with:
   - Your system information
   - Error messages
   - Steps to reproduce the problem
