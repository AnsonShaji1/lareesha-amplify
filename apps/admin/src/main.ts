import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { App } from './app/app';
import { routes } from './app/app.routes';
import './app/amplify-client';

bootstrapApplication(App, {
  providers: [provideRouter(routes), provideAnimations()],
}).catch((err) => console.error(err));
