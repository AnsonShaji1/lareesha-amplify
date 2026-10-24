import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, ViewportScroller } from '@angular/common';
import { HomeCategoryGridComponent } from '../../components/home/home-category-grid/home-category-grid';
import { HomeProductCarouselComponent } from '../../components/home/home-product-carousel/home-product-carousel';
import { Product } from '../../models/product';
import { Category } from '../../models/category';
import { HomeCategorySection } from '../../models/homepage';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, HomeCategoryGridComponent, HomeProductCarouselComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  homepageCategories: Category[] = [];
  newArrivals: Product[] = [];
  newArrivalsCount = 0;
  categorySections: HomeCategorySection[] = [];
  homepageLoading = true;

  constructor(
    private api: ApiService,
    private router: Router,
    private viewportScroller: ViewportScroller,
  ) {}

  ngOnInit() {
    this.loadHomepage();
  }

  private loadHomepage(): void {
    this.homepageLoading = true;
    this.api.getHomepage().subscribe({
      next: (data) => {
        this.homepageCategories = data.categories;
        this.newArrivals = data.newArrivals;
        this.newArrivalsCount = data.newArrivalsCount;
        this.categorySections = data.categorySections;
        this.homepageLoading = false;
      },
      error: (err) => {
        console.error('Home: failed to load homepage data', err);
        this.homepageCategories = [];
        this.newArrivals = [];
        this.newArrivalsCount = 0;
        this.categorySections = [];
        this.homepageLoading = false;
      },
    });
  }

  openProductDetail(product: Product) {
    this.router.navigate(['/product', product.id]);
  }

  scrollToShop(): void {
    const header = document.querySelector('.header')?.getBoundingClientRect().height ?? 64;
    this.viewportScroller.setOffset([0, header + 16]);
    this.viewportScroller.scrollToAnchor('shop');
  }
}
