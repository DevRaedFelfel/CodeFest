import { Component } from '@angular/core';
import confetti from 'canvas-confetti';

@Component({
  selector: 'app-celebration',
  standalone: true,
  template: '',
})
export class CelebrationComponent {
  fire(): void {
    // Burst from both sides
    const defaults = {
      spread: 60,
      ticks: 100,
      gravity: 0.8,
      decay: 0.94,
      startVelocity: 30,
      colors: ['#7b2ff7', '#00d2ff', '#2ed573', '#ffd700', '#ff4757'],
    };

    confetti({
      ...defaults,
      particleCount: 50,
      origin: { x: 0.2, y: 0.7 },
      angle: 60,
    });

    confetti({
      ...defaults,
      particleCount: 50,
      origin: { x: 0.8, y: 0.7 },
      angle: 120,
    });

    // Center burst after a beat
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 80,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
      });
    }, 250);
  }
}
