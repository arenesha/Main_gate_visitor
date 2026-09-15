import { Routes } from '@angular/router';
import { AuthorizeComponent } from './components/authorize/authorize.component';
import { GateComponent } from './components/gate/gate.component';
import { AdminComponent } from './components/admin/admin.component';

export const routes: Routes = [
  { path: '', redirectTo: 'authorization', pathMatch: 'full' },
  { path: 'authorization', component: AuthorizeComponent },
  { path: 'gate-verification', component: GateComponent },
  { path: 'admin/pin', component: AdminComponent },
  { path: 'admin/visitors', component: AdminComponent },
  { path: 'admin/entries', component: AdminComponent },
  { path: 'authorize', component: AuthorizeComponent },
  { path: 'gate', component: GateComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: 'authorization' }
];
