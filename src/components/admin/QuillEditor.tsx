import React, { useEffect, useRef, useState } from 'react';
import 'quill/dist/quill.snow.css';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import MagnificImageDialog from './MagnificImageDialog';

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * ถ้ากำหนดมา จะแสดงปุ่ม "แทรกรูปด้วย Magnific AI" ใต้ editor
   * ฟังก์ชันนี้ต้องอัปโหลดไฟล์ (เช่น ไป Firebase Storage) แล้วคืน URL ถาวรกลับมา
   */
  onUploadImage?: (file: File) => Promise<string>;
}

export const QuillEditor: React.FC<QuillEditorProps> = ({ value, onChange, placeholder, onUploadImage }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);
  const [quillLoaded, setQuillLoaded] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [insertError, setInsertError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || quillRef.current) return;

    // Avoid double initialization due to React Strict Mode
    if (containerRef.current.classList.contains('ql-container')) return;

    // Load Quill dynamically to avoid SSR "document is not defined" issues
    import('quill').then((QuillModule) => {
      if (!containerRef.current || quillRef.current || containerRef.current.classList.contains('ql-container')) return;

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

  const handleUseAiImage = async (file: File) => {
    if (!onUploadImage || !quillRef.current) return;
    try {
      setInserting(true);
      setInsertError('');
      const url = await onUploadImage(file);

      const quill = quillRef.current;
      const range = quill.getSelection(true);
      const index = range ? range.index : quill.getLength();
      quill.insertEmbed(index, 'image', url, 'user');
      quill.setSelection(index + 1);
    } catch (err: any) {
      console.error('Insert AI image failed:', err);
      setInsertError(err?.message || 'อัปโหลดรูปภาพไม่สำเร็จ');
      throw err;
    } finally {
      setInserting(false);
    }
  };

  return (
    <div>
      <div className="rounded border border-[var(--page-border)] bg-[var(--page-card-solid)] text-[var(--page-text)]">
        <div ref={containerRef} className="min-h-[150px]" />
      </div>

      {onUploadImage && (
        <div className="mt-2 flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={inserting || !quillLoaded}
            onClick={() => setAiDialogOpen(true)}
            className="gap-1.5 font-semibold"
          >
            {inserting ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
            {inserting ? 'กำลังอัปโหลดรูป...' : 'แทรกรูปประกอบด้วย Magnific AI'}
          </Button>
          {insertError && (
            <span className="text-xs text-destructive">{insertError}</span>
          )}
        </div>
      )}

      {onUploadImage && (
        <MagnificImageDialog
          open={aiDialogOpen}
          onClose={() => setAiDialogOpen(false)}
          onUseImage={handleUseAiImage}
          title="สร้างรูปประกอบรายละเอียดด้วย Magnific AI"
          useButtonLabel="แทรกรูปนี้ลงในรายละเอียด"
          initialPrompt="A clean minimal illustration for a university activity announcement"
          initialRatio="classic_4_3"
        />
      )}
    </div>
  );
};
