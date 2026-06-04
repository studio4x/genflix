# 1º módulo do curso

Modelo para iniciar um curso novo com as informações básicas e apenas o primeiro módulo preenchido.

```json
{
  "title": "Curso de Exemplo",
  "description": "Resumo breve do curso para contextualizar o primeiro módulo.",
  "workload_minutes": 180,
  "thumbnail_url": "https://example.com/thumb.jpg",
  "status": "draft",
  "quiz_type_settings": {
    "single_choice": true,
    "essay_ai": true,
    "drag_drop_labeling": true,
    "fill_in_the_blanks": true,
    "image_hotspot": true,
    "coloring": true,
    "case_study": true
  },
  "modules": [
    {
      "title": "Módulo 1 - Boas-vindas",
      "description": "Primeiro contato com o conteúdo do curso.",
      "lessons": [
        {
          "title": "Boas-vindas e visão geral",
          "description": "Apresenta o objetivo do curso.",
          "lesson_type": "text",
          "text_content": "<p>Bem-vindo ao curso.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Bem-vindo ao curso.</p>"
            }
          ],
          "estimated_minutes": 8
        }
      ],
      "assessments": [
        {
          "title": "Quiz de fixação",
          "description": "Verifica a compreensão dos pontos principais.",
          "assessment_type": "module",
          "passing_score": 70,
          "max_attempts": 3,
          "estimated_minutes": 10,
          "questions": [],
          "case_studies": []
        }
      ]
    }
  ]
}
```
