import { Category } from './category';

export interface Product {
  id: string;
  productCode?: string;
  name: string;
  description?: string;
  originalPrice: number;
  salePrice?: number;
  images: string[];
  category: Category;
  newIn: boolean;
  noOfStock: number;
  availableStock: number;
  /** Tax rate in basis points (800 = 8%). */
  taxPercentageBps?: number;
}
