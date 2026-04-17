declare module 'react-quill' {
  import type { ComponentType } from 'react'

  type ReactQuillProps = {
    theme?: string
    value?: string
    onChange?: (value: string) => void
    modules?: unknown
    formats?: string[]
    placeholder?: string
    className?: string
  }

  const ReactQuill: ComponentType<ReactQuillProps>

  export default ReactQuill
}
