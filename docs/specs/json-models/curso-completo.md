# Curso completo

Modelo para importar um curso inteiro, com metadados, configuração de quizzes e múltiplos módulos.

```json
{
  "title": "Curso de Exemplo",
  "description": "Descrição do curso em HTML ou texto.",
  "workload_minutes": 240,
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
      "title": "Módulo 1 - Fundamentos",
      "description": "Primeiro módulo do curso.",
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
