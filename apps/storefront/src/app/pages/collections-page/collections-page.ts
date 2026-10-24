import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/category';
import { toTitleCase } from '../../utils/text';

@Component({
  selector: 'app-collections-page',
  imports: [RouterModule],
  templateUrl: './collections-page.html',
  styleUrl: './collections-page.scss',
})
export class CollectionsPage implements OnInit {
  categories: Category[] = [];
  isLoading = true;

  readonly toTitleCase = toTitleCase;

  readonly placeholderSrc =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533"><rect fill="#161616" width="400" height="533"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#a39b90" font-family="sans-serif" font-size="18">Collection</text></svg>',
    );

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('CollectionsPage: failed to load categories', err);
        this.categories = [];
        this.isLoading = false;
      },
    });
  }
}
