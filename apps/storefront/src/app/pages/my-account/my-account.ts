import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-account.html',
  styleUrl: './my-account.scss',
})
export class MyAccountPage implements OnInit {
  user: User | null = null;
  isOrdersPage = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.user = user;
    });

    this.router.events.subscribe(() => {
      this.isOrdersPage = this.router.url.includes('/account/orders');
    });
    this.isOrdersPage = this.router.url.includes('/account/orders');
  }
}
