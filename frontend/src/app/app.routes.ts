import { Routes } from '@angular/router';

import { Home } from './home/home';
import { Login } from './login/login';
import { Maps } from './maps/maps';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'maps', component: Maps },
  { path: 'login', component: Login },
  { path: '**', redirectTo: '' },
];
