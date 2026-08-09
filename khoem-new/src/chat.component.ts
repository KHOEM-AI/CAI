import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClaudeService, ClaudeMessage } from './claude.service';
import { PROMPT_EXAMPLES } from './prompt-examples';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent {
  // ប្រវត្តិសន្ទនាទាំងអស់ (ត្រូវផ្ញើទៅ API ជារៀងរាល់ដង ព្រោះ Claude គ្មានការចងចាំ)
  messages = signal<ClaudeMessage[]>([]);

  // អត្ថបទដែលអ្នកប្រើកំពុងវាយ
  userInput = signal('');

  // សភាពកំពុងផ្ទុក (loading)
  isLoading = signal(false);

  // system prompt បច្ចុប្បន្ន — អាចប្តូរបានតាមឧទាហរណ៍ក្នុង prompt-examples.ts
  currentSystemPrompt = signal(
    PROMPT_EXAMPLES.teacher.system
  );

  // បញ្ជីឈ្មោះ prompt ដើម្បីបង្ហាញក្នុង dropdown
  promptOptions = Object.keys(PROMPT_EXAMPLES);

  constructor(private claudeService: ClaudeService) {}

  // ពេលអ្នកប្រើប្តូរ system prompt ពី dropdown
  onPromptChange(key: string) {
    const selected = (PROMPT_EXAMPLES as any)[key];
    this.currentSystemPrompt.set(selected.system);
  }

  // មុខងារសំខាន់៖ ផ្ញើសារ
  sendMessage() {
    const text = this.userInput().trim();
    if (!text || this.isLoading()) return;

    // បន្ថែមសាររបស់អ្នកប្រើទៅក្នុងប្រវត្តិ
    const newUserMessage: ClaudeMessage = { role: 'user', content: text };
    this.messages.update(msgs => [...msgs, newUserMessage]);
    this.userInput.set('');
    this.isLoading.set(true);

    // ផ្ញើប្រវត្តិទាំងអស់ + system prompt ទៅ Claude API
    this.claudeService.sendMessage(this.messages(), this.currentSystemPrompt()).subscribe({
      next: (response) => {
        const replyText = response.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');

        this.messages.update(msgs => [
          ...msgs,
          { role: 'assistant', content: replyText }
        ]);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Claude API error:', err);
        this.messages.update(msgs => [
          ...msgs,
          { role: 'assistant', content: '⚠️ មានបញ្ហាក្នុងការភ្ជាប់ទៅ API។ សូមពិនិត្យ API key របស់អ្នក។' }
        ]);
        this.isLoading.set(false);
      }
    });
  }

  // សម្អាតការសន្ទនាទាំងអស់ ចាប់ផ្តើមថ្មី
  clearChat() {
    this.messages.set([]);
  }
}
