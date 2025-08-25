import React, { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../api/client.js'

function MessageBubble({ message, isUser, isLoading }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-3xl px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-blue-600 text-white ml-12'
            : 'bg-slate-800 text-slate-100 mr-12 border border-slate-700'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-slate-400 text-sm">AI is thinking...</span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{message}</div>
        )}
      </div>
    </div>
  )
}

function SuggestedQuestions({ onQuestionClick }) {
  const suggestions = [
    "What's my portfolio's current cash-on-cash return?",
    "Analyze the cap rates in my market areas",
    "Which of my properties has the best ROI?",
    "Should I refinance any of my properties?",
    "What are the risks in my current portfolio?",
    "Compare my properties' performance to market averages",
    "Calculate NOI for my rental properties",
    "Suggest areas for portfolio diversification"
  ]

  return (
    <div className="mb-6">
      <h3 className="text-slate-300 text-sm font-medium mb-3">Suggested Questions:</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {suggestions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className="text-left p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-slate-100 transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  useEffect(() => {
    // Focus on input when component mounts
    inputRef.current?.focus()
  }, [])

  const sendMessage = async (messageText = inputMessage) => {
    if (!messageText.trim() || isLoading) return

    const userMessage = { text: messageText, isUser: true, timestamp: Date.now() }
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await apiFetch('/api/chat/', {
        method: 'POST',
        body: JSON.stringify({ message: messageText }),
      })

      if (response.ok) {
        const data = await response.json()
        
        const aiMessage = { 
          text: data.message, 
          isUser: false, 
          timestamp: Date.now(),
          contextInfo: {
            propertiesCount: data.context_properties_count,
            marketDataCount: data.market_data_count
          }
        }
        
        setMessages(prev => [...prev, aiMessage])
      } else {
        const errorData = await response.json()
        setMessages(prev => [...prev, {
          text: `Error: ${errorData.error || 'Failed to get AI response'}`,
          isUser: false,
          timestamp: Date.now(),
          isError: true
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        text: `Error: Unable to connect to AI assistant. ${err.message || 'Please try again.'}`,
        isUser: false,
        timestamp: Date.now(),
        isError: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage()
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  🤖
                </div>
                AI Real Estate Assistant
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Get personalized investment advice based on your portfolio data
              </p>
            </div>
            
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-sm transition-colors"
              >
                Clear Chat
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🤖</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2">
              Welcome to your AI Real Estate Assistant
            </h2>
            <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
              I can help you analyze your property portfolio, calculate investment metrics, 
              assess risks, and provide personalized investment advice based on your data.
            </p>
            
            <SuggestedQuestions onQuestionClick={sendMessage} />
          </div>
        )}

        {/* Messages */}
        <div className="space-y-1 mb-6">
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message.text}
              isUser={message.isUser}
              isLoading={false}
            />
          ))}
          
          {isLoading && (
            <MessageBubble
              message=""
              isUser={false}
              isLoading={true}
            />
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 -mx-4 px-4 py-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about your properties, portfolio performance, market analysis, or investment strategies..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 resize-none focus:border-blue-500 focus:outline-none transition-colors"
                  rows="1"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  disabled={isLoading}
                />
              </div>
              
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                  </>
                )}
              </button>
            </div>
            
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <span>{inputMessage.length}/2000</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
