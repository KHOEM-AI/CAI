/**
 * ==============================================================================
 * KHOEM_AI Nexus Hub - Angular Frontend Service (Patched)
 * Path: khoem-new/angular-src/khoem_ai_nexus.ts
 *
 * *** ការផ្លាស់ប្តូរសំខាន់ៗ (Security Fixes) ***
 * 1. លុបចោល verifyFaceBiometrics() ក្លែងក្លាយ (setTimeout → true) —
 *    ការផ្ទៀងផ្ទាត់ត្រូវតែកើតឡើងនៅ server-side, មិនមែន client-side ទេ។
 * 2. លុបចោល hardcoded ownerEmail/deviceId — ទាំងនេះមើលឃើញដោយអ្នកប្រើប្រាស់
 *    ណាមួយតាមរយៈ browser DevTools ព្រោះ JS bundle ត្រូវផ្ញើទៅ client ទាំងស្រុង។
 * 3. ប្រើ session token (ដែល backend ចេញឲ្យបន្ទាប់ពី real login) ជំនួសវិញ —
 *    server ជាអ្នកសម្រេចថា user ណាមានសិទ្ធិគ្រប់គ្រងឧបករណ៍ណា។
 *
 * *** តម្រូវការនៅខាង Backend (ត្រូវធ្វើផងដែរ) ***
 * - Endpoint login ពិតប្រាកដ (password/OTP/ការផ្ទៀងផ្ទាត់ biometric ដែលដំណើរការ
 *   លើ server ឬ device OS API ដែលទុកចិត្តបាន — មិនមែន setTimeout ក្នុង JS)
 * - /api/nexus/control ត្រូវ verify Authorization header មុននឹងប្រតិបត្តិ
 *   action ណាមួយ, ហើយត្រូវពិនិត្យថា user នេះមានសិទ្ធិលើ target_device នោះ
 * ==============================================================================
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

export interface NexusStatusResponse {
  system: string;
  total_devices: number;
  ecosystem: any;
}

export interface NexusCommandResponse {
  status: string;
  message: string;
  executed_by?: string;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class KhoemAiNexusService {

  private readonly apiUrl = '/api/nexus';

  constructor(private http: HttpClient) {}

  /**
   * ទាញយក session token ដែលបានរក្សាទុកបន្ទាប់ពី login ជោគជ័យ។
   * សូមប្រើវិធីសាស្ត្ររក្សាទុក token ដែលសមស្របតាមស្ថាបត្យកម្មរបស់បង
   * (ឧ. HttpOnly cookie ដែល backend set ដោយស្វ័យប្រវត្តិ ជាជម្រើសសុវត្ថិភាព
   * ជាងការទុកក្នុង localStorage)។
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.getSessionToken();
    if (!token) {
      throw new Error('Not authenticated: no active session token.');
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  private getSessionToken(): string | null {
    // ជំនួសដោយវិធីទាញយក token ពិតប្រាកដពី AuthService របស់បង
    // (ឧ. inject AuthService ហើយហៅ authService.getToken())
    return null;
  }

  /**
   * ទាញយកស្ថានភាពឧបករណ៍ទាំងអស់ពី Server (Real-time Status)
   */
  getDeviceStatus(): Observable<NexusStatusResponse> {
    return this.http.get<NexusStatusResponse>(`${this.apiUrl}/status`, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * បញ្ជាឧបករណ៍ — backend ជាអ្នកទទួលខុសត្រូវផ្ទៀងផ្ទាត់ identity
   * និងសិទ្ធិអំណាច (authorization) ដោយផ្អែកលើ session token,
   * មិនមែនផ្អែកលើ payload ណាមួយដែល client ផ្ញើមកទេ។
   *
   * @param targetDevice ឈ្មោះឧបករណ៍ (ឧ. main_door_lock)
   * @param action សកម្មភាព (ឧ. ON, OFF, LOCK, UNLOCK)
   */
  async sendCommand(targetDevice: string, action: string): Promise<NexusCommandResponse> {
    const payload = {
      target_device: targetDevice,
      action: action
    };

    try {
      const response = await firstValueFrom(
        this.http.post<NexusCommandResponse>(`${this.apiUrl}/control`, payload, {
          headers: this.getAuthHeaders()
        })
      );
      return response;
    } catch (error) {
      console.error('❌ បញ្ហាក្នុងការភ្ជាប់ទៅកាន់មេបញ្ជាការ (Server API):', error);
      throw error;
    }
  }
}
