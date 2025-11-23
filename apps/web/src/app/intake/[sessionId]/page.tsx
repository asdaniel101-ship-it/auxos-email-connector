'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Session {
  id: string;
  vertical: string;
  businessType: string | null;
  lead: {
    id: string;
    completionPercentage: number;
    status: string;
  } | null;
  messages: Message[];
  documents: Array<{
    id: string;
    fileName: string;
    docType: string | null;
    processingStatus: string;
  }>;
}

export default function IntakePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    loadSession();
    // Poll for session updates every 5 seconds
    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSession = async () => {
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Session not found');
          return;
        }
        throw new Error(`Failed to load session: ${response.statusText}`);
      }
      const data = await response.json();
      setSession(data);
      setMessages(data.messages || []);
      setError(null);
    } catch (error) {
      console.error('Error loading session:', error);
      setError(error instanceof Error ? error.message : 'Failed to load session');
    } finally {
      setIsLoadingSession(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const messageToSend = inputMessage.trim();
    
    // Prevent sending empty or very long messages
    if (messageToSend.length === 0) return;
    if (messageToSend.length > 1000) {
      setError('Message is too long. Please keep it under 1000 characters.');
      return;
    }

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Add timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${API_URL}/chat/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageToSend }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Sorry, I encountered an error. Please try again.';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = typeof errorData.message === 'string' 
              ? errorData.message 
              : 'An error occurred. Please try again.';
          }
        } catch (e) {
          // If response isn't JSON, use status text
          if (response.status === 404) {
            errorMessage = 'Session not found. Please start over.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again in a moment.';
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.message) {
        throw new Error('Invalid response from server. Please try again.');
      }

      const assistantMessage: Message = {
        id: data.messageId || `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Reload session to get updated lead and completion percentage
      setTimeout(async () => {
        await loadSession();
      }, 500);
    } catch (error) {
      console.error('Error sending message:', error);
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      
      // Only show error message in chat if it's user-friendly
      if (!errorMessage.includes('Failed to') && !errorMessage.includes('Error:')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: errorMessage,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-900 mb-4"></div>
          <p className="text-slate-600 font-medium">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Session not found</h1>
          <p className="text-slate-600 mb-6">{error || 'The session you\'re looking for doesn\'t exist.'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const completionPercentage = session.lead?.completionPercentage || 0;
  const isReady = completionPercentage >= 80;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex flex-col">
      {/* Modern Header with gradient */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              {session.vertical === 'insurance' ? 'Insurance Intake' : 'Lending Intake'}
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {session.businessType ? session.businessType.charAt(0).toUpperCase() + session.businessType.slice(1) : 'Business'} • {completionPercentage}% complete
            </p>
          </div>
          {error && (
            <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Chat - Modern Design */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 mr-96">
          {/* Chat Messages Area */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-gradient-to-b from-transparent to-slate-50/50"
          >
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="text-5xl mb-4 animate-pulse">💬</div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">Let's get started!</h2>
                  <p className="text-slate-600">I'll ask you a few questions to help you get the best quotes.</p>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-300`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={`max-w-2xl rounded-2xl px-5 py-3 shadow-sm transition-all hover:shadow-md ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-br-sm'
                      : 'bg-white border border-slate-200/60 text-slate-900 rounded-bl-sm backdrop-blur-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{message.content}</p>
                  <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-slate-300' : 'text-slate-400'}`}>
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start animate-in fade-in">
                <div className="bg-white border border-slate-200/60 rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm backdrop-blur-sm">
                  <div className="flex space-x-2">
                    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Modern Input Area */}
          <div className="bg-white/80 backdrop-blur-sm border-t border-slate-200/50 px-6 py-4 shadow-lg">
            <form onSubmit={sendMessage} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full px-4 py-3 pr-12 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all placeholder:text-slate-400"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e);
                    }
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  Press Enter to send
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="px-6 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white font-semibold rounded-xl hover:from-slate-800 hover:to-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md disabled:hover:shadow-sm flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Modern Sidebar */}
        <div className="w-96 bg-white/80 backdrop-blur-sm border-l border-slate-200/50 flex flex-col fixed right-0 top-[73px] bottom-0 overflow-hidden z-10 shadow-lg">
          {/* Profile Completion Card */}
          <div className="p-6 border-b border-slate-200/50 flex-shrink-0 bg-gradient-to-br from-white to-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">Profile Completion</h2>
              <div className="text-2xl font-bold text-slate-900">{completionPercentage}%</div>
            </div>
            <div className="w-full bg-slate-200/60 rounded-full h-3 mb-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {isReady ? '✅ Ready to review!' : `${80 - completionPercentage}% more to go`}
            </p>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Documents Section */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Documents
              </h3>
              <div className="space-y-2">
                {session.documents.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                    <p className="text-sm text-slate-500">No documents uploaded yet</p>
                  </div>
                ) : (
                  session.documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="font-medium text-sm text-slate-900 mb-1 truncate">{doc.fileName}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          doc.processingStatus === 'processed' ? 'bg-green-100 text-green-700' :
                          doc.processingStatus === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                          doc.processingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {doc.processingStatus}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                📄 Documents are being processed in the background. Extracted information will appear as you chat.
              </p>
            </div>
          </div>

          {/* Review Button - Sticky Bottom */}
          <div className="p-6 border-t border-slate-200/50 flex-shrink-0 bg-gradient-to-t from-white to-slate-50/50">
            <button
              onClick={() => router.push(`/review/${sessionId}`)}
              disabled={!isReady}
              className="w-full px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white font-semibold rounded-xl hover:from-slate-800 hover:to-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md disabled:hover:shadow-sm flex items-center justify-center gap-2"
            >
              {isReady ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Review & Confirm</span>
                </>
              ) : (
                <>
                  <span>Complete {completionPercentage}%</span>
                  <span className="text-xs opacity-75">(Need 80%)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
