import { Routes } from '@angular/router';

import { Home } from './home/home';
import { Login } from './login/login';
import { MapView } from './maps/map-view';
import { Maps } from './maps/maps';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login },
  // Browsing and opening maps is public by design (FR-001, FR-004) — no guard.
  { path: 'maps', component: Maps },
  { path: 'maps/:id', component: MapView },
  { path: '**', redirectTo: '' },
];
