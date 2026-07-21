'use client';

import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SurveyConfig, SurveyQuestion } from '../../lib/adminFirebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

interface SurveyFormProps {
  activityCode: string;
  activityDocId: string;
  surveyConfig: SurveyConfig;
  userId: string;
  onCompleted: () => void;
}

export default function SurveyForm({
  activityCode,
  activityDocId,
  surveyConfig,
  userId,
  onCompleted,
}: SurveyFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    for (const q of surveyConfig.questions) {
      const valRaw = answers[q.id] || '';
      const val = valRaw.trim();

      if (q.required && val === '') {
        setError(`กรุณาตอบคำถาม: ${q.question}`);
        return;
      }

      if (val !== '' && q.type === 'text') {
        const type = q.validationType || 'any';
        const allowSpaces = q.allowSpaces !== false;
        const prefix = q.prefix || '';
        const postfix = q.postfix || '';

        if (prefix && !val.startsWith(prefix)) {
          setError(`คำถาม "${q.question}" ต้องเริ่มต้นด้วย "${prefix}"`);
          return;
        }

        if (postfix && !val.endsWith(postfix)) {
          setError(`คำถาม "${q.question}" ต้องลงท้ายด้วย "${postfix}"`);
          return;
        }

        let cleanVal = val;
        if (prefix && cleanVal.startsWith(prefix)) {
          cleanVal = cleanVal.substring(prefix.length);
        }
        if (postfix && cleanVal.endsWith(postfix)) {
          cleanVal = cleanVal.substring(0, cleanVal.length - postfix.length);
        }

        if (!allowSpaces && cleanVal.includes(' ')) {
          setError(`คำถาม "${q.question}" ห้ามมีเว้นวรรค`);
          return;
        }

        const checkVal = allowSpaces ? cleanVal.replace(/\s+/g, '') : cleanVal;

        if (type === 'number') {
          if (!/^\d+$/.test(checkVal)) {
            setError(`คำถาม "${q.question}" ต้องเป็นตัวเลขเท่านั้น`);
            return;
          }
        } else if (type === 'thai') {
          if (!/^[ก-๙]+$/.test(checkVal)) {
            setError(`คำถาม "${q.question}" ต้องเป็นภาษาไทยเท่านั้น`);
            return;
          }
        } else if (type === 'english') {
          if (!/^[a-zA-Z]+$/.test(checkVal)) {
            setError(`คำถาม "${q.question}" ต้องเป็นภาษาอังกฤษเท่านั้น`);
            return;
          }
        } else if (type === 'email') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            setError(`คำถาม "${q.question}" ต้องเป็นรูปแบบอีเมลที่ถูกต้อง`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'surveyResponses'), {
        activityCode,
        activityDocId,
        userId,
        answers,
        timestamp: serverTimestamp(),
      });
      onCompleted();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการส่งแบบประเมิน');
      setSubmitting(false);
    }
  };

  return (
    <Card
      className={cn(
        'rounded-2xl border bg-[#fdfdfd] shadow-none transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <ClipboardList className="mx-auto mb-2 h-12 w-12 text-primary" />
          <h2 className="mb-1 text-xl font-extrabold">แบบประเมินกิจกรรม</h2>
          <p className="text-sm text-muted-foreground">
            กรุณาทำแบบประเมินเพื่อเสร็จสิ้นการลงทะเบียน
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            {surveyConfig.questions.map((q: SurveyQuestion, i: number) => (
              <div key={q.id}>
                <Label className="mb-2 block font-semibold text-foreground">
                  {i + 1}. {q.question}
                  {q.required && <span className="ml-0.5 text-destructive">*</span>}
                </Label>

                {q.type === 'text' && (
                  <Textarea
                    required={q.required}
                    value={answers[q.id] || ''}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    placeholder="พิมพ์คำตอบของคุณ"
                    rows={2}
                  />
                )}

                {(q.type === 'choice' || q.type === 'rating') && (
                  <RadioGroup
                    required={q.required}
                    value={answers[q.id] || ''}
                    onValueChange={(value) => handleChange(q.id, value)}
                    className={
                      q.type === 'rating'
                        ? 'mt-2 flex flex-row justify-around gap-4'
                        : 'gap-2'
                    }
                  >
                    {q.type === 'rating'
                      ? [1, 2, 3, 4, 5].map((val) => (
                          <label
                            key={val}
                            className="flex flex-col items-center gap-1.5 cursor-pointer"
                          >
                            <RadioGroupItem value={val.toString()} />
                            <span className="text-sm">{val}</span>
                          </label>
                        ))
                      : (q.options || []).map((opt) => (
                          <label
                            key={opt}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <RadioGroupItem value={opt} />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                  </RadioGroup>
                )}
              </div>
            ))}

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="mt-2 rounded-xl py-6"
            >
              {submitting ? (
                <Spinner className="text-primary-foreground" />
              ) : (
                'ส่งแบบประเมิน'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
