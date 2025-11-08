'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type Submission = {
  id: string;
  businessName: string;
  employeeCount?: number;
  yearsInOperation?: number;
  industryCode?: string;
  industryLabel?: string;
  insuranceNeeds?: string;
};

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Calculate progress based on answered questions
  function calculateProgress(sub: Submission | null): number {
    if (!sub) return 0;
    
    let answered = 0;
    const total = 4;

    if (sub.employeeCount) answered++;
    if (sub.yearsInOperation) answered++;
    if (sub.industryCode && sub.industryLabel) answered++;
    if (sub.insuranceNeeds && sub.insuranceNeeds.length > 0) answered++;

    return (answered / total) * 100;
  }

  // Load submission and messages
  useEffect(() => {
    loadSubmission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadSubmission() {
    try {
      const response = await fetch(`${API}/submissions/${submissionId}`);
      if (!response.ok) {
        throw new Error('Failed to load submission');
      }
      const data = await response.json();
      setSubmission(data);
      setMessages(data.messages || []);
      setProgress(calculateProgress(data));

      // Send welcome message if no messages yet AND we haven't initialized yet
      // Backend will respond with welcome + Question 1
      // Use ref to prevent double-initialization in React dev mode
      if (data.messages.length === 0 && !hasInitialized.current) {
        hasInitialized.current = true;
        await sendWelcomeMessage();
      }
    } catch (error) {
      console.error('Error loading submission:', error);
      alert('Failed to load submission');
    } finally {
      setInitialLoading(false);
    }
  }

  async function sendWelcomeMessage() {
    // Send a special trigger to get the welcome message + Question 1 from backend
    // Don't show anything locally - let the backend generate both messages
    
    try {
      // Send a special "start" message that backend will recognize
      const response = await fetch(`${API}/submissions/${submissionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__START_CHAT__' }),
      });

      if (!response.ok) {
        throw new Error('Failed to start chat');
      }

      const data = await response.json();
      setMessages(data.messages || []);
      setSubmission(data.submission);
      setProgress(calculateProgress(data.submission));
    } catch (error) {
      console.error('Error starting chat:', error);
      // Fallback: show welcome message and Q1 locally
      const welcomeMsg: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `Hi! I'm here to help you get the right insurance coverage for ${submission?.businessName || 'your business'}. 

I'll guide you through **4 essential questions** to find the perfect coverage for your business:

📋 **Questions I'll ask:**
1. How many employees do you have?
2. How long has your business been in operation?
3. What industry or type of business are you in?
4. Confirm the insurance coverages I recommend for you

Plus a couple of optional bonus questions to get you the best rates!

Let's get started! 🚀`,
        createdAt: new Date().toISOString(),
      };
      const q1Msg: Message = {
        id: 'q1',
        role: 'assistant',
        content: '**Question 1 of 4:** How many employees does your business have?\n\n(This helps us understand your business size and determine appropriate coverage levels)',
        createdAt: new Date().toISOString(),
      };
      setMessages([welcomeMsg, q1Msg]);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      const response = await fetch(`${API}/submissions/${submissionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      setMessages(data.messages);
      setSubmission(data.submission);
      setProgress(calculateProgress(data.submission));
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleFinish() {
    router.push(`/submissions/${submissionId}`);
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{submission?.businessName}</h1>
              <p className="text-sm text-gray-600">Let&apos;s find the right insurance coverage</p>
            </div>
            {progress === 100 && (
              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md hover:shadow-lg"
              >
                Finish & Review →
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span className="font-medium">
                {progress === 100 ? '✅ Complete' : 'Progress'}
              </span>
              <span className="font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  progress === 100 ? 'bg-green-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages - Flexible height with padding at bottom */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 shadow-sm border'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-900 shadow-sm border max-w-2xl px-4 py-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - Sticky at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={sendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

