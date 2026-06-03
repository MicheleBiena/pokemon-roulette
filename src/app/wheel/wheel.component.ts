import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { WheelItem } from '../interfaces/wheel-item';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SoundFxHandle, SoundFxService } from '../services/sound-fx-service/sound-fx.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-wheel',
  imports: [
    CommonModule,
    TranslatePipe
  ],
  templateUrl: './wheel.component.html',
  styleUrl: './wheel.component.css'
})
export class WheelComponent implements AfterViewInit, OnChanges {

  wheelCanvas!: HTMLCanvasElement;
  wheelCtx!: CanvasRenderingContext2D;
  pointerCanvas!: HTMLCanvasElement;
  pointerCtx!: CanvasRenderingContext2D;
  @Input() items: WheelItem[] = [];
  @Output() selectedItemEvent = new EventEmitter<number>();
  @ViewChild('wheel') wheelCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pointer') pointerCanvasRef!: ElementRef<HTMLCanvasElement>;
  spinning = false;
  darkMode!: Observable<boolean>;

  canvasHeight: number;
  wheelWidth: number;
  cursorWidth: number;
  fontSize: number;
  currentRotation = 0;
  startTime = 0;
  totalRotations!: number;
  duration = Math.floor(Math.random() * (2000)) + 3000;
  finalRotation = 0;
  winningNumber!: number;
  currentSegment: string = 'wheel.ready';
  clickAudio!: SoundFxHandle;

  private translatedItems: WheelItem[] = [];
  private readonly mobileBreakpoint = 768;
  private colorParserCtx: CanvasRenderingContext2D | null = null;
  private readonly segmentPalette = [
    '#256d85',
    '#7c3aed',
    '#b45309',
    '#047857',
    '#be123c',
    '#1d4ed8',
    '#a21caf',
    '#4d7c0f',
    '#0f766e',
    '#6d28d9'
  ];

  constructor(
    private darkModeService: DarkModeService,
    private themeService: ThemeService,
    private gameStateService: GameStateService,
    private translateService: TranslateService,
    private soundFxService: SoundFxService,
    private modalService: NgbModal
  ) {
    this.clickAudio = this.soundFxService.createClickSoundFx();
    this.darkMode = this.themeService.isDark$;
    this.canvasHeight = 0;
    this.wheelWidth = 0;
    this.cursorWidth = 54;
    this.fontSize = 0;
    this.updateWheelDimensions();
  }

  ngAfterViewInit(): void {
    this.wheelCanvas = this.wheelCanvasRef.nativeElement;
    this.wheelCtx = this.wheelCanvas.getContext('2d')!;
    this.pointerCanvas = this.pointerCanvasRef.nativeElement;
    this.pointerCtx = this.pointerCanvas.getContext('2d')!;

    this.translateService.get('wheel.spin').subscribe(() => {
      this.preprocessTranslations();
      this.drawWheel();
      this.drawPointer();
    });
  }

  @HostListener('window:resize')
  handleResize(): void {
    this.updateWheelDimensions();

    if (this.wheelCtx && this.pointerCtx) {
      this.drawWheel(this.currentRotation);
      this.drawPointer();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && !changes['items'].firstChange) {
      this.translateService.get('wheel.spin').subscribe(() => {
        this.preprocessTranslations();
        this.drawWheel();
        this.drawPointer();
      });
    }
  }

  private preprocessTranslations(): void {
    this.translatedItems = this.items.map(item => ({
      ...item,
      text: this.translateService.instant(item.text)
    }));
  }

  private updateWheelDimensions(): void {
    const viewportMin = Math.min(window.innerHeight, window.innerWidth);
    const wheelScale = window.innerWidth <= this.mobileBreakpoint ? 0.70 : 0.50;

    this.canvasHeight = viewportMin * wheelScale;
    this.wheelWidth = this.canvasHeight;
    this.fontSize = this.wheelWidth / 26;

    if (this.items.length >= 32) {
      this.fontSize = Math.min(this.fontSize, 9);
    } else if (this.items.length >= 16) {
      this.fontSize = Math.min(this.fontSize, 12);
    }
  }

