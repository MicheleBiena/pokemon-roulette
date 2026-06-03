import { Component, Input } from '@angular/core';
import { Badge } from '../../interfaces/badge';
import { Observable } from 'rxjs';
import { DarkModeService } from '../../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../../services/theme-service/theme.service';
import { CommonModule } from '@angular/common';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-badges',
  imports: [
    CommonModule,
    NgbTooltipModule,
    TranslatePipe
  ],
  templateUrl: './badges.component.html',
  styleUrl: './badges.component.css'
})
export class BadgesComponent {

    @Input() trainerBadges: Badge[] = [];
    readonly badgeSlots = [0, 1, 2, 3, 4, 5, 6, 7];
    private readonly spriteOverrides: Record<string, string> = {
      'badges.normalium_z': 'https://img.pokemondb.net/sprites/items/normalium-z.png',
      'badges.fightinium_z': 'https://img.pokemondb.net/sprites/items/fightinium-z.png',
      'badges.waterium_z': 'https://img.pokemondb.net/sprites/items/waterium-z.png',
      'badges.firium_z': 'https://img.pokemondb.net/sprites/items/firium-z.png',
      'badges.grassium_z': 'https://img.pokemondb.net/sprites/items/grassium-z.png',
      'badges.rockium_z': 'https://img.pokemondb.net/sprites/items/rockium-z.png',
      'badges.electrium_z': 'https://img.pokemondb.net/sprites/items/electrium-z.png',
      'badges.ghostium_z': 'https://img.pokemondb.net/sprites/items/ghostium-z.png',
      'badges.darkinium_z': 'https://img.pokemondb.net/sprites/items/darkinium-z.png',
      'badges.fairium_z': 'https://img.pokemondb.net/sprites/items/fairium-z.png',
      'badges.groundium_z': 'https://img.pokemondb.net/sprites/items/groundium-z.png'
    };

    darkMode!: Observable<boolean>;

    constructor(private darkModeService: DarkModeService, private themeService: ThemeService) {
      this.darkMode = this.themeService.isDark$;
    }

    getBadgeSprite(badge: Badge): string {
      return this.spriteOverrides[badge.name] ?? badge.sprite;
    }

    onBadgeImageError(event: Event): void {
      const image = event.target as HTMLImageElement;
      image.src = './place-holder-pixel.png';
      image.classList.add('is-broken');
    }
}
