'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  children: string
  className?: string
}

// 빵빵이 응답·프로젝트 개요 등 markdown 텍스트를 노션 스타일로 렌더링.
// react-markdown components 매핑으로 Tailwind 클래스 직접 부여 (typography 플러그인 없이도 동작).
export default function MarkdownText({ children, className = '' }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1.5 text-gray-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1 text-gray-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-0.5 text-gray-800">{children}</h3>,
          p: ({ children }) => <p className="text-sm leading-relaxed mb-1.5 text-gray-700">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-0.5 mb-1.5 text-sm text-gray-700">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-0.5 mb-1.5 text-sm text-gray-700">{children}</ol>,
          li: ({ children, ...props }) => {
            // GFM task list (- [ ] / - [x]) 지원
            const isTask = (props as { className?: string }).className?.includes('task-list-item')
            if (isTask) return <li className="list-none -ml-5 text-sm leading-relaxed flex gap-1.5 items-start">{children}</li>
            return <li className="text-sm leading-relaxed">{children}</li>
          },
          input: ({ ...props }) => <input {...props} disabled className="mt-1 accent-blue-600" />,
          del: ({ children }) => <del className="text-gray-400">{children}</del>,
          code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-[12px] font-mono">{children}</code>,
          a: ({ children, href }) => <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
          hr: () => <hr className="my-2 border-gray-200" />,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 pl-3 my-1.5 text-gray-600 italic">{children}</blockquote>,
          table: ({ children }) => <table className="text-xs my-2 border-collapse w-full">{children}</table>,
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th: ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-gray-200 px-2 py-1">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
