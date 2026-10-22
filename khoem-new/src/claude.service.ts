import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  private apiUrl = 'http://localhost:4000/api/chat';

  constructor(private http: HttpClient) {}

  /**
   * ហៅ Claude API ជាមួយ system prompt + conversation history
   * @param messages - ប្រវត្តិសន្ទនាទាំងអស់ (user + assistant)
   * @param systemPrompt - សេចក្តីណែនាំកំណត់តួនាទី/អាកប្បកិរិយារបស់ Claude
   */
  sendMessage(messages: ClaudeMessage[], systemPrompt: string = ''): Observable<ClaudeResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body = { messages: messages };
    return this.http
      .post<{ reply: string }>(this.apiUrl, body, { headers })
      .pipe(
        map((r) => ({
          content: [{ type: 'text', text: r.reply }],
          id: '',
          model: 'khoem-local',
          stop_reason: 'end_turn',
        }))
      );
  }
}
