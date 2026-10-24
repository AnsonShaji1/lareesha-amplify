import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Category } from '../../../models/category';
import { toTitleCase } from '../../../utils/text';

@Component({
  selector: 'app-home-category-grid',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-category-grid.html',
  styleUrl: './home-category-grid.scss',
})
export class HomeCategoryGridComponent {
  @Input() categories: Category[] = [];
  @Input() isLoading = false;
  @Input() title = 'Categories';
  @Input() viewAllLink = '/categories';

  readonly toTitleCase = toTitleCase;

  readonly placeholderSrc =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533"><rect fill="#161616" width="400" height="533"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#a39b90" font-family="sans-serif" font-size="18">Collection</text></svg>',
    );
}
