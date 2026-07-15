import React, { useEffect, useRef, useState } from 'react';
import 'quill/dist/quill.snow.css';

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const QuillEditor: React.FC<QuillEditorProps> = ({ value, onChange, placeholder }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);
  const [quillLoaded, setQuillLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || quillRef.current) return;

    // Load Quill dynamically to avoid SSR "document is not defined" issues
    import('quill').then((QuillModule) => {
      const Quill = QuillModule.default;
      
      const quill = new Quill(containerRef.current!, {
        theme: 'snow',
        placeholder: placeholder || 'เขียนรายละเอียดกิจกรรมที่นี่...',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ color: [] }, { background: [] }],
            ['link', 'clean'],
          ],
        },
      });

      quillRef.current = quill;
      setQuillLoaded(true);

      // Set initial value
      if (value) {
        quill.clipboard.dangerouslyPasteHTML(value);
      }

      quill.on('text-change', () => {
        if (isUpdatingRef.current) return;
        const html = quill.root.innerHTML;
        const cleanHtml = html === '<p><br></p>' ? '' : html;
        onChange(cleanHtml);
      });
    });

    return () => {
      quillRef.current = null;
    };
  }, []);

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (!quillRef.current || !quillLoaded) return;
    const currentHtml = quillRef.current.root.innerHTML;
    const cleanCurrentHtml = currentHtml === '<p><br></p>' ? '' : currentHtml;
    
    if (value !== cleanCurrentHtml) {
      isUpdatingRef.current = true;
      // Capture selection to preserve cursor position
      const selection = quillRef.current.getSelection();
      quillRef.current.root.innerHTML = value || '';
      if (selection) {
        quillRef.current.setSelection(selection);
      }
      isUpdatingRef.current = false;
    }
  }, [value, quillLoaded]);

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '4px', border: '1px solid rgba(0, 0, 0, 0.23)' }}>
      <div ref={containerRef} style={{ minHeight: '150px' }} />
    </div>
  );
};