  private drawWheel(rotation = 0): void {
    const centerX = this.wheelCanvas.width / 2;
    const centerY = this.wheelCanvas.height / 2;
    const radius = this.wheelCanvas.width / 2;
    const segRadius = radius * 0.82;

    this.wheelCtx.clearRect(0, 0, this.wheelCanvas.width, this.wheelCanvas.height);

    const totalWeight = this.getTotalWeights();
    if (totalWeight <= 0) {
      return;
    }

    const arcSize = (2 * Math.PI) / totalWeight;
    this.drawWheelBackplate(centerX, centerY, radius);

    let startAngle = rotation;
    for (let index = 0; index < this.translatedItems.length; index++) {
      const item = this.translatedItems[index];
      const segmentSize = arcSize * item.weight;
      const endAngle = startAngle + segmentSize;

      this.wheelCtx.beginPath();
      this.wheelCtx.arc(centerX, centerY, segRadius, startAngle, endAngle);
      this.wheelCtx.lineTo(centerX, centerY);
      this.wheelCtx.fillStyle = this.getSegmentFill(item.fillStyle, index);
      this.wheelCtx.fill();
      this.wheelCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      this.wheelCtx.lineWidth = Math.max(1, radius * 0.004);
      this.wheelCtx.stroke();

      if (this.shouldDrawLabels()) {
        this.drawSegmentLabel(item.text, centerX, centerY, startAngle, segmentSize, segRadius, radius);
      }

      startAngle = endAngle;
    }

    this.drawWheelGloss(centerX, centerY, radius);
    this.drawBorderRing(centerX, centerY, radius);

    const pbRadius = window.innerWidth <= this.mobileBreakpoint ? radius * 0.14 : radius * 0.095;
    this.drawPokeball(centerX, centerY, pbRadius);
  }

