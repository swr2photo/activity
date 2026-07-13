import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Fade,
} from '@mui/material';
import { Assignment as AssignmentIcon } from '@mui/icons-material';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SurveyConfig, SurveyQuestion } from '../../lib/adminFirebase';

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

  const handleChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate required fields
    for (const q of surveyConfig.questions) {
      if (q.required && (!answers[q.id] || answers[q.id].trim() === '')) {
        setError('กรุณาตอบคำถามที่จำเป็นให้ครบถ้วน');
        return;
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
    <Fade in>
      <Card elevation={0} sx={{ borderRadius: 4, bgcolor: '#fdfdfd', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <AssignmentIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight={800} gutterBottom>
              แบบประเมินกิจกรรม
            </Typography>
            <Typography variant="body2" color="text.secondary">
              กรุณาทำแบบประเมินเพื่อเสร็จสิ้นการลงทะเบียน
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              {surveyConfig.questions.map((q: SurveyQuestion, i: number) => (
                <Box key={q.id}>
                  <FormLabel
                    required={q.required}
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      mb: 1,
                      display: 'block',
                      '& .MuiFormLabel-asterisk': { color: 'error.main' },
                    }}
                  >
                    {i + 1}. {q.question}
                  </FormLabel>

                  {q.type === 'text' && (
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      required={q.required}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleChange(q.id, e.target.value)}
                      placeholder="พิมพ์คำตอบของคุณ"
                      multiline
                      minRows={2}
                    />
                  )}

                  {(q.type === 'choice' || q.type === 'rating') && (
                    <FormControl required={q.required} fullWidth>
                      <RadioGroup
                        value={answers[q.id] || ''}
                        onChange={(e) => handleChange(q.id, e.target.value)}
                        row={q.type === 'rating'}
                      >
                        {q.type === 'rating' ? (
                          <Stack direction="row" spacing={2} justifyContent="space-around" sx={{ mt: 1 }}>
                            {[1, 2, 3, 4, 5].map((val) => (
                              <FormControlLabel
                                key={val}
                                value={val.toString()}
                                control={<Radio size="small" />}
                                label={val.toString()}
                                labelPlacement="bottom"
                              />
                            ))}
                          </Stack>
                        ) : (
                          <Stack spacing={1}>
                            {(q.options || []).map((opt) => (
                              <FormControlLabel
                                key={opt}
                                value={opt}
                                control={<Radio size="small" />}
                                label={opt}
                              />
                            ))}
                          </Stack>
                        )}
                      </RadioGroup>
                    </FormControl>
                  )}
                </Box>
              ))}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
                sx={{ mt: 2, py: 1.5, borderRadius: 3 }}
              >
                {submitting ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'ส่งแบบประเมิน'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Fade>
  );
}
