import { Category } from './category';
import { Product } from './product';

export interface HomeCategorySection {
  category: Category;
  products: Product[];
  productCount: number;
}

export interface HomepageData {
  categories: Category[];
  newArrivals: Product[];
  newArrivalsCount: number;
  categorySections: HomeCategorySection[];
}
