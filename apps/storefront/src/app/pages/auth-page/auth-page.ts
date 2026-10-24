import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthFormComponent } from '../../components/auth-form/auth-form';
import { AuthFlowService } from '../../services/auth-flow.service';
import { User } from '../../services/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [RouterModule, AuthFormComponent],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authFlow = inject(AuthFlowService);

  authMode: 'signin' | 'signup' = 'signin';

  constructor() {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.authMode = data['authMode'] === 'signup' ? 'signup' : 'signin';
    });
  }

  onAuthenticated(_user: User): void {
    if (this.authFlow.consumeCheckoutPending()) {
      void this.router.navigate(['/checkout']);
      return;
    }
    const raw = this.route.snapshot.queryParams['returnUrl'];
    if (typeof raw === 'string' && this.isSafeReturnUrl(raw)) {
      void this.router.navigateByUrl(raw);
      return;
    }
    void this.router.navigate(['/']);
  }

  private isSafeReturnUrl(url: string): boolean {
    return url.startsWith('/') && !url.startsWith('//');
  }
}
