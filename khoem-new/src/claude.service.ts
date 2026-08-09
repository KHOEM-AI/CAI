import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

// ប្រភេទទិន្នន័យសម្រាប់សារនីមួយៗ (Message type)
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

// រចនាសម្ព័ន្ធ Response ពី Claude API
export interface ClaudeResponse {
  content: { type: string; text: string }[];
  id: string;
  model: string;
  stop_reason: string;
}

@Injectable({ providedIn: 'root' })
export class ClaudeService {
  // ⚠️ កំណត់ត្រា៖ កុំដាក់ API key ផ្ទាល់ក្នុង frontend code ពេលដាក់ដំណើរការជាក់ស្តែង (production)!
  // គួរឆ្លងកាត់ backend server ផ្ទាល់ខ្លួន (Node.js/Express) ដើម្បីលាក់ key
  private apiUrl = 'https://api.anthropic.com/v1/messages';
  private apiKey = 'YOUR_API_KEY_HERE'; // ដាក់ API key របស់បងនៅទីនេះ (សម្រាប់ dev/test តែប៉ុណ្ណោះ)

  constructor(private http: HttpClient) {}

  /**
   * ហៅ Claude API ជាមួយ system prompt + conversation history
   * @param messages - ប្រវត្តិសន្ទនាទាំងអស់ (user + assistant)
   * @param systemPrompt - សេចក្តីណែនាំកំណត់តួនាទី/អាកប្បកិរិយារបស់ Claude
   */
  sendMessage(messages: ClaudeMessage[], systemPrompt: string = ''): Observable<ClaudeResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true' // ត្រូវការសម្រាប់ហៅផ្ទាល់ពី browser
    });

    const body = {
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    };

    return this.http.post<ClaudeResponse>(this.apiUrl, body, { headers });
  }
}
