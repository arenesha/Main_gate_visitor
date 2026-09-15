import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuthorizeRequest {
  visitorNames: string[];
  pin: string;
}

export interface AuthorizeResponse {
  success: boolean;
  authorized?: boolean;
  authorizationStatus: string;
  authorizationId?: string;
  visitorNames?: string[];
  date?: string;
  time?: string;
  emailSent?: boolean;
  smsSent?: boolean;
  emailStatus?: string;
  smsStatus?: string;
  email?: {
    status?: string;
    security?: boolean;
    visitors?: Array<{ name: string; email: string; success: boolean; messageId?: string; error?: string }>;
    messageId?: string;
    errorCode?: string;
    message?: string;
  };
  sms?: {
    status?: string;
    visitors?: Array<{ name: string; phone: string; success: boolean; messageId?: string; error?: string }>;
    messageId?: string;
    errorCode?: string;
    message?: string;
  };
  notifications?: any[];
  message?: string;
}

export interface GateVerifyRequest {
  authorizationId: string;
  pin: string;
}

export interface GateVerifyResponse {
  success: boolean;
  entryStatus: string;
  authorizationId?: string;
  visitorNames?: string[];
  entryDate?: string;
  entryTime?: string;
  message?: string;
}

export interface ChangePinRequest {
  currentPin: string;
  newPin: string;
  confirmNewPin: string;
}

export interface Visitor {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  active?: number | boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EntryRecord {
  id: number;
  authorizationId: string;
  visitorNames: string;
  entryDate: string;
  entryTime: string;
  authorizationStatus: string;
  entryStatus: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = window.location.port === '4200' ? 'http://localhost:8003/api' : '/api';

  constructor(private http: HttpClient) {}

  // 1. Authorization
  authorizeVisitor(data: AuthorizeRequest): Observable<AuthorizeResponse> {
    return this.http.post<AuthorizeResponse>(`${this.baseUrl}/authorization/authorize`, data);
  }

  // 2. Gate Verification
  verifyGate(data: GateVerifyRequest): Observable<GateVerifyResponse> {
    return this.http.post<GateVerifyResponse>(`${this.baseUrl}/gate/verify`, data);
  }

  // 3. Admin PIN Change
  changePin(data: ChangePinRequest): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/admin/change-pin`, data);
  }

  // 4. Admin Visitor Directory
  getVisitors(search: string = ''): Observable<{ success: boolean; visitors: Visitor[] }> {
    return this.http.get<{ success: boolean; visitors: Visitor[] }>(`${this.baseUrl}/admin/visitors?search=${encodeURIComponent(search)}`);
  }

  createVisitor(visitor: Visitor): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/admin/visitors`, visitor);
  }

  updateVisitor(id: number, visitor: Partial<Visitor>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/admin/visitors/${id}`, visitor);
  }

  deleteVisitor(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/admin/visitors/${id}`);
  }

  // 5. Entry Records Dashboard
  getEntries(): Observable<{ success: boolean; entries: EntryRecord[] }> {
    return this.http.get<{ success: boolean; entries: EntryRecord[] }>(`${this.baseUrl}/entries`);
  }

  // 6. Notifications by Auth ID
  getNotifications(authorizationId: string): Observable<{ success: boolean; notifications: any[] }> {
    return this.http.get<{ success: boolean; notifications: any[] }>(`${this.baseUrl}/notifications/${authorizationId}`);
  }
}