  private drawWheelBackplate(cx: number, cy: number, radius: number): void {
    const ctx = this.wheelCtx;
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(30, 41, 59, 0.84)');
    gradient.addColorStop(0.72, 'rgba(15, 23, 42, 0.96)');
    gradient.addColorStop(1, 'rgba(2, 6, 23, 1)');

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  private drawWheelGloss(cx: number, cy: number, radius: number): void {
    const ctx = this.wheelCtx;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
    ctx.clip();

    const gloss = ctx.createRadialGradient(cx - radius * 0.22, cy - radius * 0.34, 0, cx, cy, radius);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    gloss.addColorStop(0.32, 'rgba(255, 255, 255, 0.04)');
    gloss.addColorStop(1, 'rgba(0, 0, 0, 0.24)');

    ctx.fillStyle = gloss;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  private drawBorderRing(cx: number, cy: number, radius: number): void {
    const ctx = this.wheelCtx;
    const ringWidth = radius * 0.12;
    const ringRadius = radius - ringWidth / 2 - 1;
    const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.28, '#334155');
    gradient.addColorStop(0.52, '#d6a840');
    gradient.addColorStop(0.74, '#475569');
    gradient.addColorStop(1, '#111827');

    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = gradient;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.84, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, radius * 0.012);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.985, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, radius * 0.014);
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
    ctx.stroke();
  }

  private drawPokeball(cx: number, cy: number, pbRadius: number): void {
    const ctx = this.wheelCtx;

    ctx.save();
    ctx.shadowColor = 'rgba(2, 6, 23, 0.45)';
    ctx.shadowBlur = pbRadius * 0.36;
    ctx.shadowOffsetY = pbRadius * 0.08;

    ctx.beginPath();
    ctx.arc(cx, cy, pbRadius, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = '#e11d48';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, pbRadius, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, pbRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = pbRadius * 0.12;
    ctx.stroke();

    const beltHeight = pbRadius * 0.22;
    ctx.fillStyle = '#020617';
    ctx.fillRect(cx - pbRadius, cy - beltHeight / 2, pbRadius * 2, beltHeight);

    const btnRadius = pbRadius * 0.30;
    ctx.beginPath();
    ctx.arc(cx, cy, btnRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, btnRadius * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = '#e5edf7';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, btnRadius * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.restore();
  }

  private shouldDrawLabels(): boolean {
    return this.translatedItems.length <= 48;
  }

  private drawSegmentLabel(
    text: string,
    cx: number,
    cy: number,
    startAngle: number,
    segmentSize: number,
    segRadius: number,
    radius: number
  ): void {
    const ctx = this.wheelCtx;
    const angle = startAngle + segmentSize / 2;
    const normalizedAngle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const shouldFlip = normalizedAngle > Math.PI / 2 && normalizedAngle < Math.PI * 1.5;
    const label = this.getSegmentLabel(text);
    const labelRadius = segRadius - radius * 0.08;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${this.fontSize}px Trebuchet MS, Arial, sans-serif`;
    ctx.lineWidth = Math.max(2, this.fontSize * 0.22);
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.fillStyle = '#f8fbff';

    if (shouldFlip) {
      ctx.rotate(Math.PI);
      ctx.textAlign = 'left';
      ctx.strokeText(label, -labelRadius, 0);
      ctx.fillText(label, -labelRadius, 0);
    } else {
      ctx.textAlign = 'right';
      ctx.strokeText(label, labelRadius, 0);
      ctx.fillText(label, labelRadius, 0);
    }

    ctx.restore();
  }

  private getSegmentLabel(text: string): string {
    const maxLength = this.translatedItems.length >= 28 ? 11 : this.translatedItems.length >= 16 ? 16 : 22;

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(1, maxLength - 3)).trim()}...`;
  }

  private getSegmentFill(color: string, index: number): string {
    let rgb = this.resolveCssColor(color);

    if (!rgb || (rgb.r < 12 && rgb.g < 12 && rgb.b < 12) || (rgb.r > 245 && rgb.g > 245 && rgb.b > 245)) {
      rgb = this.resolveCssColor(this.segmentPalette[index % this.segmentPalette.length]);
    }

    if (!rgb) {
      return this.segmentPalette[index % this.segmentPalette.length];
    }

    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const saturation = Math.min(64, Math.max(38, hsl.s * 0.72));
    const lightness = Math.min(44, Math.max(28, hsl.l * 0.74));

    return `hsl(${Math.round(hsl.h)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
  }

  private resolveCssColor(color: string): { r: number; g: number; b: number } | null {
    if (!color?.trim() || typeof document === 'undefined') {
      return null;
    }

    if (!this.colorParserCtx) {
      this.colorParserCtx = document.createElement('canvas').getContext('2d');
    }

    const ctx = this.colorParserCtx;
    if (!ctx) {
      return null;
    }

    ctx.fillStyle = '#000000';
    ctx.fillStyle = color.trim();

    return this.parseColorString(ctx.fillStyle);
  }

  private parseColorString(value: string): { r: number; g: number; b: number } | null {
    if (value.startsWith('#')) {
      const hex = value.slice(1);

      if (hex.length === 3) {
        return {
          r: Number.parseInt(hex[0] + hex[0], 16),
          g: Number.parseInt(hex[1] + hex[1], 16),
          b: Number.parseInt(hex[2] + hex[2], 16)
        };
      }

      if (hex.length === 6) {
        return {
          r: Number.parseInt(hex.slice(0, 2), 16),
          g: Number.parseInt(hex.slice(2, 4), 16),
          b: Number.parseInt(hex.slice(4, 6), 16)
        };
      }
    }

    const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);

    if (!rgbMatch) {
      return null;
    }

    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3])
    };
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const delta = max - min;
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      switch (max) {
        case red:
          h = (green - blue) / delta + (green < blue ? 6 : 0);
          break;
        case green:
          h = (blue - red) / delta + 2;
          break;
        default:
          h = (red - green) / delta + 4;
          break;
      }

      h /= 6;
    }

    return {
      h: h * 360,
      s: s * 100,
      l: l * 100
    };
  }

  drawPointer(): void {
    this.pointerCtx.clearRect(0, 0, this.pointerCanvas.width, this.pointerCanvas.height);
    this.pointerCtx.save();

    const pw = this.pointerCanvas.width;
    const ph = this.pointerCanvas.height;
    const size = Math.min(pw - 4, this.cursorWidth);
    const x = 1;
    const cy = ph / 2;
    const gradient = this.pointerCtx.createLinearGradient(x, cy - size * 0.28, x + size, cy + size * 0.28);
    gradient.addColorStop(0, '#fde68a');
    gradient.addColorStop(0.55, '#f59e0b');
    gradient.addColorStop(1, '#b45309');

    this.pointerCtx.beginPath();
    this.pointerCtx.moveTo(x, cy);
    this.pointerCtx.lineTo(x + size * 0.42, cy - size * 0.30);
    this.pointerCtx.lineTo(x + size * 0.34, cy - size * 0.09);
    this.pointerCtx.lineTo(x + size * 0.92, cy - size * 0.09);
    this.pointerCtx.lineTo(x + size * 0.78, cy + size * 0.04);
    this.pointerCtx.lineTo(x + size * 0.94, cy + size * 0.11);
    this.pointerCtx.lineTo(x + size * 0.34, cy + size * 0.11);
    this.pointerCtx.lineTo(x + size * 0.42, cy + size * 0.30);
    this.pointerCtx.closePath();

    this.pointerCtx.fillStyle = gradient;
    this.pointerCtx.fill();
    this.pointerCtx.strokeStyle = 'rgba(47, 32, 6, 0.9)';
    this.pointerCtx.lineWidth = 2;
    this.pointerCtx.stroke();

    this.pointerCtx.restore();
  }

  spinWheel(): void {
    if (this.spinning) {
      return;
    }

    this.spinning = true;
    this.gameStateService.setWheelSpinning(this.spinning);

    this.startTime = performance.now();
    const totalWeight = this.getTotalWeights();
    if (totalWeight <= 0) {
      this.spinning = false;
      this.gameStateService.setWheelSpinning(false);
      return;
    }

    const arcSize = (2 * Math.PI) / totalWeight;

    this.winningNumber = this.getRandomWeightedIndex();

    this.totalRotations = Math.floor(Math.random() * 4) + 1;

    let winningAngle = 0;
    const winningSegmentSize = arcSize * this.items[this.winningNumber].weight;

    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      winningAngle += arcSize * item.weight;
      if (index === this.winningNumber) {
        break;
      }
    }

    const offset = Math.random() * winningSegmentSize;
    this.finalRotation = this.totalRotations * 2 * Math.PI + (2 * Math.PI - winningAngle + offset);

    requestAnimationFrame(this.animate.bind(this));
  }

  private animate(currentTime: number): void {
    const elapsed = currentTime - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    this.currentRotation = easedProgress * this.finalRotation;

    this.drawWheel(this.currentRotation);

    if (progress < 1) {
      requestAnimationFrame(this.animate.bind(this));
    } else {
      this.spinning = false;
      this.selectedItemEvent.emit(this.winningNumber);
      this.gameStateService.setWheelSpinning(false);
    }

    const segment = this.getCurrentSegment();

    if (segment !== this.currentSegment) {
      this.currentSegment = segment;
      void this.soundFxService.playSoundFx(this.clickAudio, 1.0, { preventOverlap: true });
    }
  }

  private getCurrentSegment(): string {
    const totalWeight = this.getTotalWeights();
    if (totalWeight <= 0) {
      return 'wheel.ready';
    }

    const currentAngle = (2 * Math.PI - (this.currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    let accumulatedWeight = 0;

    for (const item of this.translatedItems) {
      accumulatedWeight += item.weight;
      const segmentEnd = (accumulatedWeight / totalWeight) * 2 * Math.PI;

      if (currentAngle <= segmentEnd) {
        return item.text;
      }
    }
    return 'wheel.ready';
  }

  private getTotalWeights(): number {
    return this.translatedItems.reduce((sum, item) => sum + item.weight, 0);
  }

  getRandomWeightedIndex(): number {
    const totalWeight = this.getTotalWeights();
    let random = Math.random() * totalWeight;
    let accumulatedWeight = 0;

    for (let i = 0; i < this.translatedItems.length; i++) {
      accumulatedWeight += this.translatedItems[i].weight;
      if (random < accumulatedWeight) {
        return i;
      }
    }
    return this.translatedItems.length - 1;
  }

  @HostListener('window:keydown.space', ['$event'])
  handleSpacebar(event: Event): void {
    const activeElement = document.activeElement;
    const isInputOrButtonFocused = activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLButtonElement ||
      activeElement?.getAttribute('role') === 'button';

    if (!this.spinning && !this.modalService.hasOpenModals() && !isInputOrButtonFocused) {
      event.preventDefault();
      this.spinWheel();
    }
  }
}
