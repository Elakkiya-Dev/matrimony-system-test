import { Component, ElementRef, OnDestroy, ViewChild, NgZone } from '@angular/core';

@Component({
  selector: 'app-audio-recorder',
  templateUrl: './audio-recorder.component.html',
  styleUrls: ['./audio-recorder.component.css']
})
export class AudioRecorderComponent implements OnDestroy {
  @ViewChild('waveCanvas', { static: true }) waveCanvas!: ElementRef<HTMLCanvasElement>;

  audioContext!: AudioContext;
  analyser!: AnalyserNode;
  dataArray!: Uint8Array;
  bufferLength = 0;
  drawRequestId: number | null = null;

  stream!: MediaStream;
  mediaRecorder!: MediaRecorder;
  audioChunks: Blob[] = [];
  audioURL: string = '';

  isRecording = false;
  isRecorded = false;
  maxTime = 30;
  elapsed = 0;
  timerId: any;

  audioPlayer: HTMLAudioElement | null = null;

  constructor(private ngZone: NgZone) {}

  async startRecording() {
    // Reset state
    this.audioChunks = [];
    this.audioURL = '';
    this.isRecorded = false;
    this.isRecording = false;
    this.elapsed = 0;

    // 1. Request microphone
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);

    // 2. Setup analyser
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;

    // Use frequencyBinCount for buffer length
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    source.connect(this.analyser);

    // 3. Start MediaRecorder
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.start();

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      this.audioChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.audioURL = URL.createObjectURL(blob);

      this.ngZone.run(() => {
        this.isRecorded = true;
        this.isRecording = false;
      });
    };

    // Update state
    this.ngZone.run(() => {
      this.isRecording = true;
      this.isRecorded = false;
      this.elapsed = 0;
    });

    this.drawWaveform();

    // Timer to auto-stop
    this.timerId = setInterval(() => {
      this.elapsed++;
      if (this.elapsed >= this.maxTime) {
        this.ngZone.run(() => this.stopRecording());
      }
    }, 1000);
  }

  playAudio() {
    if (!this.audioURL) return;

    this.elapsed = 0;
    this.audioPlayer = new Audio(this.audioURL);
    this.audioPlayer.crossOrigin = 'anonymous';

    // Setup AudioContext for playback visualization
    const playbackContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = playbackContext.createMediaElementSource(this.audioPlayer);
    const analyser = playbackContext.createAnalyser();
    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    analyser.connect(playbackContext.destination);

    const canvas = this.waveCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const drawPlaybackWave = () => {
      this.drawRequestId = requestAnimationFrame(drawPlaybackWave);

      // Type-safe: get waveform
      analyser.getByteTimeDomainData(dataArray);

      ctx!.fillStyle = '#fff';
      ctx!.fillRect(0, 0, WIDTH, HEIGHT);

      ctx!.lineWidth = 2;
      ctx!.strokeStyle = '#ff4081';
      ctx!.beginPath();

      let x = 0;
      const sliceWidth = WIDTH / bufferLength;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * HEIGHT / 2;

        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);

        x += sliceWidth;
      }

      ctx!.lineTo(WIDTH, HEIGHT / 2);
      ctx!.stroke();
    };

    drawPlaybackWave();
    this.audioPlayer.play();

    this.audioPlayer.onended = () => {
      if (this.drawRequestId) {
        cancelAnimationFrame(this.drawRequestId);
        this.drawRequestId = null;
      }
      playbackContext.close();
    };

    this.timerId = setInterval(() => {
      this.elapsed++;
      if (this.elapsed >= this.maxTime) {
        this.audioPlayer?.pause();
        this.audioPlayer = null;
        clearInterval(this.timerId);
      }
    }, 1000);
  }

  stopRecording() {
    if (this.drawRequestId) cancelAnimationFrame(this.drawRequestId);
    clearInterval(this.timerId);

    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
    this.stream.getTracks().forEach(t => t.stop());

    this.ngZone.run(() => {
      this.isRecording = false;
    });
  }

  cancelRecording() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer = null;
    }

    if (this.isRecording) {
      this.mediaRecorder?.stop();
      this.stream?.getTracks().forEach(t => t.stop());
    }

    if (this.drawRequestId) {
      cancelAnimationFrame(this.drawRequestId);
      this.drawRequestId = null;
    }

    clearInterval(this.timerId);

    this.ngZone.run(() => {
      this.audioChunks = [];
      this.audioURL = '';
      this.isRecorded = false;
      this.isRecording = false;
      this.elapsed = 0;
    });
  }

  drawWaveform() {
    const canvas = this.waveCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const draw = () => {
      this.drawRequestId = requestAnimationFrame(draw);

      // Type-safe
      this.analyser.getByteTimeDomainData(this.dataArray);

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff4081';
      ctx.beginPath();

      let x = 0;
      const sliceWidth = WIDTH / this.bufferLength;

      for (let i = 0; i < this.bufferLength; i++) {
        const v = this.dataArray[i] / 128.0;
        const y = v * HEIGHT / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.lineTo(WIDTH, HEIGHT / 2);
      ctx.stroke();
    };

    draw();
  }

  ngOnDestroy() {
    if (this.audioPlayer) this.audioPlayer.pause();

    cancelAnimationFrame(this.drawRequestId!);
    clearInterval(this.timerId);

    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.audioContext) this.audioContext.close();
  }
}
