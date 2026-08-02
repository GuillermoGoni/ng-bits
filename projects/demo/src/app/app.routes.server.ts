import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    // Rendered per request: the slug space lives in the registry, and this
    // doubles as the check that every background survives an SSR pass.
    path: '**',
    renderMode: RenderMode.Server,
  },
];
