import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/demo-shell').then((m) => m.DemoShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/gallery').then((m) => m.Gallery),
        title: 'ng-bits — animated backgrounds for Angular',
      },
      {
        path: 'b/:slug',
        loadComponent: () => import('./pages/preview').then((m) => m.Preview),
        title: 'ng-bits — preview',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
