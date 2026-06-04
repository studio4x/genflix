# 1º módulo do curso

Modelo para iniciar um curso novo com as informações básicas e o primeiro módulo preenchido com 3 aulas e quiz.

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
          "title": "Boas-vindas - Aula 1",
          "description": "Introduz o tema principal do módulo.",
          "lesson_type": "text",
          "text_content": "<p>Boas-vindas - Aula 1: conteúdo introdutório.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Boas-vindas - Aula 1: conteúdo introdutório.</p>"
            }
          ],
          "estimated_minutes": 8
        },
        {
          "title": "Boas-vindas - Aula 2",
          "description": "Amplia a compreensão com um segundo passo.",
          "lesson_type": "text",
          "text_content": "<p>Boas-vindas - Aula 2: aprofundamento do conteúdo.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Boas-vindas - Aula 2: aprofundamento do conteúdo.</p>"
            }
          ],
          "estimated_minutes": 10
        },
        {
          "title": "Boas-vindas - Aula 3",
          "description": "Fecha o ciclo com revisão prática.",
          "lesson_type": "text",
          "text_content": "<p>Boas-vindas - Aula 3: revisão e aplicação.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Boas-vindas - Aula 3: revisão e aplicação.</p>"
            }
          ],
          "estimated_minutes": 12
        }
      ],
      "assessments": [
        {
          "title": "Quiz de fixação",
          "description": "Verifica a compreensão dos pontos principais do módulo.",
          "assessment_type": "module",
          "passing_score": 70,
          "max_attempts": 3,
          "estimated_minutes": 10,
          "questions": [
            {
              "question_text": "Qual é o objetivo principal de Boas-vindas?",
              "question_type": "single_choice",
              "points": 1,
              "is_required": true,
              "options": [
                {
                  "option_text": "Entender os conceitos básicos e a estrutura do conteúdo.",
                  "is_correct": true
                },
                {
                  "option_text": "Pular direto para a avaliação final.",
                  "is_correct": false
                },
                {
                  "option_text": "Usar apenas conteúdo visual sem texto.",
                  "is_correct": false
                },
                {
                  "option_text": "Ignorar a organização em módulos.",
                  "is_correct": false
                }
              ]
            }
          ],
          "case_studies": []
        }
      ]
    }
  ]
}
```
