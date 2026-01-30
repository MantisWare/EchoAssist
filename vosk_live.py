#!/usr/bin/env python3
"""
Live Speech-to-Text using Vosk for Electron App
Streams results to stdout as JSON for real-time display
Model loads once and stays in memory - supports pause/resume

Supports three model sizes:
- small: vosk-model-small-en-us-0.15 (~50MB) - Fast but less accurate
- medium: vosk-model-en-us-0.22-lgraph (~500MB) - Good balance
- large: vosk-model-en-us-0.22 (~1.8GB) - Most accurate

Optional speaker detection using vosk-model-spk-0.4 (~13MB)

Usage:
  python vosk_live.py [--model-size small|medium|large] [--dev] [--models-dir /path/to/models]

In development mode (--dev), models are loaded from the local models/ folder.
In production mode, models are downloaded from the internet if not present.
"""

import sounddevice as sd
import queue
import json
import sys
import os
import zipfile
import requests
import argparse
import numpy as np
from pathlib import Path
from vosk import Model, KaldiRecognizer

# Try to import SpkModel for speaker detection
try:
    from vosk import SpkModel
    SPK_MODEL_AVAILABLE = True
except ImportError:
    SPK_MODEL_AVAILABLE = False

# Model configurations
MODELS = {
    'small': {
        'name': 'vosk-model-small-en-us-0.15',
        'url': 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
        'size_desc': '~50MB',
        'description': 'Fast but less accurate'
    },
    'medium': {
        'name': 'vosk-model-en-us-0.22-lgraph',
        'url': 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip',
        'size_desc': '~500MB',
        'description': 'Good balance of speed and accuracy'
    },
    'large': {
        'name': 'vosk-model-en-us-0.22',
        'url': 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip',
        'size_desc': '~1.8GB',
        'description': 'Most accurate but slower'
    }
}

# Speaker model configuration (optional, for speaker change detection)
SPEAKER_MODEL = {
    'name': 'vosk-model-spk-0.4',
    'url': 'https://alphacephei.com/vosk/models/vosk-model-spk-0.4.zip',
    'size_desc': '~13MB',
    'description': 'Speaker identification using X-vectors'
}


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Vosk Live Transcriber')
    parser.add_argument(
        '--model-size',
        choices=['small', 'medium', 'large'],
        default='large',
        help='Model size to use (default: large)'
    )
    parser.add_argument(
        '--dev',
        action='store_true',
        help='Development mode - use local models from models/ folder'
    )
    parser.add_argument(
        '--models-dir',
        type=str,
        default=None,
        help='Path to local models directory (for development)'
    )
    return parser.parse_args()


class VoskLiveTranscriber:
    def __init__(self, model_size='large', is_dev=False, models_dir=None):
        """Initialize Vosk with the specified model size
        
        Args:
            model_size: 'small', 'medium', or 'large'
            is_dev: If True, use local models from models_dir
            models_dir: Path to local models directory (for dev mode)
        """
        
        # Get model configuration
        if model_size not in MODELS:
            self.send_error(f"Invalid model size: {model_size}. Use 'small', 'medium', or 'large'.")
            sys.exit(1)
        
        model_config = MODELS[model_size]
        self.model_name = model_config['name']
        self.model_url = model_config['url']
        self.model_size = model_size
        self.is_dev = is_dev
        
        # Set up paths based on mode
        if is_dev and models_dir is not None:
            # Development mode: use local models folder
            self.local_models_dir = Path(models_dir)
            self.model_dir = Path.home() / ".vosk_models"  # Still extract to home dir for consistency
        else:
            # Production mode: use home directory
            self.local_models_dir = None
            self.model_dir = Path.home() / ".vosk_models"
        
        self.model_path = self.model_dir / self.model_name
        
        # Speaker model settings
        self.spk_model = None
        self.last_speaker_vector = None
        self.speaker_threshold = 0.4  # Cosine distance threshold for speaker change
        
        # Ensure model directory exists
        self.model_dir.mkdir(parents=True, exist_ok=True)

        # Load model (download/extract if needed)
        if not self.model_path.exists():
            if is_dev and self.local_models_dir is not None:
                # In dev mode, try to extract from local zip files first
                self.send_status("loading", f"Looking for local {model_size} model...")
                if not self.extract_local_model():
                    self.send_error(f"Local model zip not found at {self.local_models_dir}. Please ensure the model zip files are present.")
                    sys.exit(1)
            else:
                # In production mode, download from URL
                self.send_status("downloading", f"Downloading Vosk {model_size} model ({model_config['size_desc']})...")
                self.download_model()

        self.send_status("loading", f"Loading Vosk {model_size} model...")
        self.model = Model(str(self.model_path))
        self.sample_rate = 16000
        self.recognizer = KaldiRecognizer(self.model, self.sample_rate)
        self.recognizer.SetWords(True)  # Get word-level timestamps
        
        # Try to load speaker model if available
        self._load_speaker_model()
        
        self.audio_queue = queue.Queue()
        self.is_listening = False
        self.should_exit = False
        self.stream = None
        
        status_msg = f"Vosk ready! (using {model_size} model"
        if self.spk_model:
            status_msg += ", speaker detection enabled"
        status_msg += ")"
        self.send_status("ready", status_msg)
    
    def _load_speaker_model(self):
        """Try to load the speaker model for speaker change detection"""
        if not SPK_MODEL_AVAILABLE:
            return
        
        spk_model_path = self.model_dir / SPEAKER_MODEL['name']
        
        if not spk_model_path.exists():
            # Also check for local zip in dev mode
            if self.is_dev and self.local_models_dir is not None:
                local_zip = self.local_models_dir / f"{SPEAKER_MODEL['name']}.zip"
                if local_zip.exists():
                    try:
                        self.send_status("loading", "Extracting local speaker model...")
                        with zipfile.ZipFile(local_zip, 'r') as zip_ref:
                            zip_ref.extractall(self.model_dir)
                    except Exception as e:
                        self.send_status("warning", f"Failed to extract speaker model: {e}")
                        return
        
        if spk_model_path.exists():
            try:
                self.send_status("loading", "Loading speaker detection model...")
                self.spk_model = SpkModel(str(spk_model_path))
                self.recognizer.SetSpkModel(self.spk_model)
                self.send_status("ready", "Speaker detection enabled")
            except Exception as e:
                self.send_status("warning", f"Failed to load speaker model: {e}")
                self.spk_model = None
    
    def _cosine_distance(self, v1, v2):
        """Calculate cosine distance between two vectors
        
        Returns:
            float: Cosine distance (0 = identical, 1 = orthogonal, 2 = opposite)
        """
        v1 = np.array(v1)
        v2 = np.array(v2)
        
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 1.0  # Cannot compare
        
        return 1.0 - np.dot(v1, v2) / (norm1 * norm2)
    
    def _detect_speaker_change(self, spk_vector):
        """Detect if the current speaker is different from the last one
        
        Args:
            spk_vector: X-vector from the current utterance
            
        Returns:
            bool: True if speaker changed, False otherwise
        """
        if spk_vector is None:
            return False
        
        if self.last_speaker_vector is None:
            # First utterance - set as reference
            self.last_speaker_vector = spk_vector
            return True  # Consider first speaker as "new"
        
        distance = self._cosine_distance(self.last_speaker_vector, spk_vector)
        
        if distance > self.speaker_threshold:
            # Speaker changed - update reference
            self.last_speaker_vector = spk_vector
            return True
        
        return False

    def send_status(self, status, message):
        """Send status update to Electron"""
        output = {
            "type": "status",
            "status": status,
            "message": message
        }
        print(json.dumps(output), flush=True)

    def send_partial(self, text):
        """Send partial (interim) result"""
        output = {
            "type": "partial",
            "text": text
        }
        print(json.dumps(output), flush=True)

    def send_final(self, text, speaker_changed=False):
        """Send final result with optional speaker change flag"""
        output = {
            "type": "final",
            "text": text,
            "speaker_changed": speaker_changed
        }
        print(json.dumps(output), flush=True)

    def send_error(self, error):
        """Send error message"""
        output = {
            "type": "error",
            "error": str(error)
        }
        print(json.dumps(output), flush=True)

    def extract_local_model(self):
        """Extract model from local zip file (development mode)
        
        Returns:
            bool: True if extraction succeeded, False if zip not found
        """
        if self.local_models_dir is None:
            return False
        
        # Look for the zip file in the local models directory
        zip_filename = f"{self.model_name}.zip"
        zip_path = self.local_models_dir / zip_filename
        
        if not zip_path.exists():
            self.send_status("error", f"Local model zip not found: {zip_path}")
            return False
        
        try:
            self.send_status("extracting", f"Extracting local {self.model_size} model...")
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Get total size for progress
                total_size = sum(info.file_size for info in zip_ref.infolist())
                extracted_size = 0
                
                for member in zip_ref.infolist():
                    zip_ref.extract(member, self.model_dir)
                    extracted_size += member.file_size
                    
                    if total_size > 0:
                        percent = (extracted_size / total_size) * 100
                        self.send_status("extracting", f"Extracting: {percent:.1f}%")
            
            self.send_status("ready", f"Local {self.model_size} model ready!")
            return True
            
        except Exception as e:
            self.send_error(f"Extraction failed: {e}")
            return False

    def download_model(self):
        """Download and extract Vosk model from the internet (production mode)"""
        try:
            zip_path = self.model_dir / f"{self.model_name}.zip"

            # Download with progress
            response = requests.get(self.model_url, stream=True)
            response.raise_for_status()

            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0

            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = (downloaded / total_size) * 100
                            self.send_status("downloading", f"Downloading: {percent:.1f}%")

            self.send_status("extracting", "Extracting model...")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(self.model_dir)

            zip_path.unlink()
            self.send_status("ready", "Model ready!")

        except Exception as e:
            self.send_error(f"Download failed: {e}")
            sys.exit(1)

    def audio_callback(self, indata, frames, time_info, status):
        """Callback for audio stream - only process if listening"""
        if status:
            self.send_error(f"Audio error: {status}")
        if self.is_listening:
            self.audio_queue.put(bytes(indata))

    def start_listening(self):
        """Start listening (audio capture)"""
        if self.is_listening:
            return

        self.is_listening = True
        # Clear the recognizer state
        self.recognizer = KaldiRecognizer(self.model, self.sample_rate)
        self.recognizer.SetWords(True)

        self.send_status("listening", "Listening...")

    def stop_listening(self):
        """Stop listening (pause audio processing)"""
        if not self.is_listening:
            return

        self.is_listening = False

        # Get final result before stopping
        try:
            final_result = json.loads(self.recognizer.FinalResult())
            text = final_result.get('text', '').strip()
            if text:
                self.send_final(text)
        except:
            pass

        self.send_status("stopped", "Stopped listening")

    def run(self):
        """Main loop - keeps model in memory, processes commands"""
        try:
            # Start audio stream (always running, but only process when is_listening=True)
            self.stream = sd.RawInputStream(
                samplerate=self.sample_rate,
                blocksize=8000,
                dtype='int16',
                channels=1,
                callback=self.audio_callback
            )

            with self.stream:
                # Auto-start listening
                self.start_listening()

                while not self.should_exit:
                    # Process audio queue
                    try:
                        data = self.audio_queue.get(timeout=0.1)

                        if self.recognizer.AcceptWaveform(data):
                            # Final result
                            result = json.loads(self.recognizer.Result())
                            text = result.get('text', '').strip()
                            
                            if text:
                                # Check for speaker change if speaker model is loaded
                                speaker_changed = False
                                if self.spk_model is not None:
                                    spk_vector = result.get('spk')
                                    if spk_vector is not None:
                                        speaker_changed = self._detect_speaker_change(spk_vector)
                                
                                self.send_final(text, speaker_changed)
                        else:
                            # Partial result (real-time)
                            result = json.loads(self.recognizer.PartialResult())
                            text = result.get('partial', '').strip()
                            if text:
                                self.send_partial(text)
                    except queue.Empty:
                        continue

        except KeyboardInterrupt:
            self.stop_listening()
        except Exception as e:
            self.send_error(str(e))
            sys.exit(1)

def main():
    try:
        args = parse_args()
        transcriber = VoskLiveTranscriber(
            model_size=args.model_size,
            is_dev=args.dev,
            models_dir=args.models_dir
        )
        transcriber.run()
    except Exception as e:
        output = {
            "type": "error",
            "error": str(e)
        }
        print(json.dumps(output), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
